/**
 * ตารางทำบุญตามธาตุ (บท 15) — สกัดจาก knownlage/NewData/ทำบุญ 5 ธาตุ.txt
 *
 * กฎ: ธาตุดิถี × กำลัง (2 ระดับ: อ่อน / สมดุล-แข็ง) → ธาตุที่ควรเสริมด้วยการทำบุญ
 *   อ่อน → ธาตุส่งเสริม(印)+เสมอ(比) · แข็ง → ธาตุถ่ายเท(食傷)+ทรัพย์(財) (useful god)
 * คำทำบุญรายธาตุอยู่ใน NewData group `merit_by_element` (ซินแสแก้ได้)
 *
 * pure + client-safe
 */
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import type { ElementTh } from "@/lib/bazi/constants/career-finance-table";

export type MeritBand = "weak" | "strong";

/** กำลังดิถี (engine 5 band) → 2 band ของตารางทำบุญ */
export function meritBandFromScore(score: number): MeritBand {
  const id = classifyOperatorStrengthScore(score).id;
  return id === "very-weak" || id === "weak" ? "weak" : "strong";
}

/** [ธาตุดิถี][กำลัง] = ธาตุที่ควรทำบุญเสริม (เรียงลำดับ) — ตรงตามไฟล์ทำบุญ 5 ธาตุ */
export const MERIT_FAVOR_TABLE: Record<ElementTh, Record<MeritBand, ElementTh[]>> = {
  ไม้: { weak: ["น้ำ", "ไม้"], strong: ["ไฟ", "ดิน"] },
  ไฟ: { weak: ["ไม้", "ไฟ"], strong: ["ดิน", "ทอง"] },
  ดิน: { weak: ["ไฟ", "ดิน"], strong: ["ทอง", "น้ำ"] },
  ทอง: { weak: ["ดิน", "ทอง"], strong: ["น้ำ", "ไม้"] },
  น้ำ: { weak: ["ทอง", "น้ำ"], strong: ["ไม้", "ไฟ"] },
};

export function meritFavorElements(dayElement: ElementTh, band: MeritBand): ElementTh[] {
  return MERIT_FAVOR_TABLE[dayElement]?.[band] ?? [];
}
