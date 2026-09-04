import { desc, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import {
  baziAccountDeletion,
  baziConsent,
  baziCorrectionRequest,
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
 *   GET ?anonId= → JSON เดียวรวมทุกอย่างที่ engine เก็บของผู้ใช้นี้ (ดาวน์โหลดจากหน้า FE)
 */

export async function GET(request: Request) {
  try {
    const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });
    const db = createDbClient();

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
