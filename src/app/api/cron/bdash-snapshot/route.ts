/**
 * Cron รายวัน — ภาพรวมธุรกิจ (bdash, mumate-business-metrics-001): คำนวณตัวเลขทั้งห้าของ "เมื่อวาน" (วันไทย)
 * แล้วเก็บลง bdash_snapshot แถวเดียวต่อวัน (รันซ้ำวันเดียวกัน = เขียนทับ). หน้า /bdash อ่านแถวล่าสุดเท่านั้น
 * สมาชิกจึงไม่ต้องรอ query พวกนี้. ลบแถวที่เก่ากว่า 90 วัน.
 * ตั้งเวลา vercel.json: "0 20 * * *" = 03:00 น. ไทย (ช่วงคนใช้น้อยสุด) · บน DO รันโดย mumate-cron-bdash-snapshot.timer.
 *
 * ความปลอดภัย: ต้องแนบ Authorization: Bearer <CRON_SECRET>. ผลตอบกลับมีแต่ตัวเลข ไม่มีข้อมูลรายคน.
 */
import { lt, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { bdashSnapshot } from "@/db/schema";
import { computeBdashSnapshot } from "@/lib/bdash/compute";
import { addDays } from "@/lib/bdash/shape";
import { todayBangkok } from "@/lib/bazi/manifest/dates";
import { getCronSecret } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEEP_DAYS = 90;

function authorized(req: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  return (req.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

async function handle(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return Response.json({ error: { message: "unauthorized" } }, { status: 401 });
  }

  const today = todayBangkok();
  const asOf = addDays(today, -1);
  const db = createDbClient();
  const started = Date.now();
  try {
    const payload = await computeBdashSnapshot(db, asOf);
    const durationMs = Date.now() - started;
    await db
      .insert(bdashSnapshot)
      .values({ asOf, durationMs, payload })
      .onConflictDoUpdate({ target: bdashSnapshot.asOf, set: { durationMs, payload, computedAt: sql`now()` } });
    const pruned = await db
      .delete(bdashSnapshot)
      .where(lt(bdashSnapshot.asOf, addDays(today, -KEEP_DAYS)))
      .returning({ asOf: bdashSnapshot.asOf });
    console.log(`[cron/bdash-snapshot] as_of=${asOf} computed in ${durationMs} ms, pruned ${pruned.length}`);
    return Response.json({ ok: true, asOf, durationMs, saved: 1, pruned: pruned.length });
  } catch (error) {
    console.error("[cron/bdash-snapshot] failed:", error);
    return Response.json({ error: { message: "db error" } }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
