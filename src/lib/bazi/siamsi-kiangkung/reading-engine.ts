/**
 * Engine อ่าน "ไพ่เซียมซีเคี้ยงคุง" (deterministic — ไม่เรียก LLM)
 *
 * จั่ว 1 ใบ/1 คำถาม. engineProse คือ ground truth ที่ส่งให้ LLM ไป "เกลาคำ" ต่อ
 * (เนื้อไม่ต้องเป๊ะ กร่อนคำ/เรียบเรียงใหม่ได้ แต่ใจความเดิม — ตามที่เจ้าของสั่ง).
 */
import type { SiamsiCard } from "@/lib/bazi/siamsi-kiangkung/deck";

export type SiamsiReading = {
  card: SiamsiCard;
  engineProse: string;
};

export function buildSiamsiReading(card: SiamsiCard, question?: string): SiamsiReading {
  const q = question?.trim();
  const parts = [
    ...(q ? [`คำถามที่ถาม: ${q}`] : []),
    `ไพ่ที่จั่วได้: #${card.no} ${card.name} — ${card.theme}`,
    `สถานการณ์ (ความหมายโดยรวม): ${card.situation}`,
    ...(card.caution ? [`ข้อควรระวัง: ${card.caution}`] : []),
    ...(card.advice ? [`คำแนะนำ: ${card.advice}`] : []),
  ];
  return { card, engineProse: parts.join("\n\n") };
}
