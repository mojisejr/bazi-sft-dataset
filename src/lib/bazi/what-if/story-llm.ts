/**
 * แคมเปญ "What If" — LLM แต่ง "นิทานโลกคู่ขนาน" 3 บท (จุดเปลี่ยน / จุดพีค / อีก 10 ปีข้างหน้า)
 * จากอาชีพปัจจุบัน + อาชีพที่ฟ้าลิขิต (จาก destiny engine) — โทนสร้างแรงบันดาลใจ ฟีลกู้ด ไม่ดาร์ก
 * ความยาวรวม ~150-200 คำ ให้อ่านจบง่ายบนมือถือ (ตาม PRD)
 *
 * reuse provider plumbing เดียวกับฟีเจอร์อื่นผ่าน generateProseLlm()
 * server-only (ใช้ใน route)
 */
import type { WhatIfDestiny } from "@/lib/bazi/what-if/destiny";
import { generateProseLlm, type ReadingLlmProvider } from "@/lib/bazi/reading-llm";

export type WhatIfStory = {
  /** บทที่ 1: จุดเปลี่ยน — วันที่เลือกเดินตามดวง */
  shift: string;
  /** บทที่ 2: จุดพีค — ความสำเร็จในปัจจุบันของโลกคู่ขนาน */
  peak: string;
  /** บทที่ 3: อีก 10 ปีข้างหน้า — บทสรุปชีวิตที่สมบูรณ์ */
  future: string;
};

const SYSTEM_INSTRUCTION = [
  "คุณคือนักเล่านิทานแห่งจักรวาลคู่ขนาน — เล่าเรื่อง \"ชีวิตอีกเวอร์ชัน\" ของคน ๆ หนึ่ง ในโลกที่เขาตัดสินใจเดินตามเส้นทางที่ดวงชะตาลิขิต",
  "",
  "โจทย์: ผู้อ่านคือคนวัยทำงาน (25-50 ปี) ที่กรอกอาชีพปัจจุบันเข้ามา แล้วระบบคำนวณ \"อาชีพที่ฟ้าลิขิต\" จากปีเกิด — คุณต้องเล่านิทาน 3 บทว่าในจักรวาลคู่ขนาน ชีวิตเขารุ่งโรจน์แค่ไหนเมื่อเลือกอาชีพนั้น",
  "",
  "โครง 3 บท (บังคับ):",
  "1) shift — จุดเปลี่ยน: วันที่เขากล้าเลือกทางที่ดวงชี้ (แตะอาชีพเดิมเบา ๆ อย่างให้เกียรติ ไม่ดูถูก) ชีวิตเริ่มหมุนไปทางใหม่",
  "2) peak — จุดพีค: ความสำเร็จ ณ วันนี้ของโลกคู่ขนาน — ชื่อเสียง รายได้ ความสุข ภาพต้องชัดและน่าตื่นเต้น",
  "3) future — อีก 10 ปีข้างหน้า: ภาพรวมชีวิตที่อิ่มเต็ม ทั้งงาน ครอบครัว และความหมายของชีวิต ปิดท้ายให้อบอุ่นใจ",
  "",
  "น้ำเสียง: สร้างแรงบันดาลใจ ฟีลกู้ด เห็นภาพ (cinematic) — ห้ามดาร์ก ห้ามเสียดสีอาชีพเดิม ห้ามตำหนิการเลือกในอดีต",
  "ใช้พลังธาตุประจำปีเกิดที่ให้มา เป็นสีสันของเรื่อง (เช่น ธาตุไฟ = เจิดจ้า, ธาตุน้ำ = ลื่นไหลข้ามพรมแดน)",
  "ความยาว: รวมทั้ง 3 บทไม่เกิน 150-200 คำ (บทละ ~50-65 คำ) — กระชับ อ่านจบบนมือถือ",
  "สรรพนาม: เรียกผู้อ่านว่า \"คุณ\" ตลอดเรื่อง ห้ามลงท้ายครับ/ค่ะ",
  "",
  "รูปแบบคำตอบ (บังคับเด็ดขาด): ตอบเป็น JSON ล้วน ๆ เท่านั้น ไม่มีข้อความอื่นนอก JSON:",
  '{"shift": "...", "peak": "...", "future": "..."}',
].join("\n");

function buildUserPrompt(input: {
  destiny: WhatIfDestiny;
  currentJob: string;
  age: number | null;
  gender?: "male" | "female";
  bookCareerExcerpt?: string | null;
}): string {
  const { destiny, currentJob, age, gender, bookCareerExcerpt } = input;
  return [
    `อาชีพปัจจุบัน: ${currentJob}`,
    `อาชีพที่ฟ้าลิขิต (ในจักรวาลคู่ขนาน): ${destiny.destinedCareer}`,
    `พลังประจำดวง: ${destiny.ganzhiLabel} — ${destiny.careerReason}`,
    ...(age !== null ? [`อายุปัจจุบัน: ประมาณ ${age} ปี`] : []),
    ...(gender ? [`เพศ: ${gender === "male" ? "ชาย" : "หญิง"}`] : []),
    ...(bookCareerExcerpt
      ? [
          "",
          "แนวธุรกิจ/อาชีพที่ถูกโฉลกตามตำราซินแส (ธาตุเดียวกับอาชีพฟ้าลิขิต) — ใช้เป็นสีสัน/รายละเอียดของเรื่องได้ ห้ามยกมาทั้งดุ้น:",
          bookCareerExcerpt,
        ]
      : []),
    "",
    "เล่านิทานโลกคู่ขนาน 3 บท (shift / peak / future) ตามโครงที่กำหนด — ตอบเป็น JSON เท่านั้น",
  ].join("\n");
}

/** ดึง JSON object ก้อนแรกออกจากข้อความ LLM (กันเคสมี ```json fence หรือคำเกิน) */
export function extractStoryJson(text: string): WhatIfStory | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<WhatIfStory>;
    if (
      typeof parsed.shift === "string" && parsed.shift.trim() &&
      typeof parsed.peak === "string" && parsed.peak.trim() &&
      typeof parsed.future === "string" && parsed.future.trim()
    ) {
      return { shift: parsed.shift.trim(), peak: parsed.peak.trim(), future: parsed.future.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

/** fallback: LLM ไม่ตอบ JSON → หั่นเป็น 3 ย่อหน้าตามลำดับ */
function splitFallback(text: string): WhatIfStory {
  const parts = text
    .replace(/```(?:json)?/g, "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    shift: parts[0] ?? text.trim(),
    peak: parts[1] ?? "",
    future: parts.slice(2).join("\n\n"),
  };
}

export async function generateWhatIfStory(input: {
  destiny: WhatIfDestiny;
  currentJob: string;
  age: number | null;
  gender?: "male" | "female";
  /** รายชื่อธุรกิจ/อาชีพจาก NewData (career_by_element) ของธาตุที่ควรทำ — grounding เสริม */
  bookCareerExcerpt?: string | null;
  apiKey?: string;
  model?: string;
  provider?: ReadingLlmProvider;
}): Promise<{ story: WhatIfStory; model: string }> {
  const result = await generateProseLlm({
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: buildUserPrompt(input),
    apiKey: input.apiKey,
    model: input.model,
    provider: input.provider ?? "gemini",
    temperature: 0.8,
    usageFeature: "what_if",
    usageLabel: `${input.currentJob} → ${input.destiny.destinedCareer}`.slice(0, 200),
  });
  const story = extractStoryJson(result.text) ?? splitFallback(result.text);
  return { story, model: result.model };
}
