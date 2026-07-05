/**
 * build-shinse-fewshot — สร้าง "คลังตัวอย่างสำนวนซินแส" (few-shot bank) สำหรับโหมด AI ถอดแบบซินแส
 *
 * ดึงดวงที่ซินแสแก้เสร็จครบ 15 บทจาก DB → เทียบ engine baseline (recompute) กับ edits ของซินแส
 * รายบท → คัด 2-3 คู่/บท (กระจายธาตุดิถี, ลบชื่อลูกค้า) → เขียน src/lib/bazi/shinse-fewshot.generated.json
 *
 * READ-ONLY: อ่าน DB อย่างเดียว ไม่เขียนกลับ · few-shot สอน "สำนวน" ไม่ใช่ "เนื้อหา"
 * รัน: node --env-file=.env --import tsx scripts/build-shinse-fewshot.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";
import { createDbNewdataReadingRepository } from "@/lib/bazi/newdata-reading-repository";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import { extractChartFacts } from "@/lib/bazi/newdata-lookup";
import { resolveChapterBoxes } from "@/lib/bazi/chapter-newdata-map";
import { getChapterOutline } from "@/lib/bazi/chapter-outline";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";

type Box = { title?: string; body?: string };
const PREDICT = TOPIC_PATH.filter((t) => t.kind === "predict");
const MAX_PER_TOPIC = 3;

/** stem จีน → ธาตุไทย (ดูจากดิถี) */
const STEM_ELEMENT: Record<string, string> = {
  "甲": "ไม้", "乙": "ไม้", "丙": "ไฟ", "丁": "ไฟ", "戊": "ดิน",
  "己": "ดิน", "庚": "ทอง", "辛": "ทอง", "壬": "น้ำ", "癸": "น้ำ",
};

const boxesToMarkdown = (boxes: Box[]): string =>
  (boxes || [])
    .map((b) => `[[box=${b.title ?? ""}]]\n${(b.body ?? "").trim()}\n[[/box]]`)
    .join("\n");

function engineBoxesFor(topicId: string, facts: ReturnType<typeof extractChartFacts>, map: Awaited<ReturnType<typeof getNewdataMap>>): Box[] {
  const resolved = resolveChapterBoxes(topicId, facts, map);
  const outline = getChapterOutline(topicId);
  return [
    ...(outline?.intro ? [{ title: "ภาพรวม", body: outline.intro }] : []),
    ...resolved.boxes,
  ];
}

async function main() {
  const readingRepo = createDbNewdataReadingRepository();
  const knowledge = createDbKnowledgeRepository();
  const map = await getNewdataMap();

  const listed = await readingRepo.list();
  // ดึงเต็ม แล้วคัดเฉพาะที่แก้ครบ 15 บท (edits.boxes มี >=15 คีย์)
  const complete: Array<{ row: NonNullable<Awaited<ReturnType<typeof readingRepo.get>>>; dayElement: string }> = [];
  for (const it of listed) {
    const row = await readingRepo.get(it.id);
    if (!row) continue;
    const boxKeys = Object.keys(row.edits?.boxes ?? {});
    if (boxKeys.length < 15) continue;
    const state = await calculateBaziStateFromRawInput(
      { birthDate: row.birthDate, birthTime: row.birthTime, gender: row.gender, province: row.province ?? "" },
      { repository: knowledge },
    );
    const dayElement = STEM_ELEMENT[state.dayMaster ?? ""] ?? "?";
    // แนบ state ไว้ใน closure ผ่าน facts ด้านล่าง — recompute ทีเดียวเก็บไว้
    (row as unknown as { __state: typeof state }).__state = state;
    complete.push({ row, dayElement });
  }

  const bank: Record<string, Array<{ dayElement: string; engine: string; shinse: string }>> = {};
  for (const topic of PREDICT) bank[topic.id] = [];

  // คัดตัวอย่างต่อบท: ไล่ดวงโดยพยายามกระจายธาตุดิถีก่อน แล้วเติมจนครบ MAX
  for (const topic of PREDICT) {
    const seenEl = new Set<string>();
    const pool = [...complete];
    const picked: typeof complete = [];
    // รอบแรก: ธาตุไม่ซ้ำ
    for (const c of pool) {
      if (picked.length >= MAX_PER_TOPIC) break;
      if (seenEl.has(c.dayElement)) continue;
      seenEl.add(c.dayElement);
      picked.push(c);
    }
    // รอบสอง: เติมที่เหลือถ้ายังไม่ครบ
    for (const c of pool) {
      if (picked.length >= MAX_PER_TOPIC) break;
      if (picked.includes(c)) continue;
      picked.push(c);
    }

    for (const { row, dayElement } of picked) {
      const state = (row as unknown as { __state: Awaited<ReturnType<typeof calculateBaziStateFromRawInput>> }).__state;
      const facts = extractChartFacts(state, row.gender);
      const engineBoxes = engineBoxesFor(topic.id, facts, map);
      const shinseBoxes = row.edits?.boxes?.[topic.id];
      if (!shinseBoxes || shinseBoxes.length === 0) continue;
      // ลบชื่อลูกค้าออกจากตัวอย่าง (กันหลุด PII) — best-effort
      const strip = (s: string) => (row.clientName ? s.split(row.clientName).join("").trim() : s);
      bank[topic.id].push({
        dayElement,
        engine: strip(boxesToMarkdown(engineBoxes)),
        shinse: strip(boxesToMarkdown(shinseBoxes)),
      });
    }
  }

  const outPath = resolve(process.cwd(), "src/lib/bazi/shinse-fewshot.generated.json");
  writeFileSync(outPath, JSON.stringify(bank, null, 2), "utf8");

  // สรุป
  const counts = PREDICT.map((t) => `${t.chapter}:${bank[t.id].length}`).join("  ");
  console.log(`ดวงเสร็จ 15/15 ที่ใช้: ${complete.length} (ธาตุ: ${[...new Set(complete.map((c) => c.dayElement))].join(",")})`);
  console.log(`ตัวอย่างต่อบท (บท:จำนวน): ${counts}`);
  console.log(`เขียนแล้ว → ${outPath}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
