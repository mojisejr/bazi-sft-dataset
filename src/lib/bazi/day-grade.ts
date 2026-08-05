// เปิด "เกรดของวัน" ออกทางท่อ — map overallPercent (ที่เครื่องคำนวณคิดเสร็จแล้ว) ผ่านตำราเกรด
// (gradeForPercent = pair-matching, ตาราง rating-scale 13 ระดับ) โดยไม่แตะเครื่องคำนวณ/สูตร/ตำรา.
//
// อยู่ใน lib (ไม่ใช่ route.ts) เพื่อให้เทสต์ import ได้โดยไม่ลาก module graph ของ route (DB repo ฯลฯ)
// เข้ามาใน unit test — B-6/R3. enrichDay/Month/Year เป็นตัว lock รูปคำตอบ 3 โหมด (B-6/R1): เติม grade
// แบบ spread+add คงคีย์เดิมครบ เติม grade ล้วน.
import { gradeForPercent } from "@/lib/bazi/pair-matching";

/** null → null (คีย์ใหม่ นิยามเอง, fe อ่านง่าย) — ไม่ใช่ sentinel "-" ของ gradeForPercent. ไม่ปัดเศษ
 *  ก่อนเทียบ: รอยต่อทศนิยม (49.16) ตกช่องบน (C+) ตามตำราเดิม. */
export const gradeOf = (percent: number | null | undefined): string | null =>
  percent == null ? null : gradeForPercent(percent);

type DayLike = { overallPercent?: number | null };
type Graded<T> = T & { grade: string | null };

/** รายวัน — เติม grade ระดับบนสุด. */
export function enrichDay<T extends DayLike>(result: T): Graded<T> {
  return { ...result, grade: gradeOf(result.overallPercent) };
}

/** รายเดือน — เติม grade ต่อวันใน days[]. */
export function enrichMonth<D extends DayLike, T extends { days: D[] }>(
  result: T,
): Omit<T, "days"> & { days: Array<Graded<D>> } {
  return { ...result, days: result.days.map((d) => enrichDay(d)) };
}

/** รายปี — เติม grade ต่อวันในทุกเดือน months[].days[] (ห้ามลืม — ใช้ทำ PDF ขาย). */
export function enrichYear<D extends DayLike, M extends { days: D[] }, T extends { months: M[] }>(
  result: T,
): Omit<T, "months"> & { months: Array<Omit<M, "days"> & { days: Array<Graded<D>> }> } {
  return { ...result, months: result.months.map((m) => enrichMonth(m)) };
}
