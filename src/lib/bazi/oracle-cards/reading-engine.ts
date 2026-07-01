/**
 * Engine ทำนาย "ไพ่ออราเคิลเคี้ยงคุง" (deterministic — ไม่เรียก LLM)
 *
 * หลักการน้ำหนัก 3 ใบ (มิเรอร์โหมดเซียน):
 *   - ใบ 1 = 50% แกนคำทำนายหลัก
 *   - ใบ 2 = 30% ขยาย/ต่อยอดธีมของใบ 1
 *   - ใบ 3 = 20% ขยายเชื่อมโยงทั้งใบ 1 และ 2
 *
 * แกนคำทำนาย = book1 (คำอธิบายละเอียด) fallback เป็น meaning
 * engineProse คือ ground truth ที่ส่งให้ LLM ไป "เกลาคำ" ภายหลัง (ห้ามแต่งเติม)
 */
import type { OracleCard, OracleDraw } from "@/lib/bazi/oracle-cards/deck";

export const ORACLE_WEIGHTS = [50, 30, 20] as const;

export type OracleSlot = {
  position: 1 | 2 | 3;
  weight: number;
  role: string;
  card: OracleCard;
};

export type OracleReading = {
  slots: [OracleSlot, OracleSlot, OracleSlot];
  engineProse: string;
};

const ROLES = [
  "แกนหลักของคำทำนาย",
  "ขยายชุดที่ 1",
  "ขยายชุดที่ 1 และ 2",
] as const;

/** ข้อความคำทำนายแกนของไพ่ (ละเอียดก่อน, ไม่มีค่อยใช้สรุปสั้น) */
export function cardProphecy(card: OracleCard): string {
  return card.book1?.trim() || card.meaning?.trim() || card.keyword?.trim() || "";
}

function cardLabel(card: OracleCard): string {
  const kw = card.keyword ? ` (${card.keyword})` : "";
  return `${card.name}${kw}`;
}

export function buildOracleReading(cards: OracleDraw, question?: string): OracleReading {
  const slots = cards.map((card, index) => ({
    position: (index + 1) as 1 | 2 | 3,
    weight: ORACLE_WEIGHTS[index],
    role: ROLES[index],
    card,
  })) as [OracleSlot, OracleSlot, OracleSlot];

  const [lead, expand1, expand2] = slots;

  const q = question?.trim();
  const paragraphs = [
    ...(q ? [`คำถามที่ถาม: ${q}`] : []),
    `ไพ่หลัก (น้ำหนัก ${lead.weight}%) — ${cardLabel(lead.card)}\n${cardProphecy(lead.card)}`,
    `ขยายชุดที่ 1 (น้ำหนัก ${expand1.weight}%) — ${cardLabel(expand1.card)}\n` +
      `เสริมและต่อยอดธีมของไพ่หลัก: ${cardProphecy(expand1.card)}`,
    `ขยายชุดที่ 1 และ 2 (น้ำหนัก ${expand2.weight}%) — ${cardLabel(expand2.card)}\n` +
      `ปิดท้ายเชื่อมโยงสองไพ่ก่อนหน้า: ${cardProphecy(expand2.card)}`,
  ];

  return { slots, engineProse: paragraphs.join("\n\n") };
}
