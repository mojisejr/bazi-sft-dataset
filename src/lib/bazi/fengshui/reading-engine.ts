/**
 * Engine อ่าน "ไพ่อาถรรพ์ฮวงจุ้ยเคี้ยงคุง" (deterministic — ไม่เรียก LLM)
 *
 * จั่ว 3 ใบ/สถานที่ (สถานที่ 1 แห่งมักผิดฮวงจุ้ยหลายจุด). engineProse = ground truth
 * ที่ส่งให้ LLM ไปตอบคำถามสถานที่ต่อ (ประเมินดี/เสียเอง + ตอบตรงจุด + คำแนะนำแก้ไข).
 * มิเรอร์ buildSiamsiReading แต่รวมหลายใบ.
 */
import type { FengshuiCard } from "@/lib/bazi/fengshui/deck";

export type FengshuiReading = {
  cards: FengshuiCard[];
  engineProse: string;
};

function cardBlock(card: FengshuiCard, index: number): string {
  return [
    `ไพ่ใบที่ ${index + 1}: #${card.no} ${card.name}`,
    `ความหมายโดยรวม: ${card.meaning}`,
    ...(card.caution ? [`ข้อควรระวัง: ${card.caution}`] : []),
    ...(card.advice ? [`คำแนะนำแก้ไข: ${card.advice}`] : []),
  ].join("\n");
}

export function buildFengshuiReading(cards: FengshuiCard[], question?: string): FengshuiReading {
  const q = question?.trim();
  const parts = [
    ...(q ? [`คำถามที่ถาม (เรื่องสถานที่/ชัยภูมิ): ${q}`] : []),
    `จั่วไพ่อาถรรพ์ฮวงจุ้ยได้ ${cards.length} ใบ (แต่ละใบ = จุด/ตำแหน่งที่มีผลต่อฮวงจุ้ยของสถานที่นี้):`,
    ...cards.map((c, i) => cardBlock(c, i)),
  ];
  return { cards, engineProse: parts.join("\n\n") };
}
