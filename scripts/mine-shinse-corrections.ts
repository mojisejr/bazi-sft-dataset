/**
 * mine-shinse-corrections — ถอด "คำแก้ซินแส" จากคำอ่าน 15 บทรายคน เทียบกับ engine baseline
 * เพื่อหา cell ใน bazi_newdata ที่ควรเติม/ปรับ (ป้อนให้ scripts/backfill-shinse-newdata.ts)
 *
 * ตรรกะ:
 *   - โหลดดวงที่มี edits.boxes (ตัด device "M" ออก)
 *   - recompute engine baseline รายบทด้วย resolveChapterBoxesDetailed (มี sources = group/itemKey)
 *   - จับคู่กล่องด้วยหัวข้อ (title) → ADDED / REWRITTEN / UNCHANGED / DELETED
 *   - attribute เฉพาะกล่องที่ map ไป cell เดียว (1 group,itemKey) = ถอดกลับได้ชัด
 *   - แยก "เติมช่องว่าง" (cell เดิม text ว่าง) vs "rewrite" (cell เดิมมีเนื้อ)
 *
 * READ-ONLY: อ่าน DB อย่างเดียว ไม่เขียนกลับ · ตัดชื่อลูกค้าออกก่อนเขียนไฟล์
 * รัน: node --env-file=.env --import tsx scripts/mine-shinse-corrections.ts
 * ออก: docs/shinse-corrections-report.md + scripts/data/shinse-backfill-candidates.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import {
  CHAPTER_INTRO_GROUP,
  resolveChapterBoxesDetailed,
  resolveChapterIntro,
  type ChapterBoxSource,
} from "@/lib/bazi/chapter-newdata-map";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";
import { createDbNewdataReadingRepository } from "@/lib/bazi/newdata-reading-repository";
import { extractChartFacts } from "@/lib/bazi/newdata-lookup";
import { getNewdataGroup } from "@/lib/bazi/newdata-groups";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";

const EXCLUDE_DEVICES = new Set(["m"]); // ตัด device "M" (ไม่ใช่งานซินแส)
const PREDICT = TOPIC_PATH.filter((t) => t.kind === "predict");
const TOPIC_TITLE = new Map(TOPIC_PATH.map((t) => [t.id, t.title]));

const STEM_ELEMENT: Record<string, string> = {
  甲: "ไม้", 乙: "ไม้", 丙: "ไฟ", 丁: "ไฟ", 戊: "ดิน",
  己: "ดิน", 庚: "ทอง", 辛: "ทอง", 壬: "น้ำ", 癸: "น้ำ",
};

/** normalize สำหรับเทียบว่า body เปลี่ยนไหม — ตัด marker จัดรูป/ช่องว่าง/หัวข้อหนา */
function normBody(s: string): string {
  return (s ?? "")
    .replace(/\[\[[^\]]*\]\]/g, " ") // [[indent]] ฯลฯ
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
/** ความยาวเนื้อจริง (ตัดหัวข้อหนา/marker) — ใช้ตัดสินว่า "มีเนื้อ" ไหม */
function meaningfulLen(s: string): number {
  return normBody(s).length;
}
/** มีอักษรจีน (ก้าน/กิ่ง/กะจื่อ) หรือคำว่า "เสา…" = เสี่ยงเป็นเนื้อเจาะจงรายดวง */
function hasPersonalMarker(s: string): boolean {
  if (/[㐀-鿿]/.test(s)) return true; // CJK = อ้างก้าน/กิ่ง/กะจื่อเฉพาะดวง
  if (/เสาปี|เสาเดือน|เสาวัน|เสายาม/.test(s)) return true;
  return false;
}
/**
 * กลุ่มที่ "เขียนกลับอัตโนมัติได้ปลอดภัย" = keyKind "fixed" เท่านั้น (คีย์เดียวสากล "ทุกคน")
 * — element/elementCategory ถูกเลือกตาม "ธาตุที่ดวงต้องการ" ไม่ใช่ตามคีย์ cell → attribute ผิดคีย์ได้
 *   (เช่นเนื้อ "ธาตุทอง" ไปโผล่ใน cell "ไฟ") จึงต้องให้ซินแสเคาะ/remap เอง ไม่เขียนอัตโนมัติ
 */
