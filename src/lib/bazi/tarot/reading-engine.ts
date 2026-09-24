/**
 * Engine อ่าน "ไพ่ทาโรต์วิถีเต๋า" (deterministic — ไม่เรียก LLM)
 *
 * สเปรด 3 ใบ = อดีต / ปัจจุบัน / อนาคต (past/present/future)
 * engineProse คือ ground truth ที่ส่งให้ LLM ไป "เกลาคำ" ต่อ (ห้ามแต่งเติมนอกความหมายไพ่)
 * มิเรอร์ divine-cards/reading-engine.ts + fengshui/reading-engine.ts
 */
import type { TarotCard } from "@/lib/bazi/tarot/deck";

export const TAROT_POSITIONS = ["อดีต", "ปัจจุบัน", "อนาคต"] as const;

export type TarotPosition = (typeof TAROT_POSITIONS)[number];

export type TarotSlot = {
  position: 1 | 2 | 3;
  /** ชื่อช่องในสเปรด (อดีต/ปัจจุบัน/อนาคต) */
  role: TarotPosition;
  card: TarotCard;
};

export type TarotReading = {
  slots: TarotSlot[];
  engineProse: string;
};

function cardBlock(slot: TarotSlot): string {
  const c = slot.card;
  return [
    `[${slot.role}] ${c.name}${c.virtue ? ` · ${c.virtue}` : ""}`,
    `ใจความ: ${c.tagline}`,
    `ความหมายวิถีเต๋า: ${c.meaning}`,
    ...(c.caution ? [`ข้อควรระวัง (เงา/กลับหัว): ${c.caution}`] : []),
    ...(c.koan ? [`คำคม: ${c.koan}`] : []),
    `เทียบสากล — หงาย: ${c.universalUpright} · กลับหัว: ${c.universalReversed}`,
  ].join("\n");
}

/**
 * สร้างการอ่านจากไพ่ที่จั่ว/เลือกมา (รองรับ 1–3 ใบ)
 * - 3 ใบ → อดีต/ปัจจุบัน/อนาคต
 * - 1 ใบ → ปัจจุบัน (คำถามเดียว)
 */
export function buildTarotReading(cards: TarotCard[], question?: string): TarotReading {
  const roles: TarotPosition[] =
    cards.length === 1 ? ["ปัจจุบัน"] : TAROT_POSITIONS.slice(0, cards.length);

  const slots: TarotSlot[] = cards.map((card, index) => ({
    position: (index + 1) as 1 | 2 | 3,
    role: roles[index] ?? "ปัจจุบัน",
    card,
  }));

  const q = question?.trim();
  const parts = [
    ...(q ? [`คำถามที่ถาม: ${q}`] : []),
    cards.length === 1
      ? "จั่วไพ่ทาโรต์วิถีเต๋า 1 ใบ:"
      : `จั่วไพ่ทาโรต์วิถีเต๋า ${cards.length} ใบ (อ่านไล่ อดีต → ปัจจุบัน → อนาคต):`,
    ...slots.map(cardBlock),
  ];

  return { slots, engineProse: parts.join("\n\n") };
}
