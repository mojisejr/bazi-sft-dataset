/**
 * เทียบคำอ่านฉบับ LLM (ใหม่) กับ example/ai gen M.docx — ดูว่าคำแก้ของหมอดูถูกสะท้อนไหม
 * เคส M: 1993-11-24 15:09 ชาย (ดิถี 己 อ่อน, ผัง 癸酉 癸亥 己酉 壬申)
 * Usage: npx tsx scripts/compare-llm-vs-aigen.ts
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

// หัวข้อที่หมอดูแก้เยอะ + "เครื่องหมายการแก้" ที่ควรปรากฏ (จาก ai gen M.docx)
const TOPICS: Array<{ id: string; expect: string[] }> = [
  { id: "chart_foundation", expect: ["พัฒนา / ค้นคว้า / เกิดสิ่งใหม่ (แก่นเชี่ยงแซ 长生)"] },
  { id: "career_potential", expect: ["Target/Market จากเชี่ยงแซเสาปี (แป่=ทางไกล/ออนไลน์/สุขภาพ/ทันสมัย)"] },
  { id: "wealth_and_investment", expect: ["โชคลาภหลายตำแหน่ง: ปี(แป่)=ทางไกล, เดือน(ตี้อ๋วง)=ก้อนใหญ่, ยาม(เชี่ยงแซ)=สายใหม่"] },
  { id: "love_partner", expect: ["คู่ครองจากตารางหลักวัน 己酉=เชี่ยงแซ (ส่งเสริมเจริญรุ่งเรือง)"] },
  { id: "friends_foes", expect: ["มิตร/ศัตรู/ต้องประคองตามตำแหน่ง × เชี่ยงแซ"] },
  { id: "partnership", expect: ["ราศีล่างวัน 酉 เชี่ยงแซดี → มีหุ้นส่วนได้ + ดิถีอ่อนควรมีพี่เลี้ยง"] },
  { id: "subordinates", expect: ["หมกยกที่เสายาม = บริวารต้องขัดเกลา (ไม่ใช่มั่นคง/มีคุณภาพ)"] },
  { id: "turning_points", expect: ["8 ตัว: วัยจรเทียบทีละตัวอักษรตามความหมายเสา"] },
  { id: "guardian_deities", expect: ["เทพเฉพาะดวงจากตัวอักษรเชี่ยงแซดี (พระสังกัจจายน์ 酉)"] },
];

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

  const raw = RawInputSchema.parse({
    birthDate: "1993-11-24", birthTime: "15:09", gender: "male",
    province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
  });
  const state = await calculateBaziStateFromRawInput(raw);
  const packet = buildDayMasterRelationPacket(state);
  const p = state.fourPillars;
  console.log(`เคส M | ดิถี ${state.dayMaster} (${state.dayMasterStrengthProfile?.displayLabel ?? ""}) | ${p.year.stem}${p.year.branch} ${p.month.stem}${p.month.branch} ${p.day.stem}${p.day.branch} ${p.hour.stem}${p.hour.branch}`);

  for (const topic of TOPICS) {
    const reading = buildTopicEngineReading(state, topic.id, packet);
    const humanKnowledge = buildTopicHumanReading(state, topic.id, raw);
    const llm = await generateReadingTopicLlm({
      topicId: topic.id,
      rawInput: raw,
      calculatedState: state,
      humanKnowledge,
      sourceLabel: getTopicKnowledgeSourceLabel(topic.id),
      engineSignals: engineSignalsFor(reading),
      apiKey,
      provider: "gemini",
    });
    console.log(`\n\n=================== [${topic.id}] (${llm.model}) ===================`);
    console.log(`◆ คำแก้ที่ควรเห็น: ${topic.expect.join(" | ")}`);
    console.log(`\n── ground (engine ที่อัปเดตแล้ว) ──\n${humanKnowledge}`);
    console.log(`\n── LLM (ใหม่) ──\n${llm.text}`);
  }
}

void main();
