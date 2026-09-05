import { desc, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import {
  baziAccountDeletion,
  baziConsent,
  baziCorrectionRequest,
  baziDataExportRequest,
  baziEntitlement,
  baziLedgerTxn,
  baziManifestGoal,
  baziMissionProgress,
  baziNotificationPrefs,
  baziReferralRedemption,
  baziSavedChart,
  baziUserProfile,
  baziWallet,
} from "@/db/schema";

export const runtime = "nodejs";

/**
 * /api/account/export — ส่งออกข้อมูลส่วนตัว (เฟรม privacy-data-export / PDPA).
 *   GET ?anonId=           → JSON เดียวรวมทุกอย่างที่ engine เก็บของผู้ใช้นี้ (ดาวน์โหลดทันที / backup)
 *   GET ?anonId=&status=1  → คำขอส่งออกล่าสุด (สถานะ async-email)
 *   POST {anonId,email}    → สร้างคำขอส่งออกแบบ async (บันทึก status=collecting)
 *
 * 🔴 ยังไม่ต่อ email provider: POST บันทึกคำขอจริง (คงสถานะ "collecting") แต่ยังไม่มีตัวส่งอีเมล/ไฟล์ CSV จริง
 *    — ต้องเลือก provider (Resend/SES/SMTP) + worker/cron รวบไฟล์ JSON+CSV แล้วส่ง แล้วอัปเดต status=emailed.
 */

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as { anonId?: string; email?: string };
    const anonId = (body.anonId ?? url.searchParams.get("anonId"))?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });
    const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;

    const db = createDbClient();
    const id = crypto.randomUUID();
    const [row] = await db
      .insert(baziDataExportRequest)
      .values({ id, anonId, email, status: "collecting" })
      .returning();

    // 🔴 TODO(email-provider): ที่นี่ต้อง enqueue งานรวบไฟล์ JSON+CSV แล้วส่งไปที่ email (ผ่าน Resend/SES/SMTP)
    //    แล้วอัปเดต status=emailed. ตอนนี้บันทึกคำขอไว้เฉย ๆ (collecting) — ไม่แจ้งผู้ใช้ว่า "ส่งแล้ว".
    return Response.json({ request: row, emailPipelineReady: false }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown export error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const anonId = url.searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });
    const db = createDbClient();

    // ?status=1 → คำขอส่งออกล่าสุด (สำหรับ FE แสดงสถานะ async-email)
    if (url.searchParams.get("status")) {
      const [latest] = await db
        .select()
        .from(baziDataExportRequest)
        .where(eq(baziDataExportRequest.anonId, anonId))
        .orderBy(desc(baziDataExportRequest.requestedAt))
        .limit(1);
      return Response.json({ request: latest ?? null }, { status: 200 });
    }

    const [profile, wallet, ledger, missions, entitlements, referrals, consents, prefs, charts, goals, correction, deletion] =
      await Promise.all([
        db.select().from(baziUserProfile).where(eq(baziUserProfile.anonId, anonId)).limit(1),
        db.select().from(baziWallet).where(eq(baziWallet.anonId, anonId)).limit(1),
        db
          .select({ reason: baziLedgerTxn.reason, qiDelta: baziLedgerTxn.qiDelta, coinDelta: baziLedgerTxn.coinDelta, xpDelta: baziLedgerTxn.xpDelta, createdAt: baziLedgerTxn.createdAt })
          .from(baziLedgerTxn)
          .where(eq(baziLedgerTxn.anonId, anonId))
          .orderBy(desc(baziLedgerTxn.createdAt))
          .limit(500),
        db.select().from(baziMissionProgress).where(eq(baziMissionProgress.anonId, anonId)),
        db.select().from(baziEntitlement).where(eq(baziEntitlement.anonId, anonId)),
        db.select().from(baziReferralRedemption).where(eq(baziReferralRedemption.refereeAnonId, anonId)),
        db.select().from(baziConsent).where(eq(baziConsent.anonId, anonId)),
        db.select().from(baziNotificationPrefs).where(eq(baziNotificationPrefs.anonId, anonId)).limit(1),
        db.select().from(baziSavedChart).where(eq(baziSavedChart.ownerId, anonId)),
        db.select().from(baziManifestGoal).where(eq(baziManifestGoal.anonId, anonId)),
        db.select().from(baziCorrectionRequest).where(eq(baziCorrectionRequest.anonId, anonId)),
        db.select().from(baziAccountDeletion).where(eq(baziAccountDeletion.anonId, anonId)).limit(1),
      ]);

    return Response.json(
      {
        exportedAt: new Date().toISOString(),
        anonId,
        profile: profile[0] ?? null,
        wallet: wallet[0] ?? null,
        ledger,
        missions,
        entitlements,
        referrals,
        consents,
        notificationPrefs: prefs[0] ?? null,
        savedCharts: charts,
        manifestGoals: goals,
        correctionRequests: correction,
        accountDeletion: deletion[0] ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown export error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
