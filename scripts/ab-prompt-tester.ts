/**
 * A/B tester (semi-auto): รัน prompt variant หลายตัว × ground(technical|consumer) × cases × topics
 * ผ่าน Gemini แล้ววัดความใกล้ gptCase output ด้วย embedding cosine (+ LLM-judge)
 * ออก out/ab/leaderboard.md + out/ab/diffs/<...>.md ให้รีวิวแล้วปรับ prompt วนซ้ำ
 *
 * Usage:
 *   npx tsx scripts/ab-prompt-tester.ts --variants baseline,gptcase-tuned --ground both \
 *     --cases 1,5 --topics chart_foundation,wealth_and_investment --judge on --model gemini-3-flash-preview
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { buildDayMasterRelationPacket } from "@/lib/bazi/day-master-relation-reading-poc";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { buildTopicEngineReading, type TopicEngineReading } from "@/lib/bazi/topic-reading";
import {
  buildTopicHumanReading,
  buildTopicConsumerReading,
  getTopicKnowledgeSourceLabel,
} from "@/lib/bazi/topic-knowledge";
import {
  generateReadingTopicLlm,
  BASELINE_PROFILE,
  type ReadingPromptProfile,
} from "@/lib/bazi/reading-llm";
import {
  GPTCASE_TUNED_PROFILE,
  GPTCASE_TUNED_V2_PROFILE,
} from "@/lib/bazi/reading-prompt-profiles";

/** รีจิสทรีโปรไฟล์สำหรับ A/B (เลือกด้วย --variants <id,...>) */
const PROMPT_PROFILES: Record<string, ReadingPromptProfile> = {
  baseline: BASELINE_PROFILE,
  "gptcase-tuned": GPTCASE_TUNED_PROFILE,
  "gptcase-tuned-v2": GPTCASE_TUNED_V2_PROFILE,
};

import { GPTCASE_MANIFEST, loadGptCaseChapters } from "./lib/gptcase-cases";
import {
  combinedScore,
  createGeminiScorer,
  type JudgeScore,
} from "./lib/reading-similarity";

type Ground = "technical" | "consumer";

function parseFlags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[(i += 1)] : "true";
      out[key] = val;
    }
  }
  return out;
}

function engineSignalsFor(reading: TopicEngineReading): string[] {
  return [
    `หลักการอ่าน: ${reading.lens}`,
    ...reading.table.map((row) => `${row.sourceSymbol} → ${row.pointsTo}: ${row.relationResult}`),
    ...reading.prose,
  ];
}

const ALL_PREDICT = TOPIC_PATH.filter((t) => t.kind === "predict").map((t) => t.id);

