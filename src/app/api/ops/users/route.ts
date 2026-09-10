import { desc, eq, ilike, or, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziUserProfile, baziWallet } from "@/db/schema";

export const runtime = "nodejs";

/**
 * /api/ops/users — รายชื่อผู้ใช้สำหรับหน้า admin (/ops) ในหลังบ้าน engine.
 * secret-gated ด้วย header x-ops-secret === OPS_ADMIN_SECRET (fail-closed). อ่านอย่างเดียว.
 *
 * แหล่งหลัก = ตาราง identity "user" (ผู้สมัคร "ทุกคน" รวมคนที่ยังไม่ตั้ง @name) LEFT JOIN
 * bazi_user_profile (วันเกิด/ชื่อฝั่ง engine — ชนะ legacy ถ้ามี) + bazi_wallet (QI).
 * prod: engine ใช้ Supabase เดียวกับ FE → ตาราง "user" มีจริง. local dev (Neon) ไม่มี "user"
 * → คำสั่งแรก throw แล้ว fallback ไปลิสต์เฉพาะ bazi_user_profile (ยังเทสหน้าได้).
 *
 *   GET ?q=<ชื่อ/อีเมล/anonId>&limit=<n>&offset=<n>  (q ว่าง = ล่าสุดก่อน)
 *   → { users: [...], total, limit, offset, source: "user"|"profile" }
 *      total = จำนวนที่ตรงเงื่อนไขทั้งหมด (ไว้แบ่งหน้า + โชว์ "มีกี่คนสมัคร")
 */

const rowsOf = (r: unknown): Record<string, unknown>[] =>
  Array.isArray(r) ? (r as Record<string, unknown>[]) : ((r as { rows?: Record<string, unknown>[] })?.rows ?? []);

const s = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

