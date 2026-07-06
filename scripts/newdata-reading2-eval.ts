/**
 * วัด "ความครบถ้วน/ครบมุม" ของแท็บ v2 (Louise Hay) เทียบคำอ่านจริงซินแส 3 ดวง (ศิตา/ภูเมธ/ธานัท)
 *
 * สะท้อนพฤติกรรม UI จริง: บทที่ไม่มีข้อมูล NewData (hasContent=false) = ถูกข้าม (ปุ่ม "ทั้ง 15 บท" ข้าม)
 * บทที่มีข้อมูล = gen ด้วย persona Louise Hay แล้วให้ LLM-judge คะแนน coverage/faithfulness/tone เทียบ GT
 *
 * Usage: npx tsx scripts/newdata-reading2-eval.ts
 * Output: out/compose-eval/reading2-eval.md
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { extractChartFacts } from "@/lib/bazi/newdata-lookup";
import { resolveChapterBoxes } from "@/lib/bazi/chapter-newdata-map";
import { getNewdataMap } from "@/lib/bazi/newdata.server";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { generateProseLlm } from "@/lib/bazi/reading-llm";
import { buildLouiseReadingPrompt } from "@/lib/bazi/louise-reading";
import { createGeminiScorer, type JudgeScore } from "./lib/reading-similarity";

const GT_DOC = "docs/newdata-vs-groundtruth-4charts-2026-06-25.md";
const CHARTS = [
  { name: "ศิตา จารุฤทธิไกร", date: "2017-10-30", time: "14:09", gender: "female" as const },
  { name: "ภูเมธ จารุฤทธิไกร", date: "2015-06-24", time: "12:09", gender: "male" as const },
  { name: "ธานัท จารุฤทธิไกร", date: "1986-06-19", time: "18:30", gender: "male" as const },
];

function parseGt(md: string): Map<string, Map<number, string>> {
  const out = new Map<string, Map<number, string>>();
  let chart: string | null = null, chap: number | null = null, inGt = false;
  let buf: string[] = [];
  const flush = () => {
    if (chart && chap != null && buf.length) {
      const m = out.get(chart) ?? new Map<number, string>();
      m.set(chap, buf.join("\n").trim());
      out.set(chart, m);
    }
    buf = [];
  };
  for (const line of md.split("\n")) {
    const ch = line.match(/^##\s+(.+?)\s+\(/);
    const cp = line.match(/^###\s+บท\s+(\d+)/);
    if (ch) { flush(); chart = ch[1].trim(); chap = null; inGt = false; continue; }
    if (cp) { flush(); chap = Number.parseInt(cp[1], 10); inGt = false; continue; }
    if (/^\*\*ซินแส\s*\(GT\)\s*:\*\*/.test(line)) { inGt = true; continue; }
    if (/^\*\*NewData\s*:\*\*/.test(line)) { flush(); inGt = false; continue; }
    if (inGt) buf.push(line);
  }
  flush();
  return out;
}

type Row = { chart: string; chapter: number; title: string; generated: boolean; hadContent: boolean; judge?: JudgeScore; len: number };

