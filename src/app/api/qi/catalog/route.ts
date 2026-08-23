import { QI_EARN_LINES, QI_SPEND_LINES } from "@/lib/bazi/qi/catalog";

export const runtime = "nodejs";

/**
 * /api/qi/catalog — ดึงรายการ "เส้น" ทั้งหมดของระบบกิจกรรม (แต้ม Qi) พร้อมบันทึกกำกับ.
 *   GET → { earn: QiEarnLine[], spend: QiSpendLine[] }
 * เป็นทั้ง API ให้ frontend ดึง และเอกสารต่อเส้นในตัว (ทุกเส้นมี note).
 */
export async function GET() {
  return Response.json({ earn: QI_EARN_LINES, spend: QI_SPEND_LINES }, { status: 200 });
}
