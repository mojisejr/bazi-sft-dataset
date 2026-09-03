import { lte, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import {
  baziAccountDeletion,
  baziConsent,
  baziCorrectionRequest,
  baziEntitlement,
  baziLedgerTxn,
  baziManifestCheckin,
  baziManifestEntry,
  baziManifestGoal,
  baziManifestTask,
  baziMissionProgress,
  baziNotificationPrefs,
  baziQiClaim,
  baziReferralCode,
  baziSavedChart,
  baziUserProfile,
  baziUserIntent,
  baziWallet,
} from "@/db/schema";

export const runtime = "nodejs";

/**
 * /api/cron/account-purge — ล้างข้อมูลบัญชีที่ "พักลบ" ครบ 30 วัน (delete-04: พักบัญชี 30 วัน).
 *   Bearer CRON_SECRET (fail-closed เหมือน cron อื่น) — ตั้งเวลาใน vercel.json.
 * ลบแถว bazi_* ของ anonId นั้นทั้งหมด แล้ว mark purged (เก็บแถวสถานะไว้กันสมัครใหม่มาแอบอ้าง);
 * ข้อมูลสมาชิกฝั่ง mootech-be ยังไม่อยู่ในขอบเขต (รอทีม BE)
 */

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const db = createDbClient();

  const now = new Date();
  const pending = await db
    .select({ anonId: baziAccountDeletion.anonId })
    .from(baziAccountDeletion)
    .where(lte(baziAccountDeletion.purgeAt, now));

  const purged: string[] = [];
  for (const { anonId } of pending) {
    // ล้างข้อมูลของ anonId นี้ — ตารางละคำสั่ง (ไม่ใช้ transaction ใหญ่: รายคนเสร็จเป็นชุด)
    await Promise.all([
      db.delete(baziUserProfile).where(eq(baziUserProfile.anonId, anonId)),
      db.delete(baziWallet).where(eq(baziWallet.anonId, anonId)),
      db.delete(baziLedgerTxn).where(eq(baziLedgerTxn.anonId, anonId)),
      db.delete(baziQiClaim).where(eq(baziQiClaim.anonId, anonId)),
      db.delete(baziMissionProgress).where(eq(baziMissionProgress.anonId, anonId)),
      db.delete(baziEntitlement).where(eq(baziEntitlement.anonId, anonId)),
      db.delete(baziReferralCode).where(eq(baziReferralCode.anonId, anonId)),
      db.delete(baziConsent).where(eq(baziConsent.anonId, anonId)),
      db.delete(baziNotificationPrefs).where(eq(baziNotificationPrefs.anonId, anonId)),
      db.delete(baziUserIntent).where(eq(baziUserIntent.anonId, anonId)),
      db.delete(baziSavedChart).where(eq(baziSavedChart.ownerId, anonId)),
      db.delete(baziCorrectionRequest).where(eq(baziCorrectionRequest.anonId, anonId)),
      db.delete(baziManifestGoal).where(eq(baziManifestGoal.anonId, anonId)),
      db.delete(baziManifestTask).where(eq(baziManifestTask.anonId, anonId)),
      db.delete(baziManifestCheckin).where(eq(baziManifestCheckin.anonId, anonId)),
      db.delete(baziManifestEntry).where(eq(baziManifestEntry.anonId, anonId)),
    ]);
    await db
      .update(baziAccountDeletion)
      .set({ status: "purged" })
      .where(eq(baziAccountDeletion.anonId, anonId));
    purged.push(anonId);
  }

  return Response.json({ ok: true, purgedCount: purged.length, purged }, { status: 200 });
}
