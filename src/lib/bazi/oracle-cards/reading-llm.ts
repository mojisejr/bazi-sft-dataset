/**
 * LLM "เกลาคำ" สำหรับไพ่ออราเคิลเคี้ยงคุง — เอา engineProse (คำตอบ engine ตามหลักน้ำหนัก)
 * มาเรียบเรียงให้ลื่นเป็นคำทำนายเดียว โดย **ห้ามคิดคำทำนายใหม่/ห้ามแต่งเติม**
 * แค่เกลาสำนวนจากหลักการที่ให้มาเท่านั้น — และใช้ "คำทำนายรายด้าน" (aspects) เป็นบริบทเสริม
 *
 * reuse provider plumbing เดียวกับ /reading ผ่าน generateProseLlm()
 * server-only (ใช้ใน route)
 */
import type { OracleAspects, OracleCard } from "@/lib/bazi/oracle-cards/deck";
import type { OracleReading } from "@/lib/bazi/oracle-cards/reading-engine";
import { generateProseLlm, type ReadingLlmProvider } from "@/lib/bazi/reading-llm";

type GeminiGenerate = (request: {
  model: string;
  contents: string;
  config: { systemInstruction: string; temperature?: number };
}) => Promise<{ text?: string | null }>;

/** ป้ายชื่อคอลัมน์รายด้าน (ไทย) สำหรับป้อนเป็นบริบทให้ LLM */
const ASPECT_LABELS: Record<keyof OracleAspects, string> = {
  person: "ลักษณะคน",
  work: "การงาน",
  wealth: "การเงิน",
  love: "ความรัก",
  health: "สุขภาพ",
  disease: "โรคภัย",
  family: "ครอบครัว",
  location: "สถานที่",
  direction: "ทิศ",
  element: "ธาตุ",
  color: "สี",
  form: "รูปลักษณ์",
  occupation: "อาชีพ",
  god: "เทพ",
  animal: "สัตว์",
};

function aspectLines(aspects: OracleAspects): string {
  const parts = (Object.keys(ASPECT_LABELS) as Array<keyof OracleAspects>)
    .map((key) => {
      const val = aspects[key]?.trim();
      return val ? `${ASPECT_LABELS[key]}: ${val}` : null;
    })
    .filter((line): line is string => line !== null);
  return parts.length ? parts.join("\n") : "";
}

const SYSTEM_INSTRUCTION = [
  "คุณคือ \"ซินแส\" ตัวจริงที่กำลังนั่งทำนายไพ่ออราเคิลเคี้ยงคุงให้คนตรงหน้า — พูดด้วยน้ำเสียงคนจริง อบอุ่น มั่นใจ เหมือนเล่าให้ฟัง ไม่ใช่ AI สรุปข้อมูล",
  "",
  "วิธีคิดก่อนตอบ (สำคัญที่สุด — คิดอีกชั้นจากความหมายไพ่ก่อน อย่าแค่ลอกความหมายมาวาง):",
  "- อ่านความหมายของไพ่แต่ละใบ แล้ว \"ตีความ\" ว่ามันกำลังบอกอะไรกับเรื่อง/คำถามนี้ แล้วค่อยพูดออกมาเป็นคำทำนายของซินแส",
  "- ถ้ามี \"คำถาม\" ให้เลือกใช้คำทำนายรายด้าน (การงาน/การเงิน/ความรัก/สุขภาพ ฯลฯ) ที่ตรงกับคำถามมาเสริมความหมายไพ่",
  "- ไล่ตาม 3 จังหวะนี้ให้ต่อเนื่องเป็นเรื่องเดียว (ห้ามใส่หัวข้อ/เลข %/ชื่อจังหวะลงในคำตอบ):",
  "  1) ไพ่หลัก (ใบที่ 1) — เป็นแกน บอกว่า \"เรื่องอะไรกำลังจะเกิด / คำตอบหลักคืออะไร\" ให้ชัดและเด่นที่สุด",
  "  2) ไพ่ใบที่ 2 — \"ขยายความ\" ต่อจากใบแรกว่าเรื่องนั้นจะเกิดอย่างไร เพราะอะไร หรือมีรายละเอียด/เงื่อนไขอะไรเสริม",
  "  3) ไพ่ใบที่ 3 — \"สรุปปิดท้าย\" รวบใบ 1 และ 2 เข้าด้วยกัน เป็นบทสรุป/คำแนะนำสุดท้ายของซินแส",
  "- ถ่วงน้ำหนักความเด่น: ใบ 1 มากสุด, ใบ 2 รองลงมา, ใบ 3 น้อยสุด (แต่ต้องมีครบทั้ง 3)",
  "",
  "ความยาว (สำคัญ): สั้น กระชับ ได้ใจความ — รวมทั้งหมดไม่เกิน 3-5 ประโยค (ราว 80-120 คำ) แต่ละจังหวะ 1-2 ประโยคพอ",
  "- พูดตรงประเด็น อย่าน้ำเยอะ อย่าขยายความซ้ำ อย่าใส่คำสวยหรูเกินจำเป็น",
  "",
  "ถ้ามี \"คำถาม\" จากผู้รับ:",
  "- ตอบคำถามนั้นตรง ๆ ในฐานะซินแส โดยตีความความหมายของไพ่ทั้ง 3 ใบให้เข้ากับคำถาม",
  "- ยังยึดความหมายของไพ่เป็นฐาน ห้ามตอบขัดหรือเกินจากความหมายไพ่",
  "",
  "กฎเหล็ก (ห้ามผิด):",
  "- ตีความได้ แต่ห้ามแต่งข้อเท็จจริงใหม่ที่ไม่มีเค้าในความหมายไพ่ (ห้ามเพิ่มตัวเลข วันเวลา เหตุการณ์เฉพาะที่ไพ่ไม่ได้บอก)",
  "- ห้ามเอ่ยถึง \"engine\" \"น้ำหนัก %\" \"ใบที่ 1/2/3\" หรือกลไกเบื้องหลัง — พูดเป็นคำทำนายลื่น ๆ เหมือนซินแสคุยกับคน",
  "- คำลงท้ายเป็นกลาง ไม่ลงท้าย \"ครับ\"/\"ค่ะ\"",
  "",
  "ตอบเป็นคำทำนายร้อยแก้วที่ไหลต่อเนื่องตาม 3 จังหวะ ไม่ต้องมีหัวข้อ ไม่ต้องมี JSON",
].join("\n");

