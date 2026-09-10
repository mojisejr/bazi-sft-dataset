import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";

export const runtime = "nodejs";

/**
 * /api/ops/subscription — แพ็กเกจ (tier PLUS/PRO/FREE) + ประวัติ + การจ่ายเงินของผู้ใช้.
 * อ่าน/เขียนตาราง FE `member_subscription` (+ `v2_payment` สำหรับประวัติจ่าย) — prod แชร์ Supabase เดียวกัน.
 * secret-gated (OPS_ADMIN_SECRET). local dev (Neon) ไม่มีตารางเหล่านี้ → คืน available:false / คำเตือน.
 *
 *   GET ?secret=&anonId=  → { available, current, history, payments }
 *   POST { secret, anonId, tierCode:'FREE'|'PLUS'|'PRO', startAt:'YYYY-MM-DD', expireAt:'YYYY-MM-DD', note? }
 *        → มาร์ก ACTIVE เดิมเป็น REPLACED แล้ว insert row ใหม่ (FREE = แค่เพิกถอน ACTIVE เดิม, ไม่ insert)
 */
const rowsOf = (r: unknown): Record<string, unknown>[] =>
  Array.isArray(r) ? (r as Record<string, unknown>[]) : ((r as { rows?: Record<string, unknown>[] })?.rows ?? []);

function ensureSecret(got: string | null): Response | null {
  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || got !== secret) return Response.json({ error: "Unauthorized." }, { status: 401 });
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const denied = ensureSecret(url.searchParams.get("secret"));
  if (denied) return denied;
  const anonId = url.searchParams.get("anonId")?.trim();
  if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });

  const db = createDbClient();
  try {
    const subs = rowsOf(
      await db.execute(sql`
        SELECT id, tier_code, package_code, amount_satang, start_at::text AS start_at,
               expire_at::text AS expire_at, status, v2_payment_id, created_at::text AS created_at
        FROM member_subscription WHERE user_id = ${anonId} ORDER BY created_at DESC`),
    );
    let payments: Record<string, unknown>[] = [];
    try {
      payments = rowsOf(
        await db.execute(sql`
          SELECT id, package_code, tier_code, amount_satang, vat_satang, method, status,
                 charge_id, created_at::text AS created_at
          FROM v2_payment WHERE user_id = ${anonId} ORDER BY created_at DESC LIMIT 50`),
      );
    } catch {
      /* ไม่มีตาราง v2_payment → ข้ามประวัติจ่าย */
    }
    const today = new Date().toISOString().slice(0, 10);
    const current =
      subs.find((r) => r.status === "ACTIVE" && String(r.expire_at) >= today) ?? null;
    return Response.json({ available: true, current, history: subs, payments }, { status: 200 });
  } catch {
    return Response.json({ available: false, current: null, history: [], payments: [], note: "ตาราง subscription ไม่พร้อม (local dev)" }, { status: 200 });
  }
}

const PostSchema = z.object({
  secret: z.string().trim().min(1),
  anonId: z.string().trim().min(1).max(128),
  tierCode: z.enum(["FREE", "PLUS", "PRO"]),
  startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expireAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof PostSchema>;
  try {
    body = PostSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid subscription payload.", details: error.issues }, { status: 400 });
    return Response.json({ error: "Invalid subscription payload." }, { status: 400 });
  }
  const denied = ensureSecret(body.secret);
  if (denied) return denied;
  if (body.expireAt < body.startAt) return Response.json({ error: "วันหมดอายุต้องไม่ก่อนวันเริ่ม" }, { status: 400 });

  const db = createDbClient();
  try {
    // เพิกถอน ACTIVE เดิมเสมอ (กันซ้อน) — ตัวเลือกล่าสุดชนะ
    await db.execute(sql`UPDATE member_subscription SET status = 'REPLACED' WHERE user_id = ${body.anonId} AND status = 'ACTIVE'`);
    // tier ฝั่ง engine อ่านจาก 2 แหล่ง (lib/bazi/qi/entitlements.getTier): bazi_entitlement kind='tier'
    // ก่อน แล้ว fallback member_subscription. ดังนั้นต้อง sync ทั้งคู่ — ไม่งั้น "FREE" ที่ล้างแค่
    // member_subscription จะไม่พอ (แถว bazi_entitlement tier=plus/pro ที่ค้างอยู่ทำให้ยัง unlimited แชท).
    if (body.tierCode === "FREE") {
      // เพิกถอน tier ฝั่ง entitlement ด้วย (best-effort)
      try {
        await db.execute(sql`UPDATE bazi_entitlement SET expires_at = now(), updated_at = now()
          WHERE anon_id = ${body.anonId} AND kind = 'tier' AND (expires_at IS NULL OR expires_at > now())`);
      } catch { /* ตารางไม่มี (local) → ข้าม */ }
      // 🔴 ต้นเหตุ "ตั้ง FREE แล้วเด้งกลับ PRO": FE resolveSubscription (lib/v2/subscription) เมื่อไม่มีแถว v2
      // member_subscription ACTIVE จะ fallback ไปอ่าน legacy `member_payment` (shadow ที่ provisioning เขียนไว้
      // ตอนจ่ายเงิน) — ถ้า plan_code='MEMBER' และ expire_at ยังไม่หมด = แอปเห็นเป็น PRO อยู่ดี. ต้อง "หมดอายุ"
      // shadow นี้ด้วย (ตั้ง expire_at เป็นอดีต) แอปถึงจะเป็น FREE จริง. best-effort — ไม่มีตาราง (local) → ข้าม.
      try {
        await db.execute(sql`UPDATE member_payment SET expire_at = '2000-01-01' WHERE user_id = ${body.anonId}`);
      } catch { /* ไม่มีตาราง member_payment (local) → ข้าม */ }
      return Response.json({ ok: true, tierCode: "FREE", revoked: true }, { status: 200 });
    }
    const id = randomUUID();
    const pkg = `ADMIN_${body.tierCode}`;
    await db.execute(sql`
      INSERT INTO member_subscription (id, user_id, tier_code, package_code, amount_satang, start_at, expire_at, status, created_at)
      VALUES (${id}, ${body.anonId}, ${body.tierCode}, ${pkg}, 0, ${body.startAt}, ${body.expireAt}, 'ACTIVE', now())`);
    // sync bazi_entitlement tier ให้ตรง (ฟีเจอร์ engine: quota แชท/ไพ่ อ่านจากตรงนี้ก่อน)
    const skuLower = body.tierCode.toLowerCase(); // 'plus' | 'pro'
    try {
      await db.execute(sql`
        INSERT INTO bazi_entitlement (anon_id, kind, sku, credits, expires_at, created_at, updated_at)
        VALUES (${body.anonId}, 'tier', ${skuLower}, 0, (${body.expireAt})::timestamptz, now(), now())
        ON CONFLICT (anon_id, kind, sku) DO UPDATE SET expires_at = EXCLUDED.expires_at, updated_at = now()`);
      // ปิด tier sku อื่น (เช่นเปลี่ยน plus→pro อย่าให้ plus ค้าง active)
      await db.execute(sql`UPDATE bazi_entitlement SET expires_at = now(), updated_at = now()
        WHERE anon_id = ${body.anonId} AND kind = 'tier' AND sku <> ${skuLower} AND (expires_at IS NULL OR expires_at > now())`);
    } catch { /* ตารางไม่มี (local) → ข้าม */ }
    return Response.json({ ok: true, id, tierCode: body.tierCode, startAt: body.startAt, expireAt: body.expireAt }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown subscription error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
