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
  /** เวอร์ชันสำหรับแชท (บังวิชา — เอ็ม 2026-09-23): ตัด "ไพ่ใบที่ .. #.. ชื่อ.." ออก เหลือ "จุดที่ N" + ใจความ
   *  → LLM ไม่มีชื่อ/เลขไพ่ให้โพล่ง. */
  chatProse: string;
};

function cardBlock(card: FengshuiCard, index: number, hideCard: boolean): string {
  return [
    hideCard ? `จุดที่ ${index + 1}:` : `ไพ่ใบที่ ${index + 1}: #${card.no} ${card.name}`,
    `ความหมายโดยรวม: ${card.meaning}`,
    ...(card.caution ? [`ข้อควรระวัง: ${card.caution}`] : []),
    ...(card.advice ? [`คำแนะนำแก้ไข: ${card.advice}`] : []),
  ].join("\n");
}

export function buildFengshuiReading(cards: FengshuiCard[], question?: string): FengshuiReading {
  const q = question?.trim();
  const qLine = q ? [`คำถามที่ถาม (เรื่องสถานที่/ชัยภูมิ): ${q}`] : [];
  const parts = [
    ...qLine,
    `จั่วไพ่อาถรรพ์ฮวงจุ้ยได้ ${cards.length} ใบ (แต่ละใบ = จุด/ตำแหน่งที่มีผลต่อฮวงจุ้ยของสถานที่นี้):`,
    ...cards.map((c, i) => cardBlock(c, i, false)),
  ];
  const chatParts = [
    ...qLine,
    `พบ ${cards.length} จุดที่มีผลต่อฮวงจุ้ยของสถานที่นี้:`,
    ...cards.map((c, i) => cardBlock(c, i, true)),
  ];
  return { cards, engineProse: parts.join("\n\n"), chatProse: chatParts.join("\n\n") };
}
