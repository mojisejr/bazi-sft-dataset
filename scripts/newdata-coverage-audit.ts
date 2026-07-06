/**
 * Audit "กล่องว่าง" ของ 15 บท × 4 ดวง GT (deterministic ไม่ยิง LLM)
 * แยกให้ชัดว่ากล่องที่ว่างเป็นเพราะ:
 *   (ก) DATA GAP  — กลุ่ม NewData ที่กล่องนั้นต้องใช้ "ไม่มี row เลยใน map" → ต้องซินแสเติมข้อมูล
 *   (ข) KEY MISS  — กลุ่มมี row อยู่ แต่ key ของดวงนี้ไม่ match → resolver/ข้อมูล partial (โค้ดอาจแก้ได้)
 *   (พาร์ท) empty บางดวง = ข้อมูลมีสำหรับบางดวง แต่ key ดวงนี้ยังขาด
 *
 * Usage: npx tsx scripts/newdata-coverage-audit.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { extractChartFacts } from "@/lib/bazi/newdata-lookup";
import { resolveChapterBoxes, CHAPTER_BULLET_RESOLVERS } from "@/lib/bazi/chapter-newdata-map";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import type { NewdataMap } from "@/lib/bazi/newdata-repository";

const CHARTS = [
  { name: "ธานัท", date: "1986-06-19", time: "18:30", gender: "male" as const },
  { name: "สุพิชญ์นันท์", date: "1987-06-27", time: "18:16", gender: "female" as const },
  { name: "ภูเมธ", date: "2015-06-24", time: "12:09", gender: "male" as const },
  { name: "ศิตา", date: "2017-10-30", time: "14:09", gender: "female" as const },
];

type BoxStatus = "curated" | "template" | "empty";

/** groups ที่ box นี้ (bullet index) ต้องใช้ + resolver ที่ไม่มี group ระบุเป็น kind */
function groupsForBox(topicId: string, boxIndex: number): string[] {
  const resolvers = (CHAPTER_BULLET_RESOLVERS[topicId] ?? [])[boxIndex] ?? [];
  return resolvers.map((r) => ("group" in r && r.group ? r.group : `(${(r as { kind: string }).kind})`));
}

/** map[group] มีกี่ row (0 = กลุ่มว่าง/ไม่มีเลย) */
function rowCount(map: NewdataMap, group: string): number {
  const g = map[group];
  return g ? Object.keys(g).length : 0;
}

