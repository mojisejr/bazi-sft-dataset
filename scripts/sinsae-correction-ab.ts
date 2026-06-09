/**
 * A/B test: คำแก้ของซินแสบนดวงหนึ่ง "มีผลกับดวงอื่น" หรือไม่ และมีผลอย่างไร
 *
 * Part 1 — Gating: fingerprint ของผล engine ต่อบท ข้ามหลายดวง → ดวงที่ fingerprint ตรงกัน
 *          เท่านั้นที่จะได้คำซินแสเดิมมาเป็นตัวอย่าง (ดวงอื่นไม่เกี่ยว)
 * Part 2 — Effect: ดวงเป้าหมายบทเดียวกัน รัน Gemini 2 แบบ
 *          A = ไม่มีคำซินแส (control) · B = ใส่คำซินแสจากดวงคล้าย (treatment)
 *          วัด cosine ของผลเทียบ "คำซินแส" → ถ้า B ใกล้กว่า A = ดึงสำนวนซินแสได้จริง
 *          + ตรวจว่าผล B ยังคงอักษรดิถีของดวงเป้าหมาย (ไม่ลอกข้อเท็จจริงดวงอื่น)
 *
 * Usage: npx tsx scripts/sinsae-correction-ab.ts [--topic chart_foundation]
 */
import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { buildDayMasterRelationPacket } from "@/lib/bazi/day-master-relation-reading-poc";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { buildTopicEngineReading, type TopicEngineReading } from "@/lib/bazi/topic-reading";
import {
  buildTopicConsumerReading,
  buildTopicHumanReading,
  getTopicKnowledgeSourceLabel,
} from "@/lib/bazi/topic-knowledge";
import { generateReadingTopicLlm } from "@/lib/bazi/reading-llm";
import { GPTCASE_TUNED_PROFILE } from "@/lib/bazi/reading-prompt-profiles";
import { readingFingerprint } from "@/lib/bazi/sinsae-corrections";

import { GPTCASE_MANIFEST } from "./lib/gptcase-cases";
import { createGeminiScorer } from "./lib/reading-similarity";

function engineSignalsFor(reading: TopicEngineReading): string[] {
  return [
    `หลักการอ่าน: ${reading.lens}`,
    ...reading.table.map((row) => `${row.sourceSymbol} → ${row.pointsTo}: ${row.relationResult}`),
    ...reading.prose,
  ];
}

