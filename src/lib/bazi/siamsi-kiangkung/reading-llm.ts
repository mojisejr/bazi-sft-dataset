/**
 * LLM "สรุปคำทำนาย" ไพ่เซียมซีเคี้ยงคุง (80 ใบ) สำหรับหน้าเปิดไพ่ — แบบเดียวกับสรุปไพ่ฮวงจุ้ย (summarizeFengshuiReading)
 * ซินแสนุ้ย 2026-10-15: ชุด 80 ใบ = "การชี้แนะ แผนงาน การตัดสินใจ ขอความเห็น" · 1 คำถาม = 1 ใบ
 * ไม่ทักทาย ไม่มี persona ไม่ลงท้ายครับ/ค่ะ · server-only (ใช้ใน route)
 */
import type { SiamsiCard } from "@/lib/bazi/siamsi-kiangkung/deck";
import { generateProseLlm, type ReadingLlmProvider } from "@/lib/bazi/reading-llm";

const SYSTEM_INSTRUCTION = [
  "คุณคือ \"ซินแส\" ที่ให้คำชี้แนะคนตรงหน้าเรื่องแผนงาน การตัดสินใจ หรือขอความเห็น จากไพ่เซียมซีเคี้ยงคุงที่เสี่ยงได้ 1 ใบ — พูดด้วยน้ำเสียงคนจริง อบอุ่น มั่นใจ ไม่ใช่ AI สรุปข้อมูล",
  "",
  "วิธีคิดก่อนตอบ:",
  "- ไพ่ใบนี้บอก \"สถานการณ์\" ที่คนถามกำลังเจอ + \"ข้อควรระวัง\" + \"คำแนะนำ\" — ตีความให้เข้ากับเรื่องที่ถาม",
  "- ไล่ให้เป็นเรื่องเดียว: ตอบตรงคำถาม (ไปต่อ/รอก่อน/ปรับแผน) → สิ่งที่ต้องระวัง → สิ่งที่ควรทำจากคำแนะนำของไพ่",
  "",
  "ความยาว (สำคัญ): สั้น กระชับ ได้ใจความ — รวมทั้งหมดไม่เกิน 3-5 ประโยค (ราว 80-130 คำ)",
  "",
  "ถ้ามี \"คำถาม\": ประโยคแรกต้องตอบคำถามนั้นตรง ๆ ก่อน (เช่น ถามว่าควรไหม → ฟันธงว่าควร/ยังไม่ควร/ควรแบบมีเงื่อนไข) แล้วค่อยเล่าเหตุผลและสิ่งที่ควรทำ",
  "",
  "กฎเหล็ก (ห้ามผิด):",
  "- ตีความได้ แต่ห้ามแต่งคำทำนาย/คำแนะนำนอกเหนือจากไพ่ที่ให้มา",
  "- ห้ามทักทาย ห้ามแนะนำตัว ห้ามพูดแบบแชท (ไม่มี \"สวัสดี\" \"ผม/ดิฉัน\" \"ถามมาได้เลย\")",
  "- ห้ามเอ่ยถึงกลไกเบื้องหลัง ห้ามใส่หัวข้อ/เลขลำดับ — พูดเป็นคำทำนายร้อยแก้วลื่น ๆ",
  "- เรื่องสุขภาพ/การเงิน/กฎหมาย ให้แนะนำแบบระมัดระวัง ไม่ฟันธงเกินจริง",
  "- คำลงท้ายเป็นกลาง ไม่ลงท้าย \"ครับ\"/\"ค่ะ\"",
  "",
  "ตอบเป็นร้อยแก้วต่อเนื่อง ไม่ต้องมีหัวข้อ ไม่ต้องมี JSON",
].join("\n");

export async function summarizeSiamsiReading(input: {
  card: SiamsiCard;
  question?: string;
  apiKey?: string;
  model?: string;
  provider?: ReadingLlmProvider;
}): Promise<{ text: string; model: string }> {
  const q = input.question?.trim();
  const c = input.card;
  const userPrompt = [
    q ? `คำถาม: ${q}` : "ไม่มีคำถามเฉพาะ — ให้คำชี้แนะภาพรวมจากไพ่ที่เสี่ยงได้",
    [
      `ไพ่ที่เสี่ยงได้: ${c.name} — ${c.theme}`,
      `สถานการณ์: ${c.situation}`,
      c.caution ? `ข้อควรระวัง: ${c.caution}` : null,
      c.advice ? `คำแนะนำ: ${c.advice}` : null,
    ]
      .filter((l): l is string => l !== null)
      .join("\n"),
  ].join("\n\n");
  const result = await generateProseLlm({
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt,
    apiKey: input.apiKey,
    model: input.model,
    provider: input.provider ?? "gemini",
    temperature: 0.5,
  });
  const text = result.text.replace(/\s*(ครับ|ค่ะ|คะ|นะคะ|นะครับ)([."”\s]*)$/u, "$2").trimEnd();
  return { text, model: result.model };
}