async function main() {
  try { process.loadEnvFile(".env"); } catch { /* ok */ }
  const map = await getNewdataMap();
  const predict = TOPIC_PATH.filter((t) => t.kind === "predict");

  // เก็บสถานะ box: key = "chapter#boxIndex" → { title, groups, statusPerChart[] }
  type BoxRec = { chapter: number; topicId: string; idx: number; title: string; groups: string[]; status: BoxStatus[] };
  const recs = new Map<string, BoxRec>();

  for (const chart of CHARTS) {
    const raw = RawInputSchema.parse({
      birthDate: chart.date, birthTime: chart.time, gender: chart.gender,
      province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziStateFromRawInput(raw);
    const facts = extractChartFacts(state, chart.gender);
    for (const topic of predict) {
      const boxes = resolveChapterBoxes(topic.id, facts, map).boxes;
      boxes.forEach((b, i) => {
        const key = `${topic.chapter}#${i}`;
        const status: BoxStatus = b.templatePrefill ? "template" : (b.body ?? "").trim() ? "curated" : "empty";
        let rec = recs.get(key);
        if (!rec) {
          rec = { chapter: topic.chapter, topicId: topic.id, idx: i, title: b.title, groups: groupsForBox(topic.id, i), status: [] };
          recs.set(key, rec);
        }
        rec.status.push(status);
      });
    }
  }

  // วินิจฉัยแต่ละ box
  const diagnosed = [...recs.values()].map((r) => {
    const emptyCount = r.status.filter((s) => s === "empty").length;
    const curatedCount = r.status.filter((s) => s === "curated").length;
    const templateCount = r.status.filter((s) => s === "template").length;
    const groupRows = r.groups.map((g) => `${g}:${rowCount(map, g)}`);
    const anyGroupHasRows = r.groups.some((g) => rowCount(map, g) > 0);
    let verdict: string;
    if (emptyCount === 0) verdict = "OK";
    else if (emptyCount === CHARTS.length) verdict = anyGroupHasRows ? "ข-KEY_MISS (ทุกดวงว่าง แต่กลุ่มมี row)" : "ก-DATA_GAP (ทุกดวงว่าง + กลุ่มไม่มี row)";
    else verdict = "พาร์ท (ว่างบางดวง — ข้อมูล partial)";
    return { ...r, emptyCount, curatedCount, templateCount, groupRows, verdict };
  });

  // สรุปรายบท
  const byChapter = new Map<number, typeof diagnosed>();
  for (const d of diagnosed) {
    const a = byChapter.get(d.chapter) ?? [];
    a.push(d);
    byChapter.set(d.chapter, a as typeof diagnosed);
  }

  const lines: string[] = [];
  const totalBoxes = diagnosed.length;
  const dataGap = diagnosed.filter((d) => d.verdict.startsWith("ก-")).length;
  const keyMiss = diagnosed.filter((d) => d.verdict.startsWith("ข-")).length;
  const partial = diagnosed.filter((d) => d.verdict.startsWith("พาร์ท")).length;
  const ok = diagnosed.filter((d) => d.verdict === "OK").length;

  lines.push(`# Audit กล่องว่าง NewData — 15 บท × 4 ดวง`);
  lines.push(`box ทั้งหมด ${totalBoxes} (นับ box ไม่ซ้ำต่อบท) · OK(เต็มทุกดวง) ${ok} · **ก-DATA_GAP ${dataGap}** · **ข-KEY_MISS ${keyMiss}** · พาร์ท ${partial}`);
  lines.push("");
  lines.push("- **ก-DATA_GAP** = กลุ่ม NewData ไม่มี row เลย → งานซินแสเติมข้อมูล");
  lines.push("- **ข-KEY_MISS** = กลุ่มมี row แต่ key ดวงไม่ match ทุกดวง → น่าจะ resolver/mapping (โค้ดอาจแก้ได้) *หรือ* ข้อมูล key นั้นขาดยกชุด");
  lines.push("- **พาร์ท** = ว่างบางดวง = ข้อมูลมีบางส่วน key บางดวงขาด");
  lines.push("");

  // ไล่บทเรียงตาม empty เยอะ→น้อย
  const chapterRank = [...byChapter.entries()]
    .map(([ch, ds]) => ({ ch, title: ds[0].topicId, ds, emptyBoxes: ds.filter((d) => d.emptyCount > 0).length, total: ds.length }))
    .sort((a, b) => b.emptyBoxes - a.emptyBoxes);

  for (const c of chapterRank) {
    const topic = TOPIC_PATH.find((t) => t.chapter === c.ch)!;
    lines.push(`## บท ${c.ch} · ${topic.title} — ว่าง ${c.emptyBoxes}/${c.total} box`);
    lines.push("| box | verdict | ว่าง/4 | curated/4 | groups (row count) |");
    lines.push("|---|---|---|---|---|");
    for (const d of c.ds) {
      lines.push(`| ${d.title.slice(0, 40)} | ${d.verdict} | ${d.emptyCount} | ${d.curatedCount} | ${d.groupRows.join(", ")} |`);
    }
    lines.push("");
  }

  mkdirSync("out/compose-eval", { recursive: true });
  const path = "out/compose-eval/coverage-audit.md";
  writeFileSync(path, lines.join("\n"), "utf8");
  console.log(`box ${totalBoxes} · OK ${ok} · ก-DATA_GAP ${dataGap} · ข-KEY_MISS ${keyMiss} · พาร์ท ${partial}`);
  console.log(`บทที่ว่างเยอะสุด: ${chapterRank.slice(0, 5).map((c) => `บท${c.ch}(${c.emptyBoxes}/${c.total})`).join(" · ")}`);
  console.log(`เขียน ${path}`);
}

void main();
