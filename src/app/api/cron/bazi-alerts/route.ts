/**
 * Cron รายวัน (Vercel Cron) — push การเตือนที่ถึงกำหนดวันนี้ (Asia/Bangkok) ผ่าน LINE.
 * ตั้งเวลาใน vercel.json (แนะนำ 00:00 UTC = 07:00 น. ไทย).
 *
 * ความปลอดภัย: ต้องแนบ `Authorization: Bearer <CRON_SECRET>` — Vercel Cron แนบให้อัตโนมัติเมื่อมี env CRON_SECRET.
 * ถ้าไม่ได้ตั้ง CRON_SECRET จะปฏิเสธทุก request (กันคนภายนอกยิง push มั่ว).
 */
import { getCronSecret } from "@/lib/env";
import { getDueAlerts, markSent } from "@/lib/bazi/alerts/repository";
import { createLineMessagingClient } from "@/features/line-chat/line-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false; // ยังไม่ตั้ง CRON_SECRET → ปฏิเสธไว้ก่อน
  const h = req.headers.get("authorization") ?? "";
  return h === `Bearer ${secret}`;
}

async function handle(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return Response.json({ error: { message: "unauthorized" } }, { status: 401 });
  }

  const now = new Date();
  let due;
  try {
    due = await getDueAlerts(now);
  } catch (error) {
    console.error("[cron/bazi-alerts] getDueAlerts failed:", error);
    return Response.json({ error: { message: "db error" } }, { status: 500 });
  }
  if (due.length === 0) {
    return Response.json({ ok: true, due: 0, sent: 0 });
  }

  const client = createLineMessagingClient();
  const sentIds: string[] = [];
  let failed = 0;
  // ส่งทีละราย (จำนวนต่อวันไม่มาก) — สำเร็จค่อย mark sent เพื่อให้ retry รอบถัดไปได้ถ้าล้ม
  for (const alert of due) {
    try {
      await client.pushText(alert.lineUserId, alert.message);
      sentIds.push(alert.id);
    } catch (error) {
      failed += 1;
      console.error(`[cron/bazi-alerts] push failed for ${alert.id}:`, error);
    }
  }

  try {
    await markSent(sentIds, now);
  } catch (error) {
    console.error("[cron/bazi-alerts] markSent failed:", error);
  }

  return Response.json({ ok: true, due: due.length, sent: sentIds.length, failed });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