async function main() {
  try { process.loadEnvFile(".env"); } catch {}
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) { console.error("ไม่พบ GEMINI_API_KEY"); process.exit(1); }

  const gt = parseGt(readFileSync(GT_DOC, "utf8"));
  const map = await getNewdataMap();
  const scorer = createGeminiScorer({ apiKey });
  const predict = TOPIC_PATH.filter((t) => t.kind === "predict");
  const rows: Row[] = [];

  for (const chart of CHARTS) {
    const gtCh = gt.get(chart.name);
    const raw = RawInputSchema.parse({
      birthDate: chart.date, birthTime: chart.time, gender: chart.gender,
      province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziStateFromRawInput(raw);
    const facts = extractChartFacts(state, chart.gender);
    process.stderr.write(`\n=== ${chart.name} · ดิถี ${state.dayMaster} ===\n`);

    for (const topic of predict) {
      const resolved = resolveChapterBoxes(topic.id, facts, map);
      const hadContent = resolved.hasContent; // v2 ใหม่: เขียนทุกบท (บทว่าง = persona เล่ากว้าง ๆ ไม่ฟันธง)
      const { systemInstruction, userPrompt } = buildLouiseReadingPrompt({ topicId: topic.id, rawInput: raw, state, boxes: resolved.boxes });
      let text = "";
      try {
        const r = await generateProseLlm({ systemInstruction, userPrompt, provider: "gemini", temperature: 0.85, apiKey, usageFeature: "reading_topic", usageLabel: `reading2-eval:${topic.id}` });
        text = r.text;
      } catch (e) {
        process.stderr.write(`    บท ${topic.chapter}: gen ล้ม — ${(e as Error).message}\n`);
        rows.push({ chart: chart.name, chapter: topic.chapter, title: topic.title, generated: false, hadContent, len: 0 });
        continue;
      }
      const gtText = gtCh?.get(topic.chapter);
      let judge: JudgeScore | undefined;
      if (gtText) {
        for (let attempt = 0; attempt < 3 && !judge; attempt++) {
          try { judge = await scorer.llmJudge(text, gtText); }
          catch { /* 503/transient — ลองใหม่ แล้วข้ามคะแนนถ้ายังไม่ได้ */ }
        }
      }
      rows.push({ chart: chart.name, chapter: topic.chapter, title: topic.title, generated: true, hadContent, judge, len: text.length });
      process.stderr.write(`    บท ${String(topic.chapter).padStart(2)} ${topic.title.slice(0, 20).padEnd(20)}${hadContent ? "" : " [ว่าง→เดา]"} ${judge ? `cov ${judge.coverage} · faith ${judge.faithfulness} · tone ${judge.tone}` : "(ไม่มี GT เทียบ)"}\n`);
    }
  }

  // สรุป
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const gen = rows.filter((r) => r.generated);
  const judged = gen.filter((r) => r.judge);
  const emptySource = gen.filter((r) => !r.hadContent).length;
  const lines: string[] = [];
  lines.push(`# v2 (Louise Hay) — ความครบถ้วน/ครบมุม เทียบซินแส 3 ดวง (path1+2)`);
  lines.push(`gen สำเร็จ ${gen.length}/${rows.length} บท · ในนั้นเป็นบทว่าง→เดา ${emptySource} บท · gen ล้ม ${rows.length - gen.length} บท`);
  lines.push(`เฉลี่ย (บทที่มี GT เทียบ): coverage **${avg(judged.map((r) => r.judge!.coverage)).toFixed(0)}** · faithfulness ${avg(judged.map((r) => r.judge!.faithfulness)).toFixed(0)} · tone ${avg(judged.map((r) => r.judge!.tone)).toFixed(0)}`);
  lines.push("");
  for (const chart of CHARTS) {
    const rs = rows.filter((r) => r.chart === chart.name);
    const g = rs.filter((r) => r.generated);
    lines.push(`## ${chart.name} — gen ${g.length}/${rs.length} บท${g.length === rs.length ? " · ครบทุกบท ✅" : ""}`);
    lines.push("| บท | หัวข้อ | สถานะ | coverage | faith | tone | ตัวอักษร |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const r of rs) {
      const st = !r.generated ? "❌ ล้ม" : r.hadContent ? "✅ gen" : "✅ gen (ว่าง→เดา)";
      const j = r.judge;
      lines.push(`| ${r.chapter} | ${r.title.slice(0, 24)} | ${st} | ${j ? j.coverage : "-"} | ${j ? j.faithfulness : "-"} | ${j ? j.tone : "-"} | ${r.len || "-"} |`);
    }
    lines.push("");
  }

  mkdirSync("out/compose-eval", { recursive: true });
  const path = "out/compose-eval/reading2-eval.md";
  writeFileSync(path, lines.join("\n"), "utf8");
  console.log(`\ngen ${gen.length}/${rows.length} · coverage เฉลี่ย ${avg(judged.map((r) => r.judge!.coverage)).toFixed(0)} · เขียน ${path}`);
  for (const chart of CHARTS) {
    const rs = rows.filter((r) => r.chart === chart.name);
    const skipped = rs.filter((r) => !r.generated).map((r) => `บท${r.chapter}`);
    console.log(`  ${chart.name.split(" ")[0]}: gen ${rs.filter((r) => r.generated).length}/${rs.length}${skipped.length ? ` (ข้าม ${skipped.join(",")})` : " ครบ"}`);
  }
}

void main();
