/**
 * Cron รายวัน (Vercel Cron) — housekeeping ระบบกิจกรรม (แต้ม Qi).
 * โควตาฟรีรายวัน reset โดยธรรมชาติอยู่แล้ว (period_key = วันไทย) — cron นี้ล้างแถวเก่า
 * (feature_quota + qi_claim ของ "daily" ที่ period_key < วันนี้) กันตารางบวม + รองรับ reset แคมเปญ.
 * ตั้งเวลา vercel.json: "0 17 * * *" = 00:00 น. ไทย.
 *
 * ความปลอดภัย: ต้องแนบ Authorization: Bearer <CRON_SECRET> (Vercel Cron แนบให้อัตโนมัติ).
 */
import { lt, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziFeatureQuota, baziQiClaim } from "@/db/schema";
import { todayBangkok } from "@/lib/bazi/manifest/dates";
import { getCronSecret } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const db = createDbClient();
  try {
    // ล้างโควตาฟรีของวันก่อน ๆ (period_key เป็นวันไทย "YYYY-MM-DD")
    const quota = await db
      .delete(baziFeatureQuota)
      .where(lt(baziFeatureQuota.periodKey, today))
      .returning({ anonId: baziFeatureQuota.anonId });
    // ล้าง qi_claim ของเส้น daily วันก่อน ๆ (period_key ตรงรูปแบบวันที่); เก็บ once("all")/per_referral ไว้
    const claims = await db
      .delete(baziQiClaim)
      .where(sql`${baziQiClaim.periodKey} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and ${baziQiClaim.periodKey} < ${today}`)
      .returning({ code: baziQiClaim.code });

    return Response.json({ ok: true, date: today, pruned: quota.length + claims.length });
  } catch (error) {
    console.error("[cron/qi-quota-reset] failed:", error);
    return Response.json({ error: { message: "db error" } }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
