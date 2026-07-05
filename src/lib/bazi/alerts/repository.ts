/**
 * Repository ของ "การเตือนวันโชค/วันควรระวัง" (ตาราง bazi_alerts).
 *
 * - createAlert: บันทึกการเตือน 1 รายการ (กันซ้ำ user+date+kind)
 * - getDueAlerts: ดึงรายการ status='pending' ที่ถึงกำหนดวันนี้ (Asia/Bangkok) มา push
 * - markSent / markCanceled: อัปเดตสถานะ
 * - listUserAlerts: รายการของผู้ใช้คนหนึ่ง (ไว้โชว์/ยกเลิกใน LIFF)
 *
 * server-only.
 */
import { and, desc, eq, inArray } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziAlerts, type InsertBaziAlert, type SelectBaziAlert } from "@/db/schema";

export type BaziAlertRow = SelectBaziAlert;
export type CreateAlertInput = Pick<
  InsertBaziAlert,
  "lineUserId" | "targetDate" | "kind" | "message" | "birthKey"
>;

/** วันปัจจุบันในโซน Asia/Bangkok เป็น "YYYY-MM-DD" */
export function todayBangkok(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * สร้างการเตือน — กันซ้ำ: ถ้ามี pending ของ (user, วันเดียวกัน, kind เดียวกัน) อยู่แล้ว จะไม่เพิ่มใหม่
 * คืนแถวที่มีอยู่/สร้างใหม่ (หรือ null ถ้า DB ล่ม).
 */
export async function createAlert(input: CreateAlertInput): Promise<BaziAlertRow | null> {
  try {
    const db = createDbClient();
    const existing = await db
      .select()
      .from(baziAlerts)
      .where(
        and(
          eq(baziAlerts.lineUserId, input.lineUserId),
          eq(baziAlerts.targetDate, input.targetDate),
          eq(baziAlerts.kind, input.kind),
          eq(baziAlerts.status, "pending"),
        ),
      )
      .limit(1);
    if (existing[0]) return existing[0];

    const [row] = await db.insert(baziAlerts).values(input).returning();
    return row ?? null;
  } catch (error) {
    console.error("[bazi-alerts] createAlert failed:", error);
    return null;
  }
}

/** รายการที่ถึงกำหนดวันนี้ (หรือค้างจากวันก่อน ๆ) และยัง pending — เรียงเก่าก่อน */
export async function getDueAlerts(now: Date = new Date(), limit = 500): Promise<BaziAlertRow[]> {
  const db = createDbClient();
  const today = todayBangkok(now);
  const rows = await db
    .select()
    .from(baziAlerts)
    .where(eq(baziAlerts.status, "pending"))
    .orderBy(baziAlerts.targetDate)
    .limit(limit);
  // เทียบวันแบบ string (YYYY-MM-DD เรียงตามพจนานุกรม = เรียงตามวัน) → เอาที่ถึงกำหนดแล้ว
  return rows.filter((r) => r.targetDate <= today);
}

/** ทำเครื่องหมายว่าส่งแล้ว (หลาย id พร้อมกัน) */
export async function markSent(ids: string[], now: Date = new Date()): Promise<void> {
  if (ids.length === 0) return;
  const db = createDbClient();
  await db
    .update(baziAlerts)
    .set({ status: "sent", sentAt: now })
    .where(inArray(baziAlerts.id, ids));
}

/** ยกเลิกการเตือน (ของผู้ใช้เจ้าของเท่านั้น) */
export async function cancelAlert(id: string, lineUserId: string): Promise<boolean> {
  try {
    const db = createDbClient();
    const res = await db
      .update(baziAlerts)
      .set({ status: "canceled" })
      .where(and(eq(baziAlerts.id, id), eq(baziAlerts.lineUserId, lineUserId)))
      .returning();
    return res.length > 0;
  } catch (error) {
    console.error("[bazi-alerts] cancelAlert failed:", error);
    return false;
  }
}

/** การเตือนที่ยัง pending ของผู้ใช้คนหนึ่ง (ใหม่ก่อน) */
export async function listUserAlerts(lineUserId: string, limit = 50): Promise<BaziAlertRow[]> {
  try {
    const db = createDbClient();
    return await db
      .select()
      .from(baziAlerts)
      .where(and(eq(baziAlerts.lineUserId, lineUserId), eq(baziAlerts.status, "pending")))
      .orderBy(desc(baziAlerts.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[bazi-alerts] listUserAlerts failed:", error);
    return [];
  }
}
