/**
 * Engine ทำนาย "โหมดเซียน" (deterministic — ไม่เรียก LLM)
 *
 * หลักการน้ำหนัก 3 ใบ:
 *   - ใบ 1 = 50% แกนคำทำนายหลัก (คำทำนายแดนสวรรค์)
 *   - ใบ 2 = 30% ขยาย/ต่อยอดธีมของใบ 1
 *   - ใบ 3 = 20% ขยายเชื่อมโยงทั้งใบ 1 และ 2
 *
 * engineProse คือ ground truth ที่ส่งให้ LLM ไป "เกลาคำ" ภายหลัง (ห้ามแต่งเติม)
 */
import type { DivineCard, DivineDraw } from "@/lib/bazi/divine-cards/deck";

export const DIVINE_WEIGHTS = [50, 30, 20] as const;

export type DivineSlot = {
  position: 1 | 2 | 3;
  weight: number;
  role: string;
  card: DivineCard;
};

export type DivineReading = {
  slots: [DivineSlot, DivineSlot, DivineSlot];
  engineProse: string;
};

const ROLES = [
  "แกนหลักของคำทำนาย",
  "ขยายชุดที่ 1",
  "ขยายชุดที่ 1 และ 2",
] as const;

function cardLabel(card: DivineCard): string {
  const en = card.keywordEn ? ` (${card.keywordEn})` : "";
  return `${card.name}${en}`;
}

export function buildDivineReading(cards: DivineDraw, question?: string): DivineReading {
  const slots = cards.map((card, index) => ({
    position: (index + 1) as 1 | 2 | 3,
    weight: DIVINE_WEIGHTS[index],
    role: ROLES[index],
    card,
  })) as [DivineSlot, DivineSlot, DivineSlot];

  const [lead, expand1, expand2] = slots;

  const q = question?.trim();
  const paragraphs = [
    ...(q ? [`คำถามที่ถาม: ${q}`] : []),
    `ไพ่หลัก (น้ำหนัก ${lead.weight}%) — ${cardLabel(lead.card)}\n${lead.card.prophecy}`,
    `ขยายชุดที่ 1 (น้ำหนัก ${expand1.weight}%) — ${cardLabel(expand1.card)}\n` +
      `เสริมและต่อยอดธีมของไพ่หลัก: ${expand1.card.prophecy}`,
    `ขยายชุดที่ 1 และ 2 (น้ำหนัก ${expand2.weight}%) — ${cardLabel(expand2.card)}\n` +
      `ปิดท้ายเชื่อมโยงสองไพ่ก่อนหน้า: ${expand2.card.prophecy}`,
  ];

  return { slots, engineProse: paragraphs.join("\n\n") };
}