type RowResult = {
  variant: string;
  ground: Ground;
  caseName: string;
  topicId: string;
  cosine: number;
  judge: JudgeScore | null;
  combined: number;
  candidate: string;
  reference: string;
  model: string;
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

  const flags = parseFlags(process.argv.slice(2));
  const variants = (flags.variants ?? "baseline,gptcase-tuned").split(",").map((s) => s.trim());
  const groundFlag = (flags.ground ?? "both") as Ground | "both";
  const grounds: Ground[] = groundFlag === "both" ? ["technical", "consumer"] : [groundFlag];
  const caseIdx = (flags.cases ?? "1")
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10) - 1)
    .filter((n) => n >= 0 && n < GPTCASE_MANIFEST.length);
  const topics = !flags.topics || flags.topics === "all" ? ALL_PREDICT : flags.topics.split(",").map((s) => s.trim());
  const useJudge = (flags.judge ?? "on") !== "off";
  const genModel = flags.model ?? "gemini-3-flash-preview";
  const diffBottom = Number.parseInt(flags["diff-bottom"] ?? "12", 10);
  const limit = flags.limit ? Number.parseInt(flags.limit, 10) : Infinity;

  for (const v of variants) {
    if (!PROMPT_PROFILES[v]) {
      console.error(`ไม่รู้จัก variant: ${v} (มี: ${Object.keys(PROMPT_PROFILES).join(",")})`);
      process.exit(1);
    }
  }

  const scorer = createGeminiScorer({ apiKey, judgeModel: genModel });
  const results: RowResult[] = [];

  // คำนวณดวง + ground + gptCase chapters ของแต่ละเคสไว้ล่วงหน้า (ใช้ซ้ำทุก variant)
  const prepared = [] as Array<{
    name: string;
    raw: ReturnType<typeof RawInputSchema.parse>;
    state: Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>;
    packet: ReturnType<typeof buildDayMasterRelationPacket>;
    gpt: Record<string, string>;
  }>;
  for (const idx of caseIdx) {
    const c = GPTCASE_MANIFEST[idx];
    const raw = RawInputSchema.parse({
      birthDate: c.birthDate, birthTime: c.birthTime, gender: c.gender,
      province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziStateFromRawInput(raw);
    prepared.push({
      name: c.name, raw, state,
      packet: buildDayMasterRelationPacket(state),
      gpt: loadGptCaseChapters(c.outputTxt),
    });
  }

  let count = 0;
  outer: for (const variant of variants) {
    for (const ground of grounds) {
      for (const p of prepared) {
        for (const topicId of topics) {
          if (count >= limit) break outer;
          const reference = p.gpt[topicId];
          if (!reference) continue; // gptCase ไม่มีบทนี้
          const groundText =
            ground === "consumer"
              ? buildTopicConsumerReading(p.state, topicId, p.raw)
              : buildTopicHumanReading(p.state, topicId, p.raw);
          if (!groundText) continue;
          const engineReading = buildTopicEngineReading(p.state, topicId, p.packet);

          let candidate = "(generate ไม่สำเร็จ)";
          let model = genModel;
          try {
            const llm = await generateReadingTopicLlm({
              topicId, rawInput: p.raw, calculatedState: p.state,
              humanKnowledge: groundText,
              sourceLabel: getTopicKnowledgeSourceLabel(topicId),
              engineSignals: engineSignalsFor(engineReading),
              apiKey, provider: "gemini", model: genModel,
              profile: PROMPT_PROFILES[variant],
            });
            candidate = llm.text;
            model = llm.model;
          } catch (error) {
            candidate = `(error: ${(error as Error).message})`;
          }

          const cosine = await scorer.embeddingCosine(candidate, reference);
          let judge: JudgeScore | null = null;
          if (useJudge) {
            try {
              judge = await scorer.llmJudge(candidate, reference);
            } catch {
              judge = null;
            }
          }
          const combined = combinedScore(cosine, judge?.overall ?? null);
          results.push({ variant, ground, caseName: p.name, topicId, cosine, judge, combined, candidate, reference, model });
          count += 1;
          process.stderr.write(
            `[${count}] ${variant}/${ground}/${p.name}/${topicId} cos=${cosine.toFixed(3)} judge=${judge?.overall ?? "-"} comb=${combined.toFixed(1)}\n`,
          );
        }
      }
    }
  }

  writeLeaderboard(results);
  writeDiffs(results, diffBottom);
  console.log(`เสร็จ ${results.length} แถว → out/ab/leaderboard.md + out/ab/diffs/`);
}

function avg(ns: number[]): number {
  return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0;
}

function writeLeaderboard(results: RowResult[]) {
  mkdirSync("out/ab", { recursive: true });
  const groups = new Map<string, RowResult[]>();
  for (const r of results) {
    const k = `${r.variant} · ${r.ground}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const lines: string[] = ["# A/B leaderboard (ใกล้ gptCase ยิ่งสูงยิ่งดี)", ""];
  lines.push("## สรุปต่อ variant × ground", "");
  lines.push("| variant · ground | n | combined | cosine | judge.overall |");
  lines.push("|---|---|---|---|---|");
  const ranked = [...groups.entries()].sort(
    (a, b) => avg(b[1].map((r) => r.combined)) - avg(a[1].map((r) => r.combined)),
  );
  for (const [k, rows] of ranked) {
    lines.push(
      `| ${k} | ${rows.length} | ${avg(rows.map((r) => r.combined)).toFixed(1)} | ${avg(rows.map((r) => r.cosine)).toFixed(3)} | ${
        rows.some((r) => r.judge) ? avg(rows.filter((r) => r.judge).map((r) => r.judge!.overall)).toFixed(1) : "-"
      } |`,
    );
  }
  lines.push("", "## ต่อ topic (combined เฉลี่ยข้ามเคส)", "");
  lines.push("| topic | " + ranked.map(([k]) => k).join(" | ") + " |");
  lines.push("|---|" + ranked.map(() => "---").join("|") + "|");
  const topicSet = [...new Set(results.map((r) => r.topicId))];
  for (const t of topicSet) {
    const cells = ranked.map(([k]) => {
      const rows = groups.get(k)!.filter((r) => r.topicId === t);
      return rows.length ? avg(rows.map((r) => r.combined)).toFixed(1) : "-";
    });
    lines.push(`| ${t} | ${cells.join(" | ")} |`);
  }
  writeFileSync("out/ab/leaderboard.md", lines.join("\n"), "utf8");
}

function writeDiffs(results: RowResult[], bottom: number) {
  mkdirSync("out/ab/diffs", { recursive: true });
  const worst = [...results].sort((a, b) => a.combined - b.combined).slice(0, bottom);
  for (const r of worst) {
    const name = `${r.variant}-${r.ground}-${r.caseName}-${r.topicId}`.replace(/[^\w\-ก-๙]/g, "_");
    writeFileSync(
      `out/ab/diffs/${name}.md`,
      `# ${r.variant} · ${r.ground} · ${r.caseName} · ${r.topicId}\n` +
        `combined=${r.combined.toFixed(1)} cosine=${r.cosine.toFixed(3)} judge=${JSON.stringify(r.judge)} model=${r.model}\n\n` +
        `## 🟩 CANDIDATE (LLM)\n\n${r.candidate}\n\n---\n\n## 🟦 REFERENCE (gptCase)\n\n${r.reference}\n`,
      "utf8",
    );
  }
}

void main();
