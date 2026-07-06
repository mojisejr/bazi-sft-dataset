/**
 * ชุดวัดผล "compose" (NewData ดิบ → AI ถอดแบบซินแส) เทียบกับคำอ่านจริงซินแส (ground-truth)
 *
 * เป้าหมาย: รู้ว่า "ตอนนี้ AI ใกล้ซินแสแค่ไหน บทไหนยังห่างสุด" เพื่อไล่เติม few-shot / แก้ hint แบบมีเป้า
 * (ตามแผนข้อ 2 — วัดก่อนแก้)
 *
 * ทำงาน: สำหรับแต่ละดวง GT → รันไปป์ไลน์จริง (resolveChapterBoxes → compose prompt เดียวกับแอป →
 * generateProseLlm) แล้วให้คะแนนเทียบ GT รายบท ด้วย embedding-cosine + LLM-judge (faithfulness/tone/coverage)
 *
 * GT source: docs/newdata-vs-groundtruth-4charts-2026-06-25.md
 *   ⚠️ หมายเหตุ: GT ในเอกสารนี้ถูก "ตัดท้าย" ต่อกล่อง (ยาวไม่ครบ) — coverage score จึงเป็นค่าประมาณ
 *      (undercount ได้) แต่ tone/faithfulness ยังสะท้อนสไตล์ได้ดี. ถ้ามี GT เต็มจาก DB ค่อยสลับ source ทีหลัง
 *
 * Usage:
 *   npx tsx scripts/newdata-compose-eval.ts               # ทุกดวง ทุกบท
 *   npx tsx scripts/newdata-compose-eval.ts ธานัท          # เฉพาะดวงที่ชื่อขึ้นต้นด้วย ...
 *   npx tsx scripts/newdata-compose-eval.ts "" 3           # ทุกดวง เฉพาะบท 3
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
  STEM_ELEMENT,
  boxesToMarkdown,
  pickFewshot,
  SYSTEM_MOVES,
  buildComposeUserPrompt,
} from "@/lib/bazi/shinse-compose";
import { createGeminiScorer, type JudgeScore } from "./lib/reading-similarity";

const GT_DOC = "docs/newdata-vs-groundtruth-4charts-2026-06-25.md";

/** เพศไม่ได้อยู่ในหัวเอกสาร — กำหนดตรงนี้ (แก้ได้ถ้าผิด). ชื่อต้องตรง prefix กับหัว "## <ชื่อ> (" ในเอกสาร */
const CHARTS = [
  { name: "ธานัท จารุฤทธิไกร", date: "1986-06-19", time: "18:30", gender: "male" as const },
  { name: "สุพิชญ์นันท์ ดีพิจารณ์", date: "1987-06-27", time: "18:16", gender: "female" as const },
  { name: "ภูเมธ จารุฤทธิไกร", date: "2015-06-24", time: "12:09", gender: "male" as const },
  { name: "ศิตา จารุฤทธิไกร", date: "2017-10-30", time: "14:09", gender: "female" as const },
];

