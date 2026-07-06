/**
 * Dump ข้อความจริงของบทเดียว: NewData ดิบ (excerpt) + ผล compose (AI) + GT ซินแส — ไว้ไล่ดูว่าเพี้ยนตรงไหน
 * Usage: npx tsx scripts/newdata-compose-dump.ts <ชื่อดวง prefix> <บท>
 *   npx tsx scripts/newdata-compose-dump.ts ศิตา 4
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { extractChartFacts } from "@/lib/bazi/newdata-lookup";
import { resolveChapterBoxes } from "@/lib/bazi/chapter-newdata-map";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { generateProseLlm } from "@/lib/bazi/reading-llm";
import {
  STEM_ELEMENT, boxesToMarkdown, pickFewshot, SYSTEM_MOVES, buildComposeUserPrompt,
} from "@/lib/bazi/shinse-compose";

const GT_DOC = "docs/newdata-vs-groundtruth-4charts-2026-06-25.md";
const CHARTS = [
  { name: "ธานัท จารุฤทธิไกร", date: "1986-06-19", time: "18:30", gender: "male" as const },
  { name: "สุพิชญ์นันท์ ดีพิจารณ์", date: "1987-06-27", time: "18:16", gender: "female" as const },
  { name: "ภูเมธ จารุฤทธิไกร", date: "2015-06-24", time: "12:09", gender: "male" as const },
  { name: "ศิตา จารุฤทธิไกร", date: "2017-10-30", time: "14:09", gender: "female" as const },
];

function gtFor(md: string, chartPrefix: string, chapter: number): string {
  const lines = md.split("\n");
  let chart: string | null = null, chap: number | null = null, inGt = false;
  const buf: string[] = [];
  for (const line of lines) {
    const ch = line.match(/^##\s+(.+?)\s+\(/);
    const cp = line.match(/^###\s+บท\s+(\d+)/);
    if (ch) { chart = ch[1].trim(); chap = null; inGt = false; continue; }
    if (cp) { chap = Number.parseInt(cp[1], 10); inGt = false; continue; }
    if (/^\*\*ซินแส\s*\(GT\)\s*:\*\*/.test(line)) { inGt = true; continue; }
    if (/^\*\*NewData\s*:\*\*/.test(line)) { inGt = false; continue; }
    if (inGt && chart?.startsWith(chartPrefix) && chap === chapter) buf.push(line);
  }
  return buf.join("\n").trim();
}

async function main() {
  try { process.loadEnvFile(".env"); } catch { /* ok */ }
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) { console.error("ไม่พบ GEMINI_API_KEY"); process.exit(1); }

  const prefix = (process.argv[2] ?? "").trim();
  const chapter = Number.parseInt(process.argv[3] ?? "", 10);
  const chart = CHARTS.find((c) => c.name.startsWith(prefix));
  const topic = TOPIC_PATH.find((t) => t.chapter === chapter && t.kind === "predict");
  if (!chart || !topic) { console.error("ระบุ <ชื่อดวง> <บท 1-15> ให้ถูก"); process.exit(1); }

  const map = await getNewdataMap();
  const raw = RawInputSchema.parse({
    birthDate: chart.date, birthTime: chart.time, gender: chart.gender,
    province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
  });
  const state = await calculateBaziStateFromRawInput(raw);
  const facts = extractChartFacts(state, chart.gender);
  const dayElement = STEM_ELEMENT[state.dayMaster ?? ""] ?? "?";
  const boxes = resolveChapterBoxes(topic.id, facts, map).boxes;
  const excerpt = boxesToMarkdown(boxes);
  const examples = pickFewshot(topic.id, dayElement);
  const userPrompt = buildComposeUserPrompt(topic.id, raw, state, excerpt, examples);

  let composed = "(compose ล้มเหลว)";
  try {
    const r = await generateProseLlm({
      systemInstruction: SYSTEM_MOVES, userPrompt, provider: "gemini",
      temperature: 0.5, apiKey, usageFeature: "reading_topic", usageLabel: `dump:${topic.id}`,
    });
    composed = r.text;
  } catch (e) { composed = `(compose error: ${(e as Error).message})`; }

  const gt = gtFor(readFileSync(GT_DOC, "utf8"), prefix, chapter);
  const out = [
    `# ${chart.name} · บท ${chapter} ${topic.title} · ดิถี ${state.dayMaster} (${dayElement})`,
    `few-shot: ${examples.map((e) => e.dayElement).join(",") || "ไม่มี"}${examples.some((e) => e.dayElement === dayElement) ? "" : " (ต่างธาตุ)"}`,
    `\n════════ 1) NewData ดิบ (excerpt ที่ป้อน AI) ════════\n${excerpt}`,
    `\n════════ 2) ผล COMPOSE (AI) ════════\n${composed}`,
    `\n════════ 3) GT ซินแส (เอกสาร — อาจถูกตัดท้าย) ════════\n${gt || "(ไม่พบ GT)"}`,
  ].join("\n");

  mkdirSync("out/compose-eval", { recursive: true });
  const path = `out/compose-eval/dump-${prefix}-${chapter}.md`;
  writeFileSync(path, out, "utf8");
  console.log(out);
  console.error(`\n[เขียน ${path}]`);
}

void main();
