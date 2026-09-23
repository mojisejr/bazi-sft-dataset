import { sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * /api/ops/segment?type=plus|pro|qi500 — หา "กลุ่มลูกค้า" สำหรับ /ops (ปุ่มกรอง):
 *   plus/pro = member_subscription ACTIVE ยังไม่หมดอายุ ของ tier นั้น
 *   qi500    = bazi_wallet.qi > 500 (ทุก tier) — โชว์ tier ปัจจุบันถ้ามี
 * secret-gated header x-ops-secret. อ่านอย่างเดียว. เรียงตาม QI มาก→น้อย.
 */
const rowsOf = (r: unknown) => (Array.isArray(r) ? r : ((r as { rows?: unknown[] })?.rows ?? []));

export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || request.headers.get("x-ops-secret") !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const type = new URL(request.url).searchParams.get("type");
  if (type !== "plus" && type !== "pro" && type !== "qi500") {
    return Response.json({ error: "type must be plus|pro|qi500" }, { status: 400 });
  }

  try {
    const db = createDbClient();
    let rows: unknown[] = [];
    if (type === "plus" || type === "pro") {
      const tier = type.toUpperCase();
      const r = await db.execute(sql`
        SELECT t.* FROM (
          SELECT DISTINCT ON (ms.user_id)
                 ms.user_id AS anon_id, upper(ms.tier_code) AS tier_code, ms.expire_at::text AS expire_at,
                 COALESCE(w.qi, 0)::int AS qi, u.name AS u_name, u.surname AS u_surname, u.email,
                 prov.provider, prov.provider_name
            FROM member_subscription ms
            LEFT JOIN bazi_wallet w ON w.anon_id = ms.user_id
            LEFT JOIN "user" u ON u.user_id = ms.user_id
            LEFT JOIN LATERAL (
              SELECT provider, name AS provider_name FROM user_provider up
               WHERE up.user_id = ms.user_id ORDER BY up.update_at DESC LIMIT 1
            ) prov ON true
           WHERE ms.status = 'ACTIVE' AND upper(ms.tier_code) = ${tier}
             AND (ms.expire_at IS NULL OR ms.expire_at > now())
           ORDER BY ms.user_id, ms.expire_at DESC NULLS LAST
        ) t ORDER BY t.qi DESC LIMIT 300`);
      rows = rowsOf(r);
    } else {
      const r = await db.execute(sql`
        SELECT w.anon_id AS anon_id, upper(ms.tier_code) AS tier_code, ms.expire_at::text AS expire_at,
               w.qi::int AS qi, u.name AS u_name, u.surname AS u_surname, u.email, prov.provider, prov.provider_name
          FROM bazi_wallet w
          LEFT JOIN "user" u ON u.user_id = w.anon_id
          LEFT JOIN LATERAL (
            SELECT upper(tier_code) AS tier_code, expire_at FROM member_subscription m
             WHERE m.user_id = w.anon_id AND m.status = 'ACTIVE' AND (m.expire_at IS NULL OR m.expire_at > now())
             ORDER BY m.expire_at DESC NULLS LAST LIMIT 1
          ) ms ON true
          LEFT JOIN LATERAL (
            SELECT provider, name AS provider_name FROM user_provider up
             WHERE up.user_id = w.anon_id ORDER BY up.update_at DESC LIMIT 1
          ) prov ON true
         WHERE w.qi > 500 ORDER BY w.qi DESC LIMIT 300`);
      rows = rowsOf(r);
    }
    return Response.json({ type, users: rows }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "segment error" }, { status: 500 });
  }
}
