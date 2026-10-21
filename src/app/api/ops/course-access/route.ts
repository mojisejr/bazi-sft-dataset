// /api/ops/course-access — ใครเข้าคอร์สออนไลน์ได้ + ให้/ถอนสิทธิ์ (เอ็ม 2026-10-21)
// secret-gated ด้วย OPS_ADMIN_SECRET (fail-closed) เหมือน /api/ops/course-video
//   GET  ?secret=&course=                       → { people: [...] } — ซื้อเอง (v2_payment) + แอดมินให้/ใช้โค้ด (bazi_entitlement kind=course)
//   POST { secret, course, anonId, action }     → action "grant" = ให้สิทธิ์ถาวร · "revoke" = ถอนสิทธิ์ที่แอดมิน/โค้ดให้ (ไม่แตะการซื้อ)
// สิทธิ์ฝั่งหน้าเว็บ (mootech-fe lib/course/access.ts) อ่านทั้งสองแหล่งนี้ + สมาชิกที่จ่ายเงินจริง (ไม่อยู่ในรายชื่อนี้ — นับตามแพ็กเกจ)
// ⚠️ แพ็กคอร์ส ต้องตรงกับ mootech-fe lib/course/content.ts COURSE_PACKAGES
import { sql } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { grantEntitlement } from "@/lib/bazi/qi/entitlements";

export const runtime = "nodejs";

const COURSES = ["calendar", "life-matrix"] as const;
type Course = (typeof COURSES)[number];
const PACKAGES: Record<Course, string[]> = {
  calendar: ["COURSE_CAL_490", "COURSE_BUNDLE_689", "COURSE_BUNDLE_790"],
  "life-matrix": ["COURSE_BUNDLE_689", "COURSE_BUNDLE_790", "COURSE_MATRIX_UP_300", "COURSE_MATRIX_199"],
};
const REVERSED_CODE = "gateway_reversed"; // = mootech-fe lib/payment/repo.ts REVERSED_CODE

function unauthorized() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}
function rowsOf(r: unknown): Record<string, unknown>[] {
  return (Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[];
}
const courseOf = (v: unknown): Course => (v === "life-matrix" ? "life-matrix" : "calendar");

export type CourseAccessPerson = {
  anonId: string;
  name: string;
  lineName: string | null;
  email: string | null;
  via: "purchase" | "grant" | "coupon";
  detail: string;
  at: string | null;
};

export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  const url = new URL(request.url);
  if (!secret || url.searchParams.get("secret") !== secret) return unauthorized();
  const course = courseOf(url.searchParams.get("course"));
  const db = createDbClient();
  const pk = PACKAGES[course];
  try {
    // ใช้ id เดียวกัน (user_id = anon_id) · ชื่อจาก "user" + LINE display name ล่าสุด (มิเรอร์ /api/ops/analytics)
    const bought = rowsOf(
      await db.execute(sql`
        SELECT DISTINCT ON (vp.user_id) vp.user_id AS anon_id, vp.package_code, ROUND(vp.amount_satang / 100.0) AS baht,
               to_char((vp.created_at AT TIME ZONE 'Asia/Bangkok'), 'YYYY-MM-DD HH24:MI') AS at,
               u.name AS u_name, u.surname AS u_surname, u.email, prov.provider_name
          FROM v2_payment vp
          LEFT JOIN "user" u ON u.user_id = vp.user_id
          LEFT JOIN LATERAL (SELECT name AS provider_name FROM user_provider up WHERE up.user_id = vp.user_id ORDER BY up.update_at DESC LIMIT 1) prov ON true
         WHERE vp.status = 'APPROVED' AND vp.package_code IN (${sql.join(pk.map((p) => sql`${p}`), sql`, `)})
           AND (vp.failure_code IS NULL OR vp.failure_code <> ${REVERSED_CODE})
         ORDER BY vp.user_id, vp.created_at DESC`),
    );
    const granted = rowsOf(
      await db.execute(sql`
        SELECT e.anon_id, to_char((e.created_at AT TIME ZONE 'Asia/Bangkok'), 'YYYY-MM-DD HH24:MI') AS at,
               u.name AS u_name, u.surname AS u_surname, u.email, prov.provider_name,
               (SELECT c.code FROM activity_coupon_redemption r JOIN activity_coupon c ON c.id = r.coupon_id
                 WHERE r.anon_id = e.anon_id AND c.reward_kind = 'course' AND c.tier_sku = ${course}
                 ORDER BY r.created_at DESC LIMIT 1) AS coupon_code
          FROM bazi_entitlement e
          LEFT JOIN "user" u ON u.user_id = e.anon_id
          LEFT JOIN LATERAL (SELECT name AS provider_name FROM user_provider up WHERE up.user_id = e.anon_id ORDER BY up.update_at DESC LIMIT 1) prov ON true
         WHERE e.kind = 'course' AND e.sku = ${course}
         ORDER BY e.created_at DESC`),
    );
    const nameOf = (r: Record<string, unknown>) => [r.u_name, r.u_surname].filter((x) => typeof x === "string" && x.trim()).join(" ") || "—";
    const people: CourseAccessPerson[] = [
      ...bought.map((r) => ({
        anonId: String(r.anon_id),
        name: nameOf(r),
        lineName: (r.provider_name as string | null) ?? null,
        email: (r.email as string | null) ?? null,
        via: "purchase" as const,
        detail: `${r.package_code} · ฿${r.baht}`,
        at: (r.at as string | null) ?? null,
      })),
      ...granted.map((r) => ({
        anonId: String(r.anon_id),
        name: nameOf(r),
        lineName: (r.provider_name as string | null) ?? null,
        email: (r.email as string | null) ?? null,
        via: r.coupon_code ? ("coupon" as const) : ("grant" as const),
        detail: r.coupon_code ? `โค้ด ${r.coupon_code}` : "แอดมินให้สิทธิ์",
        at: (r.at as string | null) ?? null,
      })),
    ];
    return Response.json({ course, people });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "course-access list error" }, { status: 500 });
  }
}

const PostSchema = z.object({
  secret: z.string().trim().min(1),
  course: z.enum(COURSES),
  anonId: z.string().trim().min(1).max(128),
  action: z.enum(["grant", "revoke"]),
});

export async function POST(request: Request) {
  let body: z.infer<typeof PostSchema>;
  try {
    body = PostSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }
  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || body.secret !== secret) return unauthorized();
  try {
    const db = createDbClient();
    if (body.action === "grant") {
      // มีบัญชีนี้จริงไหม (กันพิมพ์ id ผิดแล้วให้สิทธิ์ลอย ๆ)
      const u = rowsOf(await db.execute(sql`SELECT 1 FROM "user" WHERE user_id = ${body.anonId} LIMIT 1`));
      if (!u.length) return Response.json({ error: "ไม่พบผู้ใช้ id นี้" }, { status: 404 });
      await grantEntitlement(body.anonId, { type: "owned", kind: "course", sku: body.course });
    } else {
      await db.execute(sql`DELETE FROM bazi_entitlement WHERE anon_id = ${body.anonId} AND kind = 'course' AND sku = ${body.course}`);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "course-access save error" }, { status: 500 });
  }
}
