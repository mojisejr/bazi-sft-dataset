// /api/ops/ai-questions — คลังคำถามที่ผู้ใช้ถาม AI (เฉพาะคนยินยอม ai_training) สำหรับคัดไปเทรน (เอ็ม 2026-10-22)
// secret-gated ด้วย OPS_ADMIN_SECRET (fail-closed) เหมือน /api/ops/course-access · ไม่มีข้อมูลตัวคน (subject = hash)
//   GET  ?secret=&q=&topic=&label=&days=&limit=&offset=   → { total, rows, topics }
//   GET  ...&format=jsonl                                 → ไฟล์ .jsonl สำหรับเทรน (ทุกแถวที่ตรงตัวกรอง สูงสุด 50,000)
//   POST { secret, action:"label", ids, label }            → ติดป้าย good | bad | null
//   POST { secret, action:"delete", ids }                  → ลบแถวที่ไม่ต้องการ
//   POST { secret, action:"purge-expired" }                → ลบที่เก่ากว่า 2 ปี
import { sql, type SQL } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { purgeExpiredAiQuestions } from "@/lib/bazi/ai-question-log";

export const runtime = "nodejs";

function unauthorized() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}
function rowsOf(r: unknown): Record<string, unknown>[] {
  return (Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[];
}

export type AiQuestionRow = {
  id: string;
  question: string;
  source: string;
  persona: string | null;
  topicId: string | null;
  label: "good" | "bad" | null;
  createdAt: string;
};

function whereOf(p: URLSearchParams): SQL {
  const parts: SQL[] = [sql`TRUE`];
  const q = p.get("q")?.trim();
  if (q) parts.push(sql`question ILIKE ${`%${q}%`}`);
  const topic = p.get("topic")?.trim();
  if (topic) parts.push(sql`topic_id = ${topic}`);
  const label = p.get("label");
  if (label === "good" || label === "bad") parts.push(sql`label = ${label}`);
  else if (label === "none") parts.push(sql`label IS NULL`);
  const days = Number(p.get("days"));
  if (Number.isFinite(days) && days > 0) parts.push(sql`created_at >= now() - (${String(Math.floor(days))} || ' days')::interval`);
  return sql.join(parts, sql` AND `);
}

const toRow = (r: Record<string, unknown>): AiQuestionRow => ({
  id: String(r.id),
  question: String(r.question ?? ""),
  source: String(r.source ?? "chat"),
  persona: (r.persona as string | null) ?? null,
  topicId: (r.topic_id as string | null) ?? null,
  label: (r.label as "good" | "bad" | null) ?? null,
  createdAt: new Date(String(r.created_at)).toISOString(),
});

export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  const url = new URL(request.url);
  const p = url.searchParams;
  if (!secret || p.get("secret") !== secret) return unauthorized();
  const db = createDbClient();
  const where = whereOf(p);
  try {
    if (p.get("format") === "jsonl") {
      const r = await db.execute(sql`
        SELECT id, question, source, persona, topic_id, label, created_at FROM ai_question_log
         WHERE ${where} ORDER BY created_at DESC LIMIT 50000`);
      const body = rowsOf(r)
        .map((x) => JSON.stringify({ question: x.question, topic: x.topic_id ?? null, persona: x.persona ?? null, label: x.label ?? null, source: x.source }))
        .join("\n");
      return new Response(body ? `${body}\n` : "", {
        status: 200,
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Content-Disposition": `attachment; filename="ai-questions-${new Date().toISOString().slice(0, 10)}.jsonl"`,
        },
      });
    }
    const limit = Math.min(200, Math.max(1, Number(p.get("limit")) || 50));
    const offset = Math.max(0, Number(p.get("offset")) || 0);
    const [rows, total, topics] = await Promise.all([
      db.execute(sql`
        SELECT id, question, source, persona, topic_id, label, created_at FROM ai_question_log
         WHERE ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`),
      db.execute(sql`SELECT COUNT(*)::int AS n FROM ai_question_log WHERE ${where}`),
      db.execute(sql`SELECT topic_id, COUNT(*)::int AS n FROM ai_question_log GROUP BY topic_id ORDER BY n DESC LIMIT 40`),
    ]);
    return Response.json({
      total: Number(rowsOf(total)[0]?.n ?? 0),
      rows: rowsOf(rows).map(toRow),
      topics: rowsOf(topics).map((t) => ({ topicId: (t.topic_id as string | null) ?? null, n: Number(t.n) })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ai-questions error";
    return Response.json({ error: message }, { status: 500 });
  }
}

const PostSchema = z.discriminatedUnion("action", [
  z.object({ secret: z.string(), action: z.literal("label"), ids: z.array(z.string().uuid()).min(1).max(500), label: z.enum(["good", "bad"]).nullable() }),
  z.object({ secret: z.string(), action: z.literal("delete"), ids: z.array(z.string().uuid()).min(1).max(500) }),
  z.object({ secret: z.string(), action: z.literal("purge-expired") }),
]);

export async function POST(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  try {
    const body = PostSchema.parse(await request.json());
    if (!secret || body.secret !== secret) return unauthorized();
    const db = createDbClient();
    if (body.action === "purge-expired") {
      return Response.json({ ok: true, deleted: await purgeExpiredAiQuestions() });
    }
    const ids = sql.join(body.ids.map((id) => sql`${id}::uuid`), sql`, `);
    if (body.action === "delete") {
      const r = await db.execute(sql`DELETE FROM ai_question_log WHERE id IN (${ids}) RETURNING id`);
      return Response.json({ ok: true, deleted: rowsOf(r).length });
    }
    const r = await db.execute(sql`UPDATE ai_question_log SET label = ${body.label} WHERE id IN (${ids}) RETURNING id`);
    return Response.json({ ok: true, updated: rowsOf(r).length });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : "ai-questions error";
    return Response.json({ error: message }, { status: 500 });
  }
}