function shape(row: Record<string, unknown>) {
  const first = s(row.first_name) ?? s(row.u_name);
  const last = s(row.last_name) ?? s(row.u_surname);
  const display = s(row.display_name) ?? [first, last].filter(Boolean).join(" ").trim() ?? "";
  const timeUnknown = row.time_unknown === true || (row.time_unknown == null && row.is_remember_time === false);
  const legacyTime = row.is_remember_time === false ? null : s(row.u_time)?.slice(0, 5) ?? null;
  return {
    anonId: String(row.anon_id ?? ""),
    displayName: display || first || "(ไม่มีชื่อ)",
    handle: s(row.display_name), // @name จริง (raw) สำหรับแก้ไข — null = ยังไม่ตั้ง
    firstName: first,
    lastName: last,
    email: s(row.email),
    gender: s(row.p_gender) ?? s(row.u_gender),
    birthDate: s(row.birth_date) ?? s(row.u_dob)?.slice(0, 10) ?? null,
    birthTime: timeUnknown ? null : s(row.birth_time)?.slice(0, 5) ?? legacyTime,
    timeUnknown,
    birthProvince: s(row.birth_province) ?? s(row.u_place),
    qi: typeof row.qi === "number" ? row.qi : Number(row.qi ?? 0) || 0,
    provider: s(row.provider), // 'LINE' | 'GOOGLE' | null (มาจาก user_provider)
    providerName: s(row.provider_name), // ชื่อจาก provider ตอน login (LINE/Google)
    lineId: (s(row.provider)?.toUpperCase() === "LINE" ? s(row.provider_id_token) : null), // id_token ของ LINE = LINE userId
    hasProfile: row.display_name != null,
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || request.headers.get("x-ops-secret") !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const provider = (url.searchParams.get("provider")?.trim() ?? "").toUpperCase(); // '' | 'LINE' | 'GOOGLE' | ...
  const limitRaw = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 1000) : 100;
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;

  const db = createDbClient();

  // ── แหล่งหลัก: ตาราง identity "user" (ผู้สมัครทุกคน) ──
  try {
    const like = `%${q}%`;
    // provider (LINE/Google) + LINE id มาจาก user_provider (id_token ของ LINE = LINE userId). lateral เอา
    // แถวล่าสุดต่อ user. ค้นครอบ: ชื่อไลน์(u.name)/account_name/สกุล/email/anonId + @name(display_name) +
    // ชื่อที่ตั้ง(first_name/last_name) + LINE id(id_token) + ชื่อ provider(prov.name)
    const conds = [] as ReturnType<typeof sql>[];
    if (q)
      conds.push(
        sql`(u.name ILIKE ${like} OR u.account_name ILIKE ${like} OR u.surname ILIKE ${like} OR u.email ILIKE ${like} OR u.user_id ILIKE ${like} OR p.display_name ILIKE ${like} OR p.first_name ILIKE ${like} OR p.last_name ILIKE ${like} OR prov.id_token ILIKE ${like} OR prov.provider_name ILIKE ${like})`,
      );
    if (provider) conds.push(sql`upper(prov.provider) = ${provider}`);
    const where = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;
    const from = sql`
      FROM "user" u
      LEFT JOIN bazi_user_profile p ON p.anon_id = u.user_id
      LEFT JOIN bazi_wallet w ON w.anon_id = u.user_id
      LEFT JOIN LATERAL (
        SELECT provider, id_token, name AS provider_name
        FROM user_provider up WHERE up.user_id = u.user_id
        ORDER BY up.update_at DESC LIMIT 1
      ) prov ON true`;
    const countRes = await db.execute(sql`SELECT count(*)::int AS n ${from} ${where}`);
    const total = Number(rowsOf(countRes)[0]?.n ?? 0);
    const res = await db.execute(sql`
      SELECT u.user_id AS anon_id, u.name AS u_name, u.surname AS u_surname, u.email,
             u.gender AS u_gender, u.dob AS u_dob, u.time AS u_time, u.is_remember_time,
             u.place_name AS u_place, u.update_at AS updated_at,
             prov.provider, prov.id_token AS provider_id_token, prov.provider_name,
             p.display_name, p.first_name, p.last_name, p.gender AS p_gender,
             p.birth_date, p.birth_time, p.time_unknown, p.birth_province,
             w.qi
      ${from}
      ${where}
      ORDER BY u.update_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `);
    return Response.json({ users: rowsOf(res).map(shape), total, limit, offset, source: "user" }, { status: 200 });
  } catch {
    // ── fallback (local dev / ไม่มีตาราง "user"): ลิสต์จาก bazi_user_profile อย่างเดียว ──
    try {
      const base = db
        .select({
          anonId: baziUserProfile.anonId,
          displayName: baziUserProfile.displayName,
          firstName: baziUserProfile.firstName,
          lastName: baziUserProfile.lastName,
          email: baziUserProfile.email,
          gender: baziUserProfile.gender,
          birthDate: baziUserProfile.birthDate,
          birthTime: baziUserProfile.birthTime,
          timeUnknown: baziUserProfile.timeUnknown,
          birthProvince: baziUserProfile.birthProvince,
          qi: baziWallet.qi,
          updatedAt: baziUserProfile.updatedAt,
        })
        .from(baziUserProfile)
        .leftJoin(baziWallet, eq(baziWallet.anonId, baziUserProfile.anonId));
      const cond = q
        ? or(
            ilike(baziUserProfile.displayName, `%${q}%`),
            ilike(baziUserProfile.firstName, `%${q}%`),
            ilike(baziUserProfile.lastName, `%${q}%`),
            ilike(baziUserProfile.email, `%${q}%`),
            ilike(baziUserProfile.anonId, `%${q}%`),
          )
        : undefined;
      const rows = await (cond ? base.where(cond) : base).orderBy(desc(baziUserProfile.updatedAt)).limit(limit).offset(offset);
      const countRes = await db.execute(
        cond ? sql`SELECT count(*)::int AS n FROM bazi_user_profile WHERE display_name ILIKE ${`%${q}%`} OR first_name ILIKE ${`%${q}%`} OR last_name ILIKE ${`%${q}%`} OR email ILIKE ${`%${q}%`} OR anon_id ILIKE ${`%${q}%`}` : sql`SELECT count(*)::int AS n FROM bazi_user_profile`,
      );
      const total = Number(rowsOf(countRes)[0]?.n ?? rows.length);
      return Response.json(
        { users: rows.map((r) => ({ ...r, qi: r.qi ?? 0, provider: null, providerName: null, lineId: null, hasProfile: true })), total, limit, offset, source: "profile" },
        { status: 200 },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown ops users error.";
      return Response.json({ error: message }, { status: 500 });
    }
  }
}
