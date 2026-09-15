import { sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";

export const runtime = "nodejs";

/**
 * /api/ops/user-attribution?anonId= — โปรไฟล์รายคนสำหรับ /ops:
 *   จ่ายเงิน (v2_payment) · คูปองที่ใช้ (discount + reward) · เข้ามาทางไหน (provider) · ref (ใครชวน / ชวนใคร).
 * secret-gated header x-ops-secret. อ่านอย่างเดียว.
 */
const rowsOf = (r: unknown) => (Array.isArray(r) ? r : ((r as { rows?: unknown[] })?.rows ?? []));

export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || request.headers.get("x-ops-secret") !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("anonId")?.trim();
  if (!id) return Response.json({ error: "anonId required" }, { status: 400 });

  try {
    const db = createDbClient();
    const payments = await db.execute(sql`
      SELECT package_code, tier_code, ROUND(amount_satang / 100.0, 2) AS baht, method, to_char(created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS day
        FROM v2_payment WHERE user_id = ${id} AND status = 'APPROVED' ORDER BY created_at DESC LIMIT 50`);
    const discounts = await db.execute(sql`
      SELECT dc.code, ROUND(r.discount_satang / 100.0, 2) AS baht, to_char(r.redeemed_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS day
        FROM discount_redemption r JOIN discount_code dc ON dc.id = r.code_id WHERE r.user_id = ${id} ORDER BY r.redeemed_at DESC LIMIT 50`);
    const rewards = await db.execute(sql`
      SELECT ac.code, ac.reward_kind AS kind, to_char(r.redeemed_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS day
        FROM activity_coupon_redemption r JOIN activity_coupon ac ON ac.id = r.coupon_id WHERE r.anon_id = ${id} ORDER BY r.redeemed_at DESC LIMIT 50`);
    const providers = await db.execute(sql`SELECT provider FROM user_provider WHERE user_id = ${id}`);
    const referredBy = await db.execute(sql`
      SELECT ffg.refer_user_id AS id, u.name FROM user_friend_get_friend ffg
        LEFT JOIN "user" u ON u.user_id = ffg.refer_user_id
       WHERE ffg.user_id = ${id} AND ffg.refer_user_id IS NOT NULL LIMIT 1`);
    const referred = await db.execute(sql`
      SELECT ffg.user_id AS id, u.name FROM user_friend_get_friend ffg
        LEFT JOIN "user" u ON u.user_id = ffg.user_id
       WHERE ffg.refer_user_id = ${id} ORDER BY 1 LIMIT 100`);

    const list = rowsOf(referred);
    return Response.json(
      {
        payments: rowsOf(payments),
        discounts: rowsOf(discounts),
        rewards: rowsOf(rewards),
        providers: rowsOf(providers).map((p) => (p as { provider?: string }).provider),
        referredBy: rowsOf(referredBy)[0] ?? null,
        referred: { count: list.length, list: list.slice(0, 20) },
      },
      { status: 200 },
    );
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "attribution error" }, { status: 500 });
  }
}
