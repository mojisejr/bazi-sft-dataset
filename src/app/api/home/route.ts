import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z, ZodError } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { createDbClient } from "@/db/client";
import {
  baziManifestCheckin,
  baziManifestEntry,
  baziManifestGoal,
  baziManifestTask,
  baziMissionProgress,
  baziUserIntent,
} from "@/db/schema";
import { applyMatchingOverrides } from "@/lib/bazi/matching-overlay";
import { getMatchingMap } from "@/lib/bazi/matching.server";
import { buildManVsDay, type ManPillars } from "@/lib/bazi/manvsday";
import { computeStreak, todayBangkok } from "@/lib/bazi/manifest/dates";
import { getWallet, levelOfXp } from "@/lib/bazi/manifest/ledger";
import { MISSION_DEFS } from "@/lib/bazi/manifest/missions";
import type { DayPillar } from "@/lib/bazi/pair-types";
import { gradeForPercent } from "@/lib/bazi/pair-matching";
import { buildHomePersona, type HomePersona } from "@/lib/bazi/home-persona";
import { type BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";

export const runtime = "nodejs";

/**
 * POST /api/home — aggregator หน้า Home (UI ใหม่): เรียกครั้งเดียวได้ทุกการ์ด.
 * Body: { anonId, person?: RawInput }
 *   - person มี   → การ์ด "ดวงวันนี้" (% + verdict + เหมาะ/เลี่ยง จาก manvsday)
 *   - person ไม่มี → ข้ามการ์ดดวง (ผู้ใช้ยังไม่กรอกวันเกิด)
 * ที่เหลือจาก DB: เป้าหมาย+ความคืบหน้า / สตรีค+บันทึกวันนี้ / เหรียญ+Level / ภารกิจวันนี้ / intent
 */

const PersonSchema = z.object({
  birthDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.string().trim().regex(/^\d{2}:\d{2}$/).default("12:00"),
  gender: z.string().trim().min(1).default("unspecified"),
  province: z.string().trim().min(1).default("กรุงเทพมหานคร"),
  calendarSystem: z.enum(["solar", "lunar"]).optional(),
  timezone: z.string().trim().min(1).optional(),
});

const Schema = z.object({
  anonId: z.string().trim().min(1).max(128),
  person: PersonSchema.optional(),
});

type HandlerOptions = { repository?: BaziKnowledgeRepository };

type BaziState = Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>;

function facetPillarsOf(state: BaziState): ManPillars {
  const p = state.fourPillars;
  const lite = (x: { stem: string; branch: string }): DayPillar => ({ stem: x.stem, branch: x.branch });
  return { hour: lite(p.hour), day: lite(p.day), month: lite(p.month), year: lite(p.year) };
}

export function createHomeHandler(options: HandlerOptions = {}) {
  return async function POST(request: Request) {
    try {
      const body = Schema.parse(await request.json());
      const today = todayBangkok();
      const [y, m, d] = today.split("-").map(Number);
      const db = createDbClient();

      // ── ดวงวันนี้ (ถ้ามีวันเกิด) — วิ่งขนานกับ query DB ──
      const fortunePromise = body.person
        ? (async () => {
            const repository = options.repository ?? createDbKnowledgeRepository();
            const state = await calculateBaziStateFromRawInput(body.person, { repository });
            const text = applyMatchingOverrides(await getMatchingMap());
            const result = buildManVsDay(
              facetPillarsOf(state),
              { stem: state.fourPillars.day.stem, branch: state.fourPillars.day.branch },
              y,
              m,
              d,
              text,
            );
            // Persona (Home "ธาตุของคุณ" line) — derived from the SAME calculatedState the fortune
            // uses, so element + strength never drift from the day's reading. Reuses the shared
            // element label helper + the existing strength classifier (no engine change). Guarded:
            // a bad score / unmapped symbol degrades persona to null but must NOT 500 the whole home
            // (manifest/wallet/missions still return).
            let persona: HomePersona | null = null;
            try {
              persona = buildHomePersona(state);
            } catch {
              persona = null;
            }

            return {
              fortune: {
                date: result.date,
                dayGanzhi: result.dayGanzhi,
                percent: result.overallPercent,
                // overall letter grade — reuse the existing mapper (single source of the ratingJson
                // thresholds), computed at the route so the Home card doesn't reimplement it.
                grade: gradeForPercent(result.overallPercent),
                verdict: result.verdict,
                summary: result.summary,
                // forward the already-computed headline + best/worst items the Home daily-fortune card
                // needs (buildManVsDay produces them; the route previously dropped them).
                summaryHeadline: result.summaryHeadline,
                summaryItems: result.summaryItems,
                facets: result.facets.map((f) => ({
                  key: f.key,
                  label: f.label,
                  percent: f.percent,
                  grade: f.grade,
                  isMain: f.isMain,
                })),
              },
              persona,
            };
          })()
        : Promise.resolve(null);

      const [personBundle, goals, entryDates, todayEntry, wallet, missionRows, intentRows] =
        await Promise.all([
          fortunePromise,
          db
            .select()
            .from(baziManifestGoal)
            .where(and(eq(baziManifestGoal.anonId, body.anonId), eq(baziManifestGoal.status, "active")))
            .orderBy(asc(baziManifestGoal.ordinal))
            .limit(5),
          db
            .select({ d: baziManifestEntry.entryDate })
            .from(baziManifestEntry)
            .where(eq(baziManifestEntry.anonId, body.anonId)),
          db
            .select({ d: baziManifestEntry.entryDate })
            .from(baziManifestEntry)
            .where(and(eq(baziManifestEntry.anonId, body.anonId), eq(baziManifestEntry.entryDate, today)))
            .limit(1),
          getWallet(body.anonId),
          db
            .select()
            .from(baziMissionProgress)
            .where(
              sql`${baziMissionProgress.anonId} = ${body.anonId} and ${baziMissionProgress.periodKey} in (${today}, 'all')`,
            ),
          db.select().from(baziUserIntent).where(eq(baziUserIntent.anonId, body.anonId)).limit(1),
        ]);

      // ความคืบหน้าเป้าหมาย (สรุปย่อสำหรับการ์ด)
      const goalIds = goals.map((g) => g.id);
      const tasks = goalIds.length
        ? await db.select().from(baziManifestTask).where(inArray(baziManifestTask.goalId, goalIds))
        : [];
      const taskIds = tasks.map((t) => t.id);
      const doneRows = taskIds.length
        ? await db
            .select({
              taskId: baziManifestCheckin.taskId,
              done: sql<number>`coalesce(sum(${baziManifestCheckin.count}), 0)::int`,
            })
            .from(baziManifestCheckin)
            .where(inArray(baziManifestCheckin.taskId, taskIds))
            .groupBy(baziManifestCheckin.taskId)
        : [];
      const doneByTask = new Map(doneRows.map((r) => [r.taskId, r.done]));
      const goalCards = goals.map((g) => {
        const gTasks = tasks.filter((t) => t.goalId === g.id);
        const target = gTasks.reduce((s, t) => s + t.targetCount, 0);
        const done = gTasks.reduce((s, t) => s + Math.min(doneByTask.get(t.id) ?? 0, t.targetCount), 0);
        return {
          id: g.id,
          title: g.title,
          affirmation: g.affirmation,
          imageUrl: g.imageUrl,
          percent: target ? Math.round((done / target) * 100) : 0,
        };
      });

      // ภารกิจวันนี้: ทำแล้วกี่อัน / ทั้งหมด
      const progressByMission = new Map(missionRows.map((r) => [r.missionId, r]));
      const missionsDone = MISSION_DEFS.filter((def) => {
        const row = progressByMission.get(def.id);
        return (row?.count ?? 0) >= def.target;
      }).length;

      return Response.json(
        {
          anonId: body.anonId,
          date: today,
          fortune: personBundle?.fortune ?? null,
          // Home "ธาตุของคุณ" line (element + day-master strength). null when no birth data (same
          // graceful rule as fortune) — the FE hides the line rather than showing a hole.
          persona: personBundle?.persona ?? null,
          manifest: {
            goals: goalCards,
            streak: computeStreak(entryDates.map((r) => r.d)),
            todayEntryDone: todayEntry.length > 0,
          },
          wallet: { ...wallet, ...levelOfXp(wallet.xp) },
          missions: { done: missionsDone, total: MISSION_DEFS.length },
          intent: intentRows[0]?.focus ?? [],
        },
        { status: 200 },
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json({ error: "Invalid home payload.", details: error.issues }, { status: 400 });
      }
      const message = error instanceof Error ? error.message : "Unknown home error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createHomeHandler();
