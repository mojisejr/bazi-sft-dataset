import { eq, sql } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziAccountDeletion } from "@/db/schema";

export const runtime = "nodejs";

/**
 * /api/account/delete — ลบบัญชีแบบ "พัก 30 วัน" (เฟรม delete-04 pending-recovery + missing states).
 *   POST { anonId, reason? }   → ขอลบ: pending, purge_at = +30 วัน (idempotent — pending ซ้ำตอบ 409 พร้อมข้อมูล)
 *   GET  ?anonId=              → { deletion: {status, requestedAt, purgeAt} | null }
 *   DELETE ?anonId=            → ยกเลิกการลบ (กลับมาใช้ได้ทันที) — delete-04 "เปลี่ยนใจได้ใน 30 วัน"
 *   PATCH { anonId, feedback } → เก็บ feedback ของคนที่กำลังจะลบ (เฟรม delete-05b, แนบกับ pending เดิม)
 *
 * 🔴 ขอบเขต: เส้นนี้จัดสถานะ + cron purge ล้างข้อมูลฝั่ง engine (bazi_*) ตาม purge_at —
 * ข้อมูลสมาชิกเก่าใน mootech-be ยังไม่ถูกล้างในรอบนี้ (รอทีม BE ต่อ)
 */

const DAYS = 30;

const PostSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  reason: z.string().trim().max(500).optional(),
});

const PatchSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  feedback: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());
    const db = createDbClient();
    const purgeAt = new Date(Date.now() + DAYS * 24 * 60 * 60 * 1000);
    const inserted = await db
      .insert(baziAccountDeletion)
      .values({ anonId: body.anonId, status: "pending", reason: body.reason ?? null, purgeAt })
      .onConflictDoNothing()
      .returning({ requestedAt: baziAccountDeletion.requestedAt, purgeAt: baziAccountDeletion.purgeAt });
    if (!inserted.length) {
      const [row] = await db
        .select({ status: baziAccountDeletion.status, requestedAt: baziAccountDeletion.requestedAt, purgeAt: baziAccountDeletion.purgeAt })
        .from(baziAccountDeletion)
        .where(eq(baziAccountDeletion.anonId, body.anonId))
        .limit(1);
      if (row && row.status === "pending") {
        return Response.json({ error: "มีคำขอลบรออยู่แล้ว", status: row.status, requestedAt: row.requestedAt, purgeAt: row.purgeAt }, { status: 409 });
      }
      // เคย canceled/purged → เริ่ม pending ใหม่ได้
      const [updated] = await db
        .update(baziAccountDeletion)
        .set({ status: "pending", reason: body.reason ?? null, requestedAt: sql`now()`, purgeAt, canceledAt: null })
        .where(eq(baziAccountDeletion.anonId, body.anonId))
        .returning({ requestedAt: baziAccountDeletion.requestedAt, purgeAt: baziAccountDeletion.purgeAt });
      return Response.json({ ok: true, status: "pending", requestedAt: updated.requestedAt, purgeAt: updated.purgeAt }, { status: 200 });
    }
    return Response.json({ ok: true, status: "pending", requestedAt: inserted[0].requestedAt, purgeAt: inserted[0].purgeAt }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid delete payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown delete error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });
    const db = createDbClient();
    const [row] = await db
      .select({ status: baziAccountDeletion.status, requestedAt: baziAccountDeletion.requestedAt, purgeAt: baziAccountDeletion.purgeAt })
      .from(baziAccountDeletion)
      .where(eq(baziAccountDeletion.anonId, anonId))
      .limit(1);
    return Response.json({ anonId, deletion: row && row.status === "pending" ? row : null }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown delete error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });
    const db = createDbClient();
    const [row] = await db
      .update(baziAccountDeletion)
      .set({ status: "canceled", canceledAt: sql`now()` })
      .where(eq(baziAccountDeletion.anonId, anonId))
      .returning({ status: baziAccountDeletion.status });
    if (!row || row.status !== "canceled") {
      return Response.json({ error: "ไม่พบคำขอลบที่รออยู่" }, { status: 404 });
    }
    return Response.json({ ok: true, status: "canceled" }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown delete error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = PatchSchema.parse(await request.json());
    const db = createDbClient();
    const [row] = await db
      .update(baziAccountDeletion)
      .set({ feedback: body.feedback })
      .where(eq(baziAccountDeletion.anonId, body.anonId))
      .returning({ anonId: baziAccountDeletion.anonId });
    // ไม่มี pending ก็ไม่เป็นไร — feedback เป็นของแถม ไม่บล็อก flow
    return Response.json({ ok: true, attached: Boolean(row) }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid feedback payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown feedback error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
