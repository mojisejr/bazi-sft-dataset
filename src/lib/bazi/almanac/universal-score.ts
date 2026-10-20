/**
 * คะแนน "สากล" ของวัน (คุณภาพวัน — ไม่ขึ้นกับดวงใคร) คู่กับ % เฉพาะบุคคล (man-vs-day)
 * Kittipon 2026-10-20: หน้ารายละเอียดวันโชว์ 2 วง "สากล | เฉพาะบุคคล" แบบปฏิทิน 通勝
 *
 * ไม่แต่งสูตรใหม่: ใช้ "กำลังดิถีวัน" (strength.ratioDay) ที่ปฏิทินต้นฉบับของซินแสใช้อยู่แล้ว —
 * กลุ่ม D = 十二長生(ก้านวัน@กิ่งวัน) + 黃道(กิ่งเดือน→วัน) + 黃道(กิ่งปี→วัน) + 建除(กิ่งเดือน→วัน)
 * จากตาราง legend ของซินแส (stage / hour-god / jianchu). 帝旺 = 110 ทำให้เกิน 100 ได้ → ตัดที่ 100
 * เกณฑ์คำ (ร่าง รอซินแสตรวจ): ≥80 ดีเยี่ยม · 65–79 ดี · 45–64 พอใช้ · <45 ระวัง
 */
import type { StrengthScore } from "@/lib/bazi/almanac/types";

export type UniversalLabel = "ดีเยี่ยม" | "ดี" | "พอใช้" | "ระวัง";
export type UniversalScore = { score: number; label: UniversalLabel };

/** เกณฑ์คำ — ปรับที่นี่ที่เดียว */
export const UNIVERSAL_BANDS: readonly { min: number; label: UniversalLabel }[] = [
  { min: 80, label: "ดีเยี่ยม" },
  { min: 65, label: "ดี" },
  { min: 45, label: "พอใช้" },
  { min: 0, label: "ระวัง" },
];

export function universalLabel(score: number): UniversalLabel {
  return (UNIVERSAL_BANDS.find((b) => score >= b.min) ?? UNIVERSAL_BANDS[UNIVERSAL_BANDS.length - 1]).label;
}

export function dayUniversalScore(strength: Pick<StrengthScore, "ratioDay">): UniversalScore {
  const raw = Number.isFinite(strength.ratioDay) ? strength.ratioDay : 0;
  const score = Math.max(0, Math.min(100, Math.round(raw * 100)));
  return { score, label: universalLabel(score) };
}
