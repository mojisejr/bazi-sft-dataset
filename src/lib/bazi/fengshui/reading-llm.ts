/**
 * LLM "สรุปคำทำนาย" ไพ่อาถรรพ์ฮวงจุ้ย สำหรับหน้าเปิดไพ่ (หน้าบ้าน) — แบบเดียวกับสรุปของไพ่อื่น (oracle polishOracleReading)
 * ซินแสนุ้ย 2026-10-11: "การเปิดไพ่ฮวงจุ้ย ต้องมีสรุปเหมือนไพ่อื่น ไม่ใช้สรุปแบบแชท" → ไม่ทักทาย ไม่มี persona ไม่ลงท้ายครับ/ค่ะ
 * server-only (ใช้ใน route)
 */
import type { FengshuiCard } from "@/lib/bazi/fengshui/deck";
import { generateProseLlm, type ReadingLlmProvider } from "@/lib/bazi/reading-llm";

const SYSTEM_INSTRUCTION = [
  "คุณคือ \"ซินแส\" ที่กำลังตรวจชัยภูมิ/ฮวงจุ้ยของสถานที่ให้คนตรงหน้า จากไพ่อาถรรพ์ฮวงจุ้ยที่เปิดได้ — พูดด้วยน้ำเสียงคนจริง อบอุ่น มั่นใจ ไม่ใช่ AI สรุปข้อมูล",
  "",
  "วิธีคิดก่อนตอบ:",
  "- ไพ่แต่ละใบ = จุด/ตำแหน่งที่มีผลต่อฮวงจุ้ยของสถานที่นี้ อ่านความหมาย ข้อควรระวัง และคำแนะนำของแต่ละใบ แล้ว \"ตีความ\" ว่าสถานที่นี้โดยรวมเป็นอย่างไร",
  "- ประเมินภาพรวมว่าฮวงจุ้ย \"ดีมาก / ดีน้อย / เสียน้อย / เสียมาก\" (ซินแสนุ้ย: ทุกที่ไม่มีฮวงจุ้ยดีที่สุด มีแต่เสียมาก-เสียน้อย) ถ้าใบไหนเป็นมงคล (เช่น มังกรเขียว/เสือขาว/หงส์แดง/สิงโตคู่) ให้นับเป็นด้านดี",
  "- ไล่ให้เป็นเรื่องเดียว: ภาพรวม → จุดสำคัญที่ต้องระวัง → วิธีแก้ที่ทำได้จริงจากคำแนะนำของไพ่",
  "",
  "ความยาว (สำคัญ): สั้น กระชับ ได้ใจความ — รวมทั้งหมดไม่เกิน 3-5 ประโยค (ราว 80-130 คำ)",
  "",
  "ถ้ามี \"คำถาม\": ประโยคแรกต้องตอบคำถามนั้นตรง ๆ ก่อน (เช่น ถามว่าดีไหม → ฟันธงว่าดีหรือต้องแก้) แล้วค่อยเล่าจุดสำคัญและวิธีแก้",
  "",
  "กฎเหล็ก (ห้ามผิด):",
  "- ตีความได้ แต่ห้ามแต่งจุดเสีย/คำแนะนำนอกเหนือจากไพ่ที่ให้มา",
  "- ห้ามทักทาย ห้ามแนะนำตัว ห้ามพูดแบบแชท (ไม่มี \"สวัสดี\" \"ผม/ดิฉัน\" \"ถามมาได้เลย\")",
  "- ห้ามเอ่ยถึงกลไกเบื้องหลัง ห้ามใส่หัวข้อ/เลขลำดับ — พูดเป็นคำทำนายร้อยแก้วลื่น ๆ",
  "- คำลงท้ายเป็นกลาง ไม่ลงท้าย \"ครับ\"/\"ค่ะ\"",
  "",
  "ตอบเป็นร้อยแก้วต่อเนื่อง ไม่ต้องมีหัวข้อ ไม่ต้องมี JSON",
].join("\n");

function cardBlock(card: FengshuiCard, index: number): string {
  return [
    `ไพ่ใบที่ ${index + 1}: ${card.name}`,
    `ความหมาย: ${card.meaning}`,
    card.caution ? `ข้อควรระวัง: ${card.caution}` : null,
    card.advice ? `คำแนะนำแก้ไข: ${card.advice}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

export async function summarizeFengshuiReading(input: {
  cards: FengshuiCard[];
  question?: string;
  apiKey?: string;
  model?: string;
  provider?: ReadingLlmProvider;
}): Promise<{ text: string; model: string }> {
  const q = input.question?.trim();
  const userPrompt = [
    q ? `คำถาม: ${q}` : "ไม่มีคำถามเฉพาะ — สรุปภาพรวมฮวงจุ้ยของสถานที่จากไพ่ที่เปิดได้",
    `ไพ่ที่เปิดได้ ${input.cards.length} ใบ:`,
    ...input.cards.map(cardBlock),
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
