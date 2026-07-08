import { eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import {
  baziAchievement,
  baziManifestEntry,
  baziManifestGoal,
  baziReferralRedemption,
} from "@/db/schema";
import { BADGE_DEFS, type AchievementStats } from "@/lib/bazi/manifest/achievements";
import { computeStreak } from "@/lib/bazi/manifest/dates";
import { applyLedger, getWallet, levelOfXp } from "@/lib/bazi/manifest/ledger";

export const runtime = "nodejs";

/**
 * GET /api/achievements?anonId=... — จอ "ความสำเร็จ" (Level + เหรียญรางวัล + แชร์การ์ด).
 * คิดสถิติจริง → auto-unlock เหรียญที่เข้าเงื่อนไข (จ่ายรางวัลครั้งเดียว) → คืนรายการทั้งหมด.
 */

export async function GET(request: Request) {
  try {
    const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });

    const db = createDbClient();
    const [goalRows, entryRows, referralRows, wallet, unlockedRows] = await Promise.all([
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(baziManifestGoal)
        .where(eq(baziManifestGoal.anonId, anonId)),
      db
        .select({ d: baziManifestEntry.entryDate })
        .from(baziManifestEntry)
        .where(eq(baziManifestEntry.anonId, anonId)),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(baziReferralRedemption)
        .where(eq(baziReferralRedemption.referrerAnonId, anonId)),
      getWallet(anonId),
      db.select().from(baziAchievement).where(eq(baziAchievement.anonId, anonId)),
    ]);

    const dates = entryRows.map((r) => r.d);
    const stats: AchievementStats = {
      goalsCreated: goalRows[0]?.n ?? 0,
      bestStreak: computeStreak(dates).best,
      journalDays: dates.length,
      friendsInvited: referralRows[0]?.n ?? 0,
      level: levelOfXp(wallet.xp).level,
    };

    const unlocked = new Set(unlockedRows.map((r) => r.badgeId));

    // auto-unlock เหรียญใหม่ที่เข้าเงื่อนไข
    const newlyUnlocked: string[] = [];
    for (const badge of BADGE_DEFS) {
      if (unlocked.has(badge.id) || !badge.check(stats)) continue;
      const inserted = await db
        .insert(baziAchievement)
        .values({ anonId, badgeId: badge.id })
        .onConflictDoNothing()
        .returning({ badgeId: baziAchievement.badgeId });
      if (!inserted.length) continue; // แข่งกับ request อื่น — อีกฝั่งจ่ายแล้ว
      if (badge.rewardCoins || badge.rewardXp) {
        await applyLedger({
          anonId,
          coinDelta: badge.rewardCoins,
          xpDelta: badge.rewardXp,
          reason: `badge:${badge.id}`,
        });
      }
      unlocked.add(badge.id);
      newlyUnlocked.push(badge.id);
    }

    // ยอดล่าสุด (รวมรางวัลที่เพิ่งจ่าย)
    const finalWallet = newlyUnlocked.length ? await getWallet(anonId) : wallet;

    return Response.json(
      {
        anonId,
        stats,
        wallet: { ...finalWallet, ...levelOfXp(finalWallet.xp) },
        badges: BADGE_DEFS.map((b) => ({
          id: b.id,
          title: b.title,
          description: b.description,
          rewardCoins: b.rewardCoins,
          rewardXp: b.rewardXp,
          unlocked: unlocked.has(b.id),
        })),
        newlyUnlocked,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown achievements error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