// คำซินแส (สมมุติว่าซินแสแก้ดวงหนึ่งไว้) — ใส่ "วลีลายเซ็น" ที่ผิดแผกพอจะตรวจการถ่ายทอดได้
const SINSAE_EDIT = [
  "หัวใจของดวงนี้คือ \"ผู้ปิดทองหลังพระที่คนทั้งระบบขาดไม่ได้\" — คุณไม่ได้เด่นด้วยการพูด แต่เด่นด้วยการลงมือทำให้ทุกอย่างเข้าที่",
  "ซินแสขอเน้นย้ำเป็นพิเศษว่า จุดแข็งจริง ๆ ของคุณอยู่ที่ \"ความนิ่งและความรับผิดชอบที่ไว้ใจได้\" ไม่ใช่ความฉูดฉาด",
  "⚠️ สิ่งที่ควรระวัง: อย่าแบกของคนอื่นจนลืมขีดเส้นให้ตัวเอง",
].join("\n\n");

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
  const topicId = flags.topic ?? "chart_foundation";
  const model = flags.model ?? "gemini-3-flash-preview";

  // เตรียมดวงทั้งหมด (ตัด birth data ซ้ำออก)
  const seen = new Set<string>();
  const charts = [] as Array<{
    name: string;
    raw: ReturnType<typeof RawInputSchema.parse>;
    state: Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>;
    reading: TopicEngineReading;
    fingerprint: string;
  }>;
  for (const c of GPTCASE_MANIFEST) {
    const sig = `${c.birthDate}|${c.birthTime}|${c.gender}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    const raw = RawInputSchema.parse({
      birthDate: c.birthDate, birthTime: c.birthTime, gender: c.gender,
      province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziStateFromRawInput(raw);
    const packet = buildDayMasterRelationPacket(state);
    const reading = buildTopicEngineReading(state, topicId, packet);
    charts.push({ name: c.name, raw, state, reading, fingerprint: readingFingerprint(reading) });
  }

  // ---- Part 1: gating report ----
  console.log(`\n=== Part 1: fingerprint ของบท "${topicId}" ต่อดวง (ดวง fingerprint ตรงกัน = ได้คำซินแสร่วมกัน) ===`);
  const groups = new Map<string, string[]>();
  for (const ch of charts) {
    const short = ch.fingerprint.length > 70 ? `${ch.fingerprint.slice(0, 70)}…` : ch.fingerprint;
    console.log(`  ${ch.name.padEnd(16)} day=${ch.state.dayMaster}  fp=${short}`);
    (groups.get(ch.fingerprint) ?? groups.set(ch.fingerprint, []).get(ch.fingerprint)!).push(ch.name);
  }
  console.log("\n  กลุ่มที่ fingerprint ตรงกัน (จะแชร์คำซินแสกัน):");
  let sharedPairFound = false;
  for (const [, names] of groups) {
    if (names.length > 1) {
      sharedPairFound = true;
      console.log(`   • ${names.join(", ")}  ← แก้ดวงหนึ่ง อีกดวงได้คำนี้เป็นตัวอย่างตอนทำนาย LLM`);
    }
  }
  if (!sharedPairFound) {
    console.log("   • (ชุดตัวอย่างนี้ไม่มีคู่ fingerprint ตรงกัน → การแก้แต่ละดวงไม่กระทบกันเลย)");
  }
  console.log(`\n  สรุป gating: ดวงที่ผล engine ต่างกัน (fingerprint คนละค่า) → แก้แล้ว "ไม่มีผล" ต่อกัน`);

  // ---- Part 2: LLM A/B บนดวงเป้าหมาย ----
  const target = charts[0];
  const groundText =
    buildTopicConsumerReading(target.state, topicId, target.raw) ??
    buildTopicHumanReading(target.state, topicId, target.raw);
  const sourceLabel = getTopicKnowledgeSourceLabel(topicId);
  const engineSignals = engineSignalsFor(target.reading);
  const dayChar = target.state.dayMaster?.[0] ?? "";

  console.log(`\n=== Part 2: A/B บนดวงเป้าหมาย "${target.name}" (day=${target.state.dayMaster}) บท "${topicId}" ===`);

  const base = {
    topicId, rawInput: target.raw, calculatedState: target.state,
    humanKnowledge: groundText, sourceLabel, engineSignals,
    apiKey, provider: "gemini" as const, model, profile: GPTCASE_TUNED_PROFILE,
  };

  const [controlRes, treatmentRes] = [
    await generateReadingTopicLlm(base),
    await generateReadingTopicLlm({ ...base, masterCorrections: [SINSAE_EDIT] }),
  ];

  const scorer = createGeminiScorer({ apiKey, judgeModel: model });
  const cosControl = await scorer.embeddingCosine(controlRes.text, SINSAE_EDIT);
  const cosTreatment = await scorer.embeddingCosine(treatmentRes.text, SINSAE_EDIT);
  const keptDayChar = dayChar ? treatmentRes.text.includes(dayChar) : true;

  console.log(`  cosine(control → คำซินแส)    = ${cosControl.toFixed(3)}`);
  console.log(`  cosine(treatment → คำซินแส)  = ${cosTreatment.toFixed(3)}  (${cosTreatment > cosControl ? "▲ ใกล้คำซินแสขึ้น" : "ไม่เปลี่ยน/ลดลง"})`);
  console.log(`  treatment ยังคงอักษรดิถี "${dayChar}" ของดวงเป้าหมาย: ${keptDayChar ? "ใช่ (ไม่ลอกข้อเท็จจริงดวงอื่น)" : "ไม่ (ต้องตรวจ)"}`);

  console.log(`\n--- A) CONTROL (ไม่มีคำซินแส) ---\n${controlRes.text.slice(0, 700)}\n`);
  console.log(`--- B) TREATMENT (ใส่คำซินแสจากดวงคล้าย) ---\n${treatmentRes.text.slice(0, 700)}\n`);

  console.log("=== ข้อสรุป ===");
  console.log(
    cosTreatment > cosControl + 0.01
      ? "แก้ดวงตัวอย่างแล้ว 'มีผล' กับดวงอื่นที่ fingerprint ตรงกัน: คำที่ออกใกล้แนวซินแสขึ้น (คำพวกนี้/ประมาณนี้) แต่ยังยึดข้อเท็จจริงของดวงนั้นเอง"
      : "รอบนี้ผลใกล้คำซินแสไม่ชัดขึ้น — อาจปรับ weight/ตัวอย่างเพิ่ม (ดูข้อความ A/B ด้านบน)",
  );
}

void main();
