/**
 * Verify P-A: เจนคำอ่านฉบับ LLM แล้วตรวจเกณฑ์อัตโนมัติ
 *   - ไม่ลงท้าย "ครับ/ค่ะ"
 *   - ไม่อ้างแหล่งที่มา (M.docx / 1.docx / "ตำรา ...")
 *   - ความยาว ≤ 3 ย่อหน้า
 *   - คงป้าย [ยุคทอง]/[เฝ้าระวัง] ถ้า engine มี
 *
 * Usage: npx tsx scripts/verify-reading-llm.ts
 */
import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { buildDayMasterRelationPacket } from "@/lib/bazi/day-master-relation-reading-poc";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { buildTopicEngineReading, type TopicEngineReading } from "@/lib/bazi/topic-reading";
import {
  buildTopicHumanReading,
  getTopicKnowledgeSourceLabel,
} from "@/lib/bazi/topic-knowledge";
import { generateReadingTopicLlm } from "@/lib/bazi/reading-llm";

function engineSignalsFor(reading: TopicEngineReading): string[] {
  return [
    `หลักการอ่าน: ${reading.lens}`,
    ...reading.table.map((row) => `${row.sourceSymbol} → ${row.pointsTo}: ${row.relationResult}`),
    ...reading.prose,
  ];
}

const CASES = [
  { label: "case3 丙 (1949-06-25 12:00 ญ)", d: "1949-06-25", t: "12:00", g: "female" as const },
  { label: "M 己 (1993-11-24 15:09 ช)", d: "1993-11-24", t: "15:09", g: "male" as const },
];
const TOPICS = ["chart_foundation", "career_potential", "turning_points"] as const;

function checks(engineText: string, llmText: string) {
  // นับ "คำ" แบบหยาบ (ไทยใช้จำนวนตัวอักษรหาร 4 โดยประมาณ + นับช่องว่าง) เพื่อวัดความกระชับ
  const charCount = llmText.replace(/\s+/g, "").length;
  const approxWords = Math.round(charCount / 4);
  const bulletLines = (llmText.match(/^\s*-\s+/gm) ?? []).length;
  const issues: string[] = [];
  if (/(ครับ|ค่ะ)\s*$/.test(llmText.trim())) issues.push("ลงท้าย ครับ/ค่ะ");
  if (/ครับ|ค่ะ/.test(llmText)) issues.push("มีคำว่า ครับ/ค่ะ ในเนื้อหา");
  if (/\.docx|M\.docx|1\.docx|จากตำรา|อ้างอิงตำรา|ตามตำรา[^ก-๙]/.test(llmText)) issues.push("อ้างแหล่งที่มา");
  if (approxWords > 220) issues.push(`ยาวเกิน (~${approxWords} คำ > 220)`);
  if (bulletLines === 0) issues.push("ไม่มี bullet (ควรมีจุดสำคัญเป็นข้อ ๆ)");
  for (const tag of ["[ยุคทอง]", "[เฝ้าระวัง]"]) {
    if (engineText.includes(tag) && !llmText.includes(tag)) issues.push(`หล่นป้าย ${tag}`);
  }
  return { approxWords, bulletLines, issues };
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

  let totalIssues = 0;
  for (const c of CASES) {
    const raw = RawInputSchema.parse({
      birthDate: c.d, birthTime: c.t, gender: c.g,
      province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziStateFromRawInput(raw);
    const packet = buildDayMasterRelationPacket(state);
    console.log(`\n======== ${c.label} | ดิถี ${state.dayMaster} (${state.dayMasterStrengthProfile?.displayLabel ?? ""}) ========`);
    for (const topicId of TOPICS) {
      const reading = buildTopicEngineReading(state, topicId, packet);
      const humanKnowledge = buildTopicHumanReading(state, topicId, raw);
      const llm = await generateReadingTopicLlm({
        topicId,
        rawInput: raw,
        calculatedState: state,
        humanKnowledge,
        sourceLabel: getTopicKnowledgeSourceLabel(topicId),
        engineSignals: engineSignalsFor(reading),
        apiKey,
        provider: "gemini",
      });
      const { approxWords, bulletLines, issues } = checks(humanKnowledge ?? "", llm.text);
      totalIssues += issues.length;
      console.log(`\n--- [${topicId}] (${llm.model}) ~${approxWords}คำ/${bulletLines}bullet ${issues.length ? "❌ " + issues.join(", ") : "✅ ผ่านเกณฑ์"}`);
      console.log(llm.text);
    }
  }
  console.log(`\n\n==== สรุป: ${totalIssues === 0 ? "✅ ผ่านทุกเกณฑ์" : `❌ พบปัญหา ${totalIssues} จุด`} ====`);
}

void main();