function slotBlock(position: number, weight: number, role: string, card: OracleCard): string {
  const aspects = aspectLines(card.aspects);
  return [
    `[ไพ่ที่ ${position} • น้ำหนัก ${weight}% • ${role}] ${card.name} (${card.keyword})`,
    `ความหมาย: ${card.book1?.trim() || card.meaning?.trim() || ""}`,
    ...(aspects ? [`คำทำนายรายด้าน:\n${aspects}`] : []),
  ].join("\n");
}

function buildUserPrompt(reading: OracleReading, question?: string): string {
  const cards = reading.slots
    .map((slot) => slotBlock(slot.position, slot.weight, slot.role, slot.card))
    .join("\n\n");

  const q = question?.trim();
  return [
    ...(q
      ? [`คำถามจากผู้รับ: ${q}`, "ตอบคำถามนี้ในฐานะซินแส โดยตีความความหมายของไพ่ให้เข้ากับคำถาม", ""]
      : []),
    "ไพ่ที่จั่วได้ (ไพ่หลัก → ขยายความ → สรุป) — คิดตีความอีกชั้นแล้วทำนายตาม 3 จังหวะ ห้ามแต่งข้อเท็จจริงนอกเหนือจากความหมายไพ่:",
    "",
    cards,
  ].join("\n");
}

export type OracleLlmResult = { text: string; model: string };

/** ตัดคำลงท้าย ครับ/ค่ะ/คะ ท้ายประโยค (เผื่อ LLM หลุด) ให้น้ำเสียงเป็นกลาง */
export function stripGenderedEnding(text: string): string {
  return text
    .replace(/\s*(ครับ|ค่ะ|คะ|นะคะ|นะครับ)([."”\s]*)$/u, "$2")
    .trimEnd();
}

export async function polishOracleReading(
  input: {
    reading: OracleReading;
    question?: string;
    apiKey?: string;
    model?: string;
    provider?: ReadingLlmProvider;
  },
  deps: { generateContent?: GeminiGenerate } = {},
): Promise<OracleLlmResult> {
  const result = await generateProseLlm(
    {
      systemInstruction: SYSTEM_INSTRUCTION,
      userPrompt: buildUserPrompt(input.reading, input.question),
      apiKey: input.apiKey,
      model: input.model,
      provider: input.provider ?? "gemini",
      temperature: 0.3,
      usageFeature: "oracle_cards",
      usageLabel: input.question?.slice(0, 200) ?? null,
    },
    deps,
  );
  return { ...result, text: stripGenderedEnding(result.text) };
}
