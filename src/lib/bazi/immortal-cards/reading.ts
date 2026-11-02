/**
 * ไพ่เทพเซียน 3 ใบ — กติกาเดิม 50/30/20 (หลัก · ขยาย · สรุป) · LLM ตีความจากเนื้อไพ่ ห้ามแต่งเพิ่ม
 * เซียมซี 8 เซียน (เปิดใบเดียว) ไม่ผ่าน LLM — แสดงตามไฟล์ซินแสเป๊ะ
 */
import { generateProseLlm } from "@/lib/bazi/reading-llm";
import type { ImmortalCard } from "./decks";

export const IMMORTAL_SLOTS = [
  { weight: 50, role: "ไพ่หลัก" },
  { weight: 30, role: "ขยายความ" },
  { weight: 20, role: "สรุป" },
] as const;

const TOPIC: ReadonlyArray<readonly [keyof ImmortalCard, RegExp]> = [
  ["loveSingle", /โสด|เนื้อคู่|หาแฟน/],
  ["loveCouple", /รัก|แฟน|สามี|ภรรยา|คู่/],
  ["money", /เงิน|ลงทุน|หนี้|รายได้|โชคลาภ/],
  ["work", /งาน|ธุรกิจ|อาชีพ|ค้าขาย|สอบ/],
  ["health", /สุขภาพ|ป่วย|โรค/],
  ["family", /ครอบครัว|พ่อ|แม่|ลูก/],
  ["mind", /เครียด|กังวล|จิตใจ|รู้สึก/],
];

export function immortalTopic(question?: string): keyof ImmortalCard {
  const q = question ?? "";
  return TOPIC.find(([, re]) => re.test(q))?.[0] ?? "overall";
}

export function buildImmortalPrompt(cards: ImmortalCard[], question?: string): string {
  const topic = immortalTopic(question);
  const body = cards.map((c, i) => {
    const s = IMMORTAL_SLOTS[i];
    return [
      `[${s.role} • น้ำหนัก ${s.weight}%] ${c.name} (หมวด${c.category} · ${c.deity})`,
      `คำสำคัญ: ${c.keywords}`,
      `ภาพรวม: ${c.overall}`,
      topic !== "overall" ? `ตรงคำถาม: ${String(c[topic] ?? "")}` : "",
      `คำแนะนำ: ${c.advice}`,
      c.deep?.byQuestion ? `อ่านตามคำถาม: ${c.deep.byQuestion.slice(0, 500)}` : "",
    ].filter(Boolean).join("\n");
  });
  return [question?.trim() ? `คำถาม: ${question.trim()}` : "", ...body].filter(Boolean).join("\n\n");
}

const SYSTEM = [
  "คุณคือซินแสที่กำลังทำนายไพ่ออราเคิลเทพเซียนให้คนตรงหน้า พูดอบอุ่น มั่นใจ ไม่ลงท้ายครับ/ค่ะ",
  "อ่าน 3 จังหวะเป็นเรื่องเดียว: ไพ่หลัก (เด่นสุด 50%) บอกแกนเรื่อง → ขยายความ (30%) บอกว่าเกิดอย่างไร → สรุป (20%) ปิดด้วยคำแนะนำ",
  "ถ้ามีคำถาม ประโยคแรกต้องตอบตรงคำถามก่อน · ยาวไม่เกิน 5 ประโยค · ห้ามแต่งข้อเท็จจริงนอกเนื้อไพ่ · ห้ามเอ่ยเปอร์เซ็นต์หรือใบที่ 1/2/3",
  "สุขภาพเป็นแนวโน้มไม่ใช่การวินิจฉัย · การเงินไม่ใช่คำแนะนำการลงทุน",
].join("\n");

export async function polishImmortalReading(cards: ImmortalCard[], question?: string): Promise<string> {
  const r = await generateProseLlm({
    systemInstruction: SYSTEM,
    userPrompt: buildImmortalPrompt(cards, question),
    provider: "gemini",
    temperature: 0.3,
    usageFeature: "oracle_cards",
    usageLabel: null,
    usageAnonId: null,
  });
  return r.text;
}
