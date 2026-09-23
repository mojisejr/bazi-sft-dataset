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
  /** เวอร์ชันสำหรับแชท (บังวิชา — เอ็ม 2026-09-23): ตัด "ไพ่ที่จั่วได้ #.. ชื่อ.." ออก เหลือแต่ใจความ
   *  → LLM ไม่มีชื่อ/เลขไพ่ให้โพล่ง "ไพ่ที่หยิบได้คือ...". */
  chatProse: string;
};

export function buildSiamsiReading(card: SiamsiCard, question?: string): SiamsiReading {
  const q = question?.trim();
  const meaning = [
    `สถานการณ์ (ความหมายโดยรวม): ${card.situation}`,
    ...(card.caution ? [`ข้อควรระวัง: ${card.caution}`] : []),
    ...(card.advice ? [`คำแนะนำ: ${card.advice}`] : []),
  ];
  const qLine = q ? [`คำถามที่ถาม: ${q}`] : [];
  const parts = [...qLine, `ไพ่ที่จั่วได้: #${card.no} ${card.name} — ${card.theme}`, ...meaning];
  const chatParts = [...qLine, ...meaning];
  return { card, engineProse: parts.join("\n\n"), chatProse: chatParts.join("\n\n") };
}