const GENERALIZABLE_KINDS = new Set(["fixed"]);

type Proposal = {
  chartRef: string;
  dayElement: string;
  chapterId: string;
  boxTitle: string;
  body: string; // ตัด PII แล้ว
};
type Candidate = {
  group: string;
  itemKey: string;
  keyKind: string;
  cellStatus: "empty" | "has_content";
  currentText: string;
  klass: "ADDED" | "REWRITTEN";
  /** true = เขียนกลับอัตโนมัติได้อย่างปลอดภัย (กลุ่มทั่วไป + ทุก proposal ไม่มี marker เจาะจงรายดวง) */
  autoSafe: boolean;
  proposals: Proposal[];
};

type Skips = {
  unchanged: number;
  computedNoCell: number; // matcher คำนวณล้วน (ไม่มีกลุ่มใน DB)
  ambiguousMultiCell: number;
  addedNewTitle: number;
  deleted: number;
};

async function main() {
  const readingRepo = createDbNewdataReadingRepository();
  const knowledge = createDbKnowledgeRepository();
  const map = await getNewdataMap();

  const listed = await readingRepo.list();
  const cellMap = new Map<string, Candidate>(); // `${group}\0${itemKey}` → candidate
  const skips: Skips = { unchanged: 0, computedNoCell: 0, ambiguousMultiCell: 0, addedNewTitle: 0, deleted: 0 };
  const ambiguousSamples: Array<{ chapterId: string; title: string; cells: string[] }> = [];
  let chartsUsed = 0;
  let chaptersEdited = 0;

  for (const it of listed) {
    const dev = (it.deviceLabel ?? "").trim().toLowerCase();
    if (EXCLUDE_DEVICES.has(dev)) continue;
    const row = await readingRepo.get(it.id);
    if (!row) continue;
    const boxesByChapter = row.edits?.boxes ?? {};
    const editedChapters = Object.keys(boxesByChapter);
    if (editedChapters.length === 0) continue;

    const state = await calculateBaziStateFromRawInput(
      {
        birthDate: row.birthDate,
        birthTime: row.birthTime,
        gender: row.gender,
        province: row.province ?? undefined,
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      },
      { repository: knowledge },
    );
    const birthYear = parseInt(row.birthDate.slice(0, 4), 10);
    const facts = extractChartFacts(state, row.gender, birthYear);
    const dayElement = STEM_ELEMENT[state.dayMaster?.normalize("NFC") ?? ""] ?? "?";
    chartsUsed += 1;
    const chartRef = `chart#${chartsUsed}`;
    const stripPII = (s: string) => (row.clientName ? s.split(row.clientName).join("").trim() : s);

    for (const chapterId of editedChapters) {
      const sinsaeBoxes = boxesByChapter[chapterId];
      if (!Array.isArray(sinsaeBoxes) || sinsaeBoxes.length === 0) continue;
      chaptersEdited += 1;

      // engine baseline (รายกล่อง + sources) + กล่อง "ภาพรวม" (intro)
      const detailed = resolveChapterBoxesDetailed(chapterId, facts, map);
      const engineByTitle = new Map<string, { body: string; sources: ChapterBoxSource[] }>();
      for (const b of detailed.boxes) engineByTitle.set(b.title.trim(), { body: b.body, sources: b.sources });
      const introGroup = CHAPTER_INTRO_GROUP[chapterId];
      if (introGroup) {
        engineByTitle.set("ภาพรวม", {
          body: resolveChapterIntro(chapterId, map),
          sources: [{ group: introGroup, itemKey: "ทุกคน" }],
        });
      }

      const deleted = new Set((row.edits?.deleted?.[chapterId] ?? []).map((t) => t.trim()));
      skips.deleted += deleted.size;

      for (const sBox of sinsaeBoxes) {
        const title = (sBox.title ?? "").trim();
        const sBody = sBox.body ?? "";
        const eng = engineByTitle.get(title);
        if (!eng) {
          skips.addedNewTitle += 1; // หัวข้อใหม่ที่ไม่มีใน outline → ไม่มี cell รองรับ
          continue;
        }
        if (normBody(eng.body) === normBody(sBody)) {
          skips.unchanged += 1;
          continue;
        }
        if (eng.sources.length === 0) {
          skips.computedNoCell += 1;
          continue;
        }
        if (eng.sources.length > 1) {
          skips.ambiguousMultiCell += 1;
          if (ambiguousSamples.length < 40) {
            ambiguousSamples.push({ chapterId, title, cells: eng.sources.map((s) => `${s.group}/${s.itemKey}`) });
          }
          continue;
        }
        // ── single-cell attributable ──
        const src = eng.sources[0];
        // ตัด matcher คำนวณล้วน: กลุ่มต้องมีจริงใน DB (bazi_newdata) ไม่งั้นเขียนกลับไปก็ไม่มีผล
        if (!map[src.group]) {
          skips.computedNoCell += 1;
          continue;
        }
        const currentText = map[src.group]?.[src.itemKey]?.text ?? "";
        const cellStatus: Candidate["cellStatus"] = meaningfulLen(currentText) > 0 ? "has_content" : "empty";
        const klass: Candidate["klass"] = meaningfulLen(eng.body) > 0 ? "REWRITTEN" : "ADDED";
        const keyKind = getNewdataGroup(src.group)?.keyKind ?? "?";
        const cleanBody = stripPII(sBody).trim();
        const cellId = `${src.group} ${src.itemKey}`;
        let cand = cellMap.get(cellId);
        if (!cand) {
          cand = { group: src.group, itemKey: src.itemKey, keyKind, cellStatus, currentText, klass, autoSafe: true, proposals: [] };
          cellMap.set(cellId, cand);
        }
        // autoSafe = กลุ่มทั่วไป + ไม่มี marker เจาะจงรายดวงในทุก proposal
        if (!GENERALIZABLE_KINDS.has(keyKind) || hasPersonalMarker(cleanBody)) cand.autoSafe = false;
        cand.proposals.push({ chartRef, dayElement, chapterId, boxTitle: title, body: cleanBody });
      }
    }
  }

  const candidates = [...cellMap.values()].sort((a, b) => {
    // เติมช่องว่างก่อน แล้วเรียงตามจำนวน proposal (recurring มาก่อน)
    if (a.cellStatus !== b.cellStatus) return a.cellStatus === "empty" ? -1 : 1;
    return b.proposals.length - a.proposals.length;
  });

  const emptyFills = candidates.filter((c) => c.cellStatus === "empty");
  const rewrites = candidates.filter((c) => c.cellStatus === "has_content");
  const recurring = candidates.filter((c) => new Set(c.proposals.map((p) => p.chartRef)).size >= 2);
  const autoSafe = candidates.filter((c) => c.autoSafe);
  const autoSafeRecurring = autoSafe.filter((c) => new Set(c.proposals.map((p) => p.chartRef)).size >= 2);
  const reviewNeeded = candidates.filter((c) => !c.autoSafe);

  // ── เขียนไฟล์ ──
  const outJson = resolve(process.cwd(), "scripts/data/shinse-backfill-candidates.json");
  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(
    outJson,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), chartsUsed, chaptersEdited, skips, candidates },
      null,
      2,
    ),
    "utf8",
  );

  const groupCount = (list: Candidate[]) => {
    const m = new Map<string, number>();
    for (const c of list) m.set(c.group, (m.get(c.group) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const md: string[] = [];
  md.push("# รายงานถอดคำแก้ซินแส → คลังกลาง (bazi_newdata)\n");
  md.push(`สร้างเมื่อ: ${new Date().toISOString()}\n`);
  md.push("## สรุป\n");
  md.push(`- ดวงที่ใช้ (ตัด device M): **${chartsUsed}**  ·  บทที่ซินแสแก้รวม: **${chaptersEdited}**`);
  md.push(`- cell ที่ถอดได้ชัด (single-cell, มีกลุ่มใน DB จริง): **${candidates.length}**  (เติมช่องว่าง ${emptyFills.length} · rewrite ${rewrites.length} · recurring ${recurring.length})`);
  md.push(`- ✅ **เขียนอัตโนมัติได้ปลอดภัย (autoSafe): ${autoSafe.length}**  (ในนี้ recurring ≥2 ดวง: **${autoSafeRecurring.length}**)`);
  md.push(`- ✋ ต้องซินแสเคาะ (เนื้อเจาะจงรายดวง/กลุ่มไม่ทั่วไป): **${reviewNeeded.length}**`);
  md.push(
    `- ข้าม: unchanged ${skips.unchanged} · matcher คำนวณล้วน ${skips.computedNoCell} · หลาย cell (ambiguous) ${skips.ambiguousMultiCell} · หัวข้อใหม่ ${skips.addedNewTitle} · ซินแสลบ ${skips.deleted}\n`,
  );

  md.push("## ✅ autoSafe — ต่อกลุ่ม (สคริปต์ back-fill จะเขียนเฉพาะพวกนี้)\n");
  for (const [g, n] of groupCount(autoSafe)) md.push(`- \`${g}\`: ${n} cell`);
  md.push("");

  md.push("## ✋ ต้องซินแสเคาะ — ต่อกลุ่ม (ไม่เขียนอัตโนมัติ)\n");
  for (const [g, n] of groupCount(reviewNeeded)) md.push(`- \`${g}\`: ${n} cell`);
  md.push("");

  const sample = (c: Candidate) => {
    const best = [...c.proposals].sort((a, b) => meaningfulLen(b.body) - meaningfulLen(a.body))[0];
    const body = best.body.replace(/\[\[[^\]]*\]\]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
    return `- \`${c.group}/${c.itemKey}\` (${c.proposals.length} ดวง, บท ${c.proposals[0].chapterId}, ธาตุ ${best.dayElement}): ${body}`;
  };
  md.push("## ตัวอย่าง ✅ autoSafe (สูงสุด 40)\n");
  for (const c of autoSafe.slice(0, 40)) md.push(`${sample(c)}  _[${c.cellStatus === "empty" ? "เติมช่องว่าง" : "rewrite"}]_`);
  md.push("");
  md.push("## ตัวอย่าง ✋ ต้องซินแสเคาะ (สูงสุด 20)\n");
  for (const c of reviewNeeded.slice(0, 20)) md.push(sample(c));
  md.push("");
  if (ambiguousSamples.length) {
    md.push("## หมายเหตุ: กล่องหลาย cell (ถอดอัตโนมัติไม่ได้ — ตัวอย่าง)\n");
    for (const a of ambiguousSamples.slice(0, 15)) md.push(`- บท ${a.chapterId} · "${a.title}" → ${a.cells.join(", ")}`);
    md.push("");
  }

  const outMd = resolve(process.cwd(), "docs/shinse-corrections-report.md");
  mkdirSync(dirname(outMd), { recursive: true });
  writeFileSync(outMd, md.join("\n"), "utf8");

  console.log(`ดวงที่ใช้ (ตัด M): ${chartsUsed} · บทที่แก้: ${chaptersEdited}`);
  console.log(`candidates single-cell (DB จริง): ${candidates.length} (เติมช่องว่าง ${emptyFills.length}, rewrite ${rewrites.length})`);
  console.log(`✅ autoSafe: ${autoSafe.length} (recurring≥2: ${autoSafeRecurring.length}) · ✋ ต้องซินแสเคาะ: ${reviewNeeded.length}`);
  console.log(`ข้าม: unchanged ${skips.unchanged}, computed ${skips.computedNoCell}, ambiguous ${skips.ambiguousMultiCell}, newTitle ${skips.addedNewTitle}`);
  console.log(`เขียนแล้ว →\n  ${outMd}\n  ${outJson}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