/** parse เอกสาร GT → { chartName → { chapterNum → gtText } } */
function parseGroundTruth(md: string): Map<string, Map<number, string>> {
  const out = new Map<string, Map<number, string>>();
  let chart: string | null = null;
  let chapter: number | null = null;
  let inGt = false;
  let buf: string[] = [];

  const flush = () => {
    if (chart && chapter != null && buf.length) {
      const m = out.get(chart) ?? new Map<number, string>();
      m.set(chapter, buf.join("\n").trim());
      out.set(chart, m);
    }
    buf = [];
  };

  for (const line of md.split("\n")) {
    const chartHead = line.match(/^##\s+(.+?)\s+\(/);
    const chapHead = line.match(/^###\s+บท\s+(\d+)/);
    if (chartHead) {
      flush();
      chart = chartHead[1].trim();
      chapter = null;
      inGt = false;
      continue;
    }
    if (chapHead) {
      flush();
      chapter = Number.parseInt(chapHead[1], 10);
      inGt = false;
      continue;
    }
    if (/^\*\*ซินแส\s*\(GT\)\s*:\*\*/.test(line)) {
      inGt = true;
      continue;
    }
    if (/^\*\*NewData\s*:\*\*/.test(line)) {
      flush();
      inGt = false;
      continue;
    }
    if (inGt) buf.push(line);
  }
  flush();
  return out;
}

type Row = {
  chart: string;
  chapter: number;
  topicId: string;
  title: string;
  dayElement: string;
  fewshotMatched: boolean; // few-shot มีธาตุตรงดวงนี้ไหม
  cosine: number;
  judge: JudgeScore;
  composedLen: number;
  gtLen: number;
};

async function main() {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* ใช้ env ที่ตั้งไว้แล้ว */
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error("ไม่พบ GEMINI_API_KEY ใน .env");
    process.exit(1);
  }

  const chartFilter = (process.argv[2] ?? "").trim();
  const chapterFilter = Number.parseInt(process.argv[3] ?? "", 10); // NaN = ทุกบท

  const gt = parseGroundTruth(readFileSync(GT_DOC, "utf8"));
  const map = await getNewdataMap();
  const scorer = createGeminiScorer({ apiKey });
  const predictTopics = TOPIC_PATH.filter((t) => t.kind === "predict");

  const rows: Row[] = [];
  for (const chart of CHARTS) {
    if (chartFilter && !chart.name.startsWith(chartFilter)) continue;
    const gtChapters = gt.get(chart.name);
    if (!gtChapters) {
      console.error(`  ⚠️ ไม่พบ GT ของ "${chart.name}" ในเอกสาร — ข้าม`);
      continue;
    }
    const raw = RawInputSchema.parse({
      birthDate: chart.date, birthTime: chart.time, gender: chart.gender,
      province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziStateFromRawInput(raw);
    const facts = extractChartFacts(state, chart.gender);
    const dayElement = STEM_ELEMENT[state.dayMaster ?? ""] ?? "?";
    process.stderr.write(`\n=== ${chart.name} · ดิถี ${state.dayMaster} (${dayElement}) ===\n`);

    for (const topic of predictTopics) {
      if (!Number.isNaN(chapterFilter) && topic.chapter !== chapterFilter) continue;
      const gtText = gtChapters.get(topic.chapter);
      if (!gtText) continue;

      const boxes = resolveChapterBoxes(topic.id, facts, map).boxes;
      const excerpt = boxesToMarkdown(boxes);
      if (!excerpt.trim()) continue;

      const examples = pickFewshot(topic.id, dayElement);
      const fewshotMatched = examples.some((e) => e.dayElement === dayElement);
      const userPrompt = buildComposeUserPrompt(topic.id, raw, state, excerpt, examples);

      let composed = "";
      try {
        const r = await generateProseLlm({
          systemInstruction: SYSTEM_MOVES, userPrompt,
          provider: "gemini", temperature: 0.5, apiKey,
          usageFeature: "reading_topic", usageLabel: `eval:${topic.id}`,
        });
        composed = r.text;
      } catch (e) {
        console.error(`    บท ${topic.chapter} ${topic.id}: compose ล้มเหลว — ${(e as Error).message}`);
        continue;
      }

      const [cosine, judge] = await Promise.all([
        scorer.embeddingCosine(composed, gtText),
        scorer.llmJudge(composed, gtText),
      ]);
      rows.push({
        chart: chart.name, chapter: topic.chapter, topicId: topic.id, title: topic.title,
        dayElement, fewshotMatched, cosine, judge,
        composedLen: composed.length, gtLen: gtText.length,
      });
      process.stderr.write(
        `    บท ${String(topic.chapter).padStart(2)} ${topic.title.slice(0, 18).padEnd(18)} ` +
        `overall ${judge.overall} · faith ${judge.faithfulness} · tone ${judge.tone} · cov ${judge.coverage} · cos ${(cosine * 100).toFixed(0)}` +
        `${fewshotMatched ? "" : "  ⚠️ few-shot ต่างธาตุ"}\n`,
      );
    }
  }

  if (rows.length === 0) {
    console.error("ไม่มีผลลัพธ์ (ตรวจ filter / GT / GEMINI_API_KEY)");
    process.exit(1);
  }

  // ── สรุปรายบท (เฉลี่ยข้ามดวง) หา "บทที่อ่อนสุด" ──
  const byChapter = new Map<number, Row[]>();
  for (const r of rows) {
    const a = byChapter.get(r.chapter) ?? [];
    a.push(r);
    byChapter.set(r.chapter, a);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const chapterSummary = [...byChapter.entries()]
    .map(([chapter, rs]) => ({
      chapter,
      title: rs[0].title,
      overall: avg(rs.map((r) => r.judge.overall)),
      faithfulness: avg(rs.map((r) => r.judge.faithfulness)),
      tone: avg(rs.map((r) => r.judge.tone)),
      coverage: avg(rs.map((r) => r.judge.coverage)),
      cosine: avg(rs.map((r) => r.cosine)) * 100,
      n: rs.length,
    }))
    .sort((a, b) => a.overall - b.overall); // อ่อนสุดขึ้นก่อน

  const overallAll = avg(rows.map((r) => r.judge.overall));
  const matchedAvg = avg(rows.filter((r) => r.fewshotMatched).map((r) => r.judge.overall));
  const unmatchedRows = rows.filter((r) => !r.fewshotMatched);
  const unmatchedAvg = avg(unmatchedRows.map((r) => r.judge.overall));

  // ── เขียนรายงาน ──
  mkdirSync("out/compose-eval", { recursive: true });
  const stamp = process.env.EVAL_STAMP || "latest";
  const lines: string[] = [];
  lines.push(`# ชุดวัดผล compose vs ซินแส GT — ${stamp}`);
  lines.push(`ดวง ${[...new Set(rows.map((r) => r.chart))].length} · บท ${rows.length} รายการ · overall เฉลี่ยรวม **${overallAll.toFixed(1)}**/100`);
  lines.push("");
  lines.push(`few-shot ตรงธาตุ: ${overallAll ? matchedAvg.toFixed(1) : "-"} (${rows.length - unmatchedRows.length} บท) · few-shot ต่างธาตุ: ${unmatchedRows.length ? unmatchedAvg.toFixed(1) : "-"} (${unmatchedRows.length} บท)`);
  if (unmatchedRows.length) {
    const els = [...new Set(unmatchedRows.map((r) => r.dayElement))].join(", ");
    lines.push(`> ⚠️ ${unmatchedRows.length} บทใช้ few-shot ต่างธาตุ (ดิถี ${els} ที่ bank ยังไม่มี) — ถ้าคะแนนกลุ่มนี้ต่ำกว่า แสดงว่าควรเติม few-shot ธาตุนี้`);
  }
  lines.push("");
  lines.push("## รายบท (อ่อนสุด → ดีสุด)");
  lines.push("| บท | หัวข้อ | overall | faithful | tone | coverage | cosine | n |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const c of chapterSummary) {
    lines.push(`| ${c.chapter} | ${c.title} | **${c.overall.toFixed(0)}** | ${c.faithfulness.toFixed(0)} | ${c.tone.toFixed(0)} | ${c.coverage.toFixed(0)} | ${c.cosine.toFixed(0)} | ${c.n} |`);
  }
  lines.push("");
  lines.push("## รายรายการ (ทุกดวง × ทุกบท)");
  lines.push("| ดวง | ธาตุ | บท | overall | faithful | tone | coverage | cosine | few-shot |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const r of rows.sort((a, b) => a.chapter - b.chapter || a.chart.localeCompare(b.chart))) {
    lines.push(`| ${r.chart.split(" ")[0]} | ${r.dayElement} | ${r.chapter} | ${r.judge.overall} | ${r.judge.faithfulness} | ${r.judge.tone} | ${r.judge.coverage} | ${(r.cosine * 100).toFixed(0)} | ${r.fewshotMatched ? "ตรง" : "ต่างธาตุ"} |`);
  }

  const mdPath = `out/compose-eval/${stamp}.md`;
  const jsonPath = `out/compose-eval/${stamp}.json`;
  writeFileSync(mdPath, lines.join("\n"), "utf8");
  writeFileSync(jsonPath, JSON.stringify({ overallAll, matchedAvg, unmatchedAvg, chapterSummary, rows }, null, 2), "utf8");
  console.log(`\noverall เฉลี่ยรวม ${overallAll.toFixed(1)}/100 · เขียน ${mdPath}`);
  console.log(`บทที่อ่อนสุด 3 อันดับ: ${chapterSummary.slice(0, 3).map((c) => `บท${c.chapter}(${c.overall.toFixed(0)})`).join(" · ")}`);
}

void main();
