import { desc, eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import {
  baziLedgerTxn,
  baziManifestEntry,
  baziMissionProgress,
  baziReferralRedemption,
} from "@/db/schema";
import { getWallet, levelOfXp } from "@/lib/bazi/manifest/ledger";
import { MISSION_DEFS } from "@/lib/bazi/manifest/missions";
import { todayBangkok } from "@/lib/bazi/manifest/dates";

export const runtime = "nodejs";

/**
 * GET /api/karma?anonId=... — จอ Karma Dashboard (aggregate อย่างเดียว ไม่มี logic ใหม่).
 * คืน: แต้ม/Level + สถิติ (ภารกิจสำเร็จ/วันที่ใช้งาน/เพื่อนที่แนะนำ) + ภารกิจที่กำลังทำวันนี้ + ธุรกรรมล่าสุด.
 */

export async function GET(request: Request) {
  try {
    const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });

    const today = todayBangkok();
    const db = createDbClient();

    const [wallet, missionsDone, activeDays, invited, todayProgress, recentTxns] = await Promise.all([
      getWallet(anonId),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(baziMissionProgress)
        .where(sql`${baziMissionProgress.anonId} = ${anonId} and ${baziMissionProgress.claimedAt} is not null`),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(baziManifestEntry)
        .where(eq(baziManifestEntry.anonId, anonId)),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(baziReferralRedemption)
        .where(eq(baziReferralRedemption.referrerAnonId, anonId)),
      db
        .select()
        .from(baziMissionProgress)
        .where(sql`${baziMissionProgress.anonId} = ${anonId} and ${baziMissionProgress.periodKey} in (${today}, 'all')`),
      db
        .select()
        .from(baziLedgerTxn)
        .where(eq(baziLedgerTxn.anonId, anonId))
        .orderBy(desc(baziLedgerTxn.createdAt))
        .limit(10),
    ]);

    const progressByMission = new Map(todayProgress.map((r) => [r.missionId, r]));
    const inProgress = MISSION_DEFS.map((def) => {
      const row = progressByMission.get(def.id);
      const count = Math.min(row?.count ?? 0, def.target);
      return {
        id: def.id,
        title: def.title,
        rewardCoins: def.rewardCoins,
        count,
        target: def.target,
        completed: count >= def.target,
      };
    }).filter((m) => !m.completed);

    return Response.json(
      {
        anonId,
        wallet: { ...wallet, ...levelOfXp(wallet.xp) },
        stats: {
          missionsDone: missionsDone[0]?.n ?? 0,
          activeDays: activeDays[0]?.n ?? 0,
          friendsInvited: invited[0]?.n ?? 0,
        },
        missionsInProgress: inProgress,
        recentTxns,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown karma error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
