import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziManifestCheckin, baziManifestGoal, baziManifestTask } from "@/db/schema";

export const runtime = "nodejs";

/**
 * /api/manifest/goals — เป้าหมาย Manifestation (จอ Manifest Home / goal-detail).
 *   GET    ?anonId=...            → goals + tasks + progress (doneCount จาก checkins)
 *   POST   { anonId, title, affirmation?, imageUrl?, tasks?[] } → สร้าง goal + tasks
 *   PATCH  { anonId, id, title?/affirmation?/imageUrl?/status?/ordinal? } → แก้ goal
 *   DELETE { anonId, id }         → ลบ goal + tasks + checkins ของมัน
 */

const MAX_GOALS = 5;

const TaskInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  targetCount: z.number().int().min(1).max(1000).default(1),
  isDaily: z.boolean().default(true),
});

const CreateSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(200),
  affirmation: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().max(2000).optional(),
  tasks: z.array(TaskInputSchema).max(20).default([]),
});

const PatchSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  affirmation: z.string().trim().max(500).nullable().optional(),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["active", "done", "archived"]).optional(),
  ordinal: z.number().int().min(0).max(1000).optional(),
});

const DeleteSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  id: z.string().uuid(),
});

export async function GET(request: Request) {
  try {
    const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });

    const db = createDbClient();
    const goals = await db
      .select()
      .from(baziManifestGoal)
      .where(eq(baziManifestGoal.anonId, anonId))
      .orderBy(asc(baziManifestGoal.ordinal), asc(baziManifestGoal.createdAt));

    const goalIds = goals.map((g) => g.id);
    const tasks = goalIds.length
      ? await db
          .select()
          .from(baziManifestTask)
          .where(inArray(baziManifestTask.goalId, goalIds))
          .orderBy(asc(baziManifestTask.ordinal), asc(baziManifestTask.createdAt))
      : [];

    // doneCount ต่อ task จาก checkins (รวมทุกวัน)
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

    const payload = goals.map((g) => {
      const goalTasks = tasks
        .filter((t) => t.goalId === g.id)
        .map((t) => ({
          ...t,
          doneCount: Math.min(doneByTask.get(t.id) ?? 0, t.targetCount),
        }));
      const target = goalTasks.reduce((s, t) => s + t.targetCount, 0);
      const done = goalTasks.reduce((s, t) => s + t.doneCount, 0);
      return {
        ...g,
        tasks: goalTasks,
        progress: { done, target, percent: target ? Math.round((done / target) * 100) : 0 },
      };
    });

    return Response.json({ anonId, goals: payload }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown goals error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = CreateSchema.parse(await request.json());
    const db = createDbClient();

    const existing = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(baziManifestGoal)
      .where(and(eq(baziManifestGoal.anonId, body.anonId), eq(baziManifestGoal.status, "active")));
    if ((existing[0]?.n ?? 0) >= MAX_GOALS) {
      return Response.json({ error: `เป้าหมาย active ได้สูงสุด ${MAX_GOALS} ข้อ` }, { status: 409 });
    }

    const [goal] = await db
      .insert(baziManifestGoal)
      .values({
        anonId: body.anonId,
        title: body.title,
        affirmation: body.affirmation ?? null,
        imageUrl: body.imageUrl ?? null,
        ordinal: existing[0]?.n ?? 0,
      })
      .returning();

    const tasks = body.tasks.length
      ? await db
          .insert(baziManifestTask)
          .values(
            body.tasks.map((t, i) => ({
              goalId: goal.id,
              anonId: body.anonId,
              title: t.title,
              targetCount: t.targetCount,
              isDaily: t.isDaily,
              ordinal: i,
            })),
          )
          .returning()
      : [];

    return Response.json({ goal: { ...goal, tasks } }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid goal payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown goals error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = PatchSchema.parse(await request.json());
    const db = createDbClient();

    const set: Record<string, unknown> = { updatedAt: sql`now()` };
    if (body.title !== undefined) set.title = body.title;
    if (body.affirmation !== undefined) set.affirmation = body.affirmation;
    if (body.imageUrl !== undefined) set.imageUrl = body.imageUrl;
    if (body.status !== undefined) set.status = body.status;
    if (body.ordinal !== undefined) set.ordinal = body.ordinal;

    const updated = await db
      .update(baziManifestGoal)
      .set(set)
      .where(and(eq(baziManifestGoal.id, body.id), eq(baziManifestGoal.anonId, body.anonId)))
      .returning();

    if (!updated.length) return Response.json({ error: "ไม่พบเป้าหมาย" }, { status: 404 });
    return Response.json({ goal: updated[0] }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid goal payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown goals error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = DeleteSchema.parse(await request.json());
    const db = createDbClient();

    const deleted = await db
      .delete(baziManifestGoal)
      .where(and(eq(baziManifestGoal.id, body.id), eq(baziManifestGoal.anonId, body.anonId)))
      .returning({ id: baziManifestGoal.id });
    if (!deleted.length) return Response.json({ error: "ไม่พบเป้าหมาย" }, { status: 404 });

    // เก็บกวาด tasks + checkins ของ goal นี้ (ไม่มี FK cascade — Neon http)
    const goalTasks = await db
      .select({ id: baziManifestTask.id })
      .from(baziManifestTask)
      .where(eq(baziManifestTask.goalId, body.id));
    const taskIds = goalTasks.map((t) => t.id);
    if (taskIds.length) {
      await db.delete(baziManifestCheckin).where(inArray(baziManifestCheckin.taskId, taskIds));
      await db.delete(baziManifestTask).where(eq(baziManifestTask.goalId, body.id));
    }

    return Response.json({ deleted: body.id }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid goal payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown goals error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
