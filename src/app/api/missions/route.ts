import { and, eq, sql } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziMissionProgress } from "@/db/schema";
import { todayBangkok } from "@/lib/bazi/manifest/dates";
import { applyLedger } from "@/lib/bazi/manifest/ledger";
import { MISSION_BY_ID, MISSION_DEFS, type MissionDef } from "@/lib/bazi/manifest/missions";

export const runtime = "nodejs";

/**
 * /api/missions — จอ mission-board.
 *   GET  ?anonId=...                       → ภารกิจทั้งหมด + ความคืบหน้ารอบปัจจุบัน
 *   POST { anonId, missionId, increment? } → เพิ่มความคืบหน้า; ครบเป้า → จ่ายรางวัลอัตโนมัติครั้งเดียว
 */

function periodKeyOf(def: MissionDef, today: string): string {
  return def.period === "daily" ? today : "all";
}

const PostSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  missionId: z.string().trim().min(1),
  increment: z.number().int().min(1).max(100).default(1),
});

export async function GET(request: Request) {
  try {
    const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });

    const today = todayBangkok();
    const db = createDbClient();
    const rows = await db
      .select()
      .from(baziMissionProgress)
      .where(eq(baziMissionProgress.anonId, anonId));
    const byKey = new Map(rows.map((r) => [`${r.missionId}|${r.periodKey}`, r]));

    const missions = MISSION_DEFS.map((def) => {
      const row = byKey.get(`${def.id}|${periodKeyOf(def, today)}`);
      const count = Math.min(row?.count ?? 0, def.target);
      return {
        ...def,
        count,
        completed: count >= def.target,
        claimedAt: row?.claimedAt ?? null,
      };
    });

    return Response.json({ anonId, date: today, missions }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown missions error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());
    const def = MISSION_BY_ID.get(body.missionId);
    if (!def) return Response.json({ error: "ไม่รู้จักภารกิจนี้" }, { status: 404 });

    const today = todayBangkok();
    const periodKey = periodKeyOf(def, today);
    const db = createDbClient();

    // upsert + เพิ่ม count (cap ที่ target)
    const [row] = await db
      .insert(baziMissionProgress)
      .values({ anonId: body.anonId, missionId: def.id, periodKey, count: Math.min(body.increment, def.target) })
      .onConflictDoUpdate({
        target: [baziMissionProgress.anonId, baziMissionProgress.missionId, baziMissionProgress.periodKey],
        set: {
          count: sql`least(${baziMissionProgress.count} + ${body.increment}, ${def.target})`,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    // ครบเป้าและยังไม่จ่าย → จ่ายรางวัล (claim กันซ้ำด้วย conditional update)
    let rewarded = false;
    if (row.count >= def.target && !row.claimedAt) {
      const claimed = await db
        .update(baziMissionProgress)
        .set({ claimedAt: sql`now()` })
        .where(
          and(
            eq(baziMissionProgress.anonId, body.anonId),
            eq(baziMissionProgress.missionId, def.id),
            eq(baziMissionProgress.periodKey, periodKey),
            sql`${baziMissionProgress.claimedAt} is null`,
          ),
        )
        .returning({ missionId: baziMissionProgress.missionId });
      if (claimed.length) {
        await applyLedger({
          anonId: body.anonId,
          coinDelta: def.rewardCoins,
          xpDelta: def.rewardXp,
          reason: `mission:${def.id}`,
          ref: periodKey,
        });
        rewarded = true;
      }
    }

    return Response.json(
      {
        missionId: def.id,
        periodKey,
        count: row.count,
        target: def.target,
        completed: row.count >= def.target,
        rewarded,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid mission payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown missions error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
