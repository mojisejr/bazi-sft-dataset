// /api/ops/coupon (#2 คูปอง Phase 2) — แอดมิน (/ops engine) สร้าง/ดู/พัก คูปองกิจกรรม (activity_coupon).
// secret-gated ด้วย OPS_ADMIN_SECRET (fail-closed) เหมือน /api/ops/entitlement.
//   GET  ?secret=                         → { coupons: [...] }
//   POST { secret, action:"create", ... } → สร้าง | { secret, action:"status", id, status } → พัก/เปิด
import { z, ZodError } from "zod";

import { listCoupons, validateCreate, createCoupon, setStatus, deleteCoupon } from "@/lib/bazi/qi/coupon";

export const runtime = "nodejs";

function unauthorized() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}

export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  const url = new URL(request.url);
  if (!secret || url.searchParams.get("secret") !== secret) return unauthorized();
  try {
    return Response.json({ coupons: await listCoupons() }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "coupon list error" }, { status: 500 });
  }
}

const PostSchema = z.object({ secret: z.string().trim().min(1) }).passthrough();

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = PostSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }
  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || body.secret !== secret) return unauthorized();

  try {
    if (body.action === "status") {
      const id = typeof body.id === "string" ? body.id : "";
      const status = body.status === "PAUSED" ? "PAUSED" : body.status === "ACTIVE" ? "ACTIVE" : body.status === "EXPIRED" ? "EXPIRED" : null;
      if (!id || !status) return Response.json({ error: "id + status required" }, { status: 400 });
      const ok = await setStatus(id, status);
      if (!ok) return Response.json({ error: "unknown id" }, { status: 404 });
      return Response.json({ ok: true, coupons: await listCoupons() }, { status: 200 });
    }
    if (body.action === "delete") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const del = await deleteCoupon(id);
      if (!del.ok) return Response.json({ error: "delete failed", reason: del.reason }, { status: 409 });
      return Response.json({ ok: true, coupons: await listCoupons() }, { status: 200 });
    }
    // default = create
    const checked = validateCreate(body);
    if (!checked.ok) return Response.json({ error: "invalid", reason: checked.reason }, { status: 400 });
    const created = await createCoupon(checked.value);
    if (!created.ok) return Response.json({ error: "create failed", reason: created.reason }, { status: 409 });
    return Response.json({ ok: true, id: created.id, coupons: await listCoupons() }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "coupon error" }, { status: 500 });
  }
}
