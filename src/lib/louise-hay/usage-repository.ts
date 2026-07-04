/**
 * Repository ของสถิติการใช้งาน + โทเคน API แชท "โค้ชฮีลใจ" (ตาราง louise_hay_usage).
 *
 * - logUsage: บันทึก 1 แถวต่อ 1 คำถาม–คำตอบ (เรียกแบบ fire-and-forget จาก route, ล้มเงียบได้)
 * - getUsageStats: ดึงข้อมูลดิบล่าสุด (จำกัดจำนวน) ให้ API แดชบอร์ดไปสรุป/คำนวณต้นทุนเอง
 *
 * server-only.
 */
import { desc } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { louiseHayUsage, type InsertLouiseHayUsage, type SelectLouiseHayUsage } from "@/db/schema";

export type LouiseHayUsageInput = Omit<InsertLouiseHayUsage, "id" | "createdAt">;

/** บันทึกการใช้งาน 1 แถว — ล้มเหลวแบบเงียบ (ไม่กระทบการตอบผู้ใช้) */
export async function logUsage(input: LouiseHayUsageInput): Promise<void> {
  try {
    const db = createDbClient();
    await db.insert(louiseHayUsage).values(input);
  } catch (error) {
    console.error("[louise-hay] logUsage failed:", error);
  }
}

export type UsageRow = SelectLouiseHayUsage;

/** ดึงแถวล่าสุด (ใหม่ก่อน) ให้แดชบอร์ดสรุป — คืน [] ถ้า DB ล่ม/ตารางยังไม่มี */
export async function getUsageRows(limit = 2000): Promise<UsageRow[]> {
  try {
    const db = createDbClient();
    return await db
      .select()
      .from(louiseHayUsage)
      .orderBy(desc(louiseHayUsage.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[louise-hay] getUsageRows failed:", error);
    return [];
  }
}
