import { and, eq } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziManifestCheckin, baziManifestTask } from "@/db/schema";
import { DATE_RE, todayBangkok } from "@/lib/bazi/manifest/dates";

export const runtime = "nodejs";

/**
 * POST /api/manifest/checkin — ติ๊ก/ยกเลิกงานประจำวัน (จอ Daily Check + บันทึกย้อนหลัง).
 * Body: { anonId, taskId, date?("YYYY-MM-DD", default วันนี้ไทย), done(true=ติ๊ก, false=ถอน) }
 */

const Schema = z.object({
  anonId: z.string().trim().min(1).max(128),
  taskId: z.string().uuid(),
  date: z.string().regex(DATE_RE).optional(),
  done: z.boolean().default(true),
});

export async function POST(request: Request) {
  try {
    const body = Schema.parse(await request.json());
    const entryDate = body.date ?? todayBangkok();
    const db = createDbClient();

    // ยืนยันว่า task เป็นของ anonId นี้จริง
    const task = await db
      .select({ id: baziManifestTask.id })
      .from(baziManifestTask)
      .where(and(eq(baziManifestTask.id, body.taskId), eq(baziManifestTask.anonId, body.anonId)))
      .limit(1);
    if (!task.length) return Response.json({ error: "ไม่พบงานนี้" }, { status: 404 });

    if (body.done) {
      await db
        .insert(baziManifestCheckin)
        .values({ taskId: body.taskId, anonId: body.anonId, entryDate })
        .onConflictDoNothing();
    } else {
      await db
        .delete(baziManifestCheckin)
        .where(and(eq(baziManifestCheckin.taskId, body.taskId), eq(baziManifestCheckin.entryDate, entryDate)));
    }

    return Response.json({ taskId: body.taskId, date: entryDate, done: body.done }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid checkin payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown checkin error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
