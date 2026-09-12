import { and, eq, inArray, sql } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziMissionProgress, baziReferralRedemption, baziUserProfile } from "@/db/schema";
import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { todayBangkok } from "@/lib/bazi/manifest/dates";
import { applyLedger } from "@/lib/bazi/manifest/ledger";
import { ELEMENT_ORDER, MISSION_BY_ID, MISSION_DEFS, type MissionDef } from "@/lib/bazi/manifest/missions";
import { earnQi } from "@/lib/bazi/qi/engine";
import { STEM_TO_ELEMENT } from "@/lib/bazi/symbolic-engine.constants";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";

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

// ธาตุ day-master ของเพื่อน = birth-deterministic (ไม่เปลี่ยนตามเวลา) → memo ต่อ birth-signature ทั้ง process
// เดิม GET /missions คำนวณ chart เต็ม "ต่อเพื่อน 1 คน" ทุกครั้ง (N+1) → ผู้ใช้ที่ชวนหลายคนเจอ ~10s ต่อครั้ง.
// memo ระดับ module: hot instance โหลด /account ซ้ำ = เพื่อนเดิม → cache ครบ ข้ามการคำนวณ. cold start อุ่นใหม่.
const friendElementMemo = new Map<string, string | null>();
const FRIEND_ELEMENT_MEMO_MAX = 5000;

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

    // เป้าหมายระยะยาวที่คิดจากข้อมูล referral (ไม่ผ่าน mission_progress)
    const redemptions = await db
      .select({ referee: baziReferralRedemption.refereeAnonId })
      .from(baziReferralRedemption)
      .where(eq(baziReferralRedemption.referrerAnonId, anonId));

    // สะสมธาตุของเพื่อน — เป้า 5 ธาตุ. ฟีม (2026-09-10): ต้องใช้ "ธาตุจริง" ของเพื่อน = ธาตุประจำวัน (day-master)
    // ตัวเดียวกับที่โชว์บนโปรไฟล์/มาสคอต ไม่ใช่ธาตุปีเกิด (year stem) เดิมที่ทำให้ธาตุที่สะสมไม่ตรงกับที่เพื่อนเห็น.
    // day-master ขึ้นกับวันเกิดเป็นหลัก แต่ใช้เวลาเกิดจริงด้วยเพื่อให้ตรงเป๊ะกับโปรไฟล์ (กันเคสเวลาใกล้เที่ยงคืน).
    const elements = new Set<string>();
    if (redemptions.length) {
      const profs = await db
        .select({
          birthDate: baziUserProfile.birthDate,
          birthTime: baziUserProfile.birthTime,
          timeUnknown: baziUserProfile.timeUnknown,
          gender: baziUserProfile.gender,
          birthProvince: baziUserProfile.birthProvince,
        })
        .from(baziUserProfile)
        .where(inArray(baziUserProfile.anonId, redemptions.map((r) => r.referee)));
      const repository = createDbKnowledgeRepository();
      const keys = await Promise.all(
        profs.map(async (p) => {
          if (!p.birthDate) return null;
          // birth-signature = ตัวเดียวกับที่ป้อน engine → memo hit = ข้ามการคำนวณ chart (ต้นเหตุ N+1 ~10s)
          const birthDate = String(p.birthDate).slice(0, 10);
          const birthTime = !p.timeUnknown && p.birthTime ? String(p.birthTime).slice(0, 5) : "12:00";
          const gender = p.gender === "FEMALE" ? "female" : "male";
          const province = p.birthProvince || "Bangkok";
          const sig = `${birthDate}|${birthTime}|${gender}|${province}`;
          const memo = friendElementMemo.get(sig);
          if (memo !== undefined) return memo; // เคยคำนวณแล้ว (คน/instance เดิม) → ใช้ซ้ำ
          try {
            const state = await calculateBaziStateFromRawInput(
              { birthDate, birthTime, gender, province, calendarSystem: "solar", timezone: "Asia/Bangkok" },
              { repository },
            );
            const el = STEM_TO_ELEMENT[state.dayMaster as keyof typeof STEM_TO_ELEMENT] ?? null;
            if (friendElementMemo.size >= FRIEND_ELEMENT_MEMO_MAX) friendElementMemo.clear();
            friendElementMemo.set(sig, el);
            return el;
          } catch {
            return null; // เพื่อนคนนี้คำนวณดวงไม่ได้ (ข้อมูลเกิดไม่ครบ/พัง) → ข้ามไป ไม่ให้ล้มทั้ง goals
          }
        }),
      );
      for (const el of keys) if (el) elements.add(el);
    }
    const collected = elements.size;
    // แจ็กพอตครบ 5 ธาตุ = wuxing_matrix +1000 QI (once) — จ่ายอัตโนมัติครั้งเดียว (idempotent)
    if (collected >= 5) {
      await earnQi(anonId, "wuxing_matrix").catch(() => {});
    }

    const goals = {
      referral: {
        invited: redemptions.length,
        rewardPerInviteQi: 50,
        earnedQi: redemptions.length * 50,
      },
      element: {
        target: 5,
        collected,
        bonusQi: 1000,
        elements: ELEMENT_ORDER.map((key) => ({ key, collected: elements.has(key) })),
      },
    };

    return Response.json({ anonId, date: today, missions, goals }, { status: 200 });
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
          // รางวัลภารกิจเข้าเป็น QI (รวม coins→qi ทั้งแอป) — reason เดิม ทำให้โผล่ในประวัติ QI อัตโนมัติ
          qiDelta: def.rewardCoins,
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
