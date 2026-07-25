/**
 * ป้ายวันเกิดภาษาไทยสำหรับหัวรายงาน — ซินแสสั่งรูปแบบ "วัน เดือน ปี(พ.ศ.) · เวลา"
 * เช่น 1982-04-26 19:09 → "26 เม.ย. 2525 · 19:09 น."
 *
 * pure + client/server-safe (ข้อมูลล้วน ไม่มี import side-effect)
 */
const THAI_MONTH_ABBR = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** birthDate = "YYYY-MM-DD" (ค.ศ.) · birthTime = "HH:mm" — รูปแบบอื่นคืนค่าดิบตามเดิม */
export function formatThaiBirthLabel(
  birthDate?: string | null,
  birthTime?: string | null,
): string {
  const time = String(birthTime ?? "").trim();
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate ?? "").trim());
  if (!matched) return [String(birthDate ?? "").trim(), time].filter(Boolean).join(" ");
  const [, year, month, day] = matched;
  const monthLabel = THAI_MONTH_ABBR[Number(month) - 1] ?? month;
  const datePart = `${Number(day)} ${monthLabel} ${Number(year) + 543}`;
  return time ? `${datePart} · ${time} น.` : datePart;
}
