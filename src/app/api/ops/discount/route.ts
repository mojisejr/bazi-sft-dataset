// /api/ops/discount (#2 คูปอง · ลดราคาตอนจ่ายเงิน) — แอดมิน (/ops engine) สร้าง/ดู/พัก โค้ดส่วนลด (discount_code).
// เขียนตาราง discount_code ร่วมกับ FE (Supabase เดียวกัน) — เลนคิดเงิน/ใบเสร็จอยู่ฝั่ง FE ครบแล้ว.
// secret-gated ด้วย OPS_ADMIN_SECRET (fail-closed) เหมือน /api/ops/coupon.
//   GET  ?secret=                         → { discounts: [...] }
//   POST { secret, action:"create", ... } → สร้าง | { secret, action:"status", id, status } → พัก/เปิด
import { z, ZodError } from "zod";

import { listDiscounts, listRedemptions, validateCreate, createDiscount, setStatus } from "@/lib/bazi/qi/discount";

export const runtime = "nodejs";

function unauthorized() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}

export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  const url = new URL(request.url);
  if (!secret || url.searchParams.get("secret") !== secret) return unauthorized();
  try {
    // ?redemptions=<codeId> → ใครใช้โค้ดนี้บ้าง (รายชื่อ + จำนวนคน)
    const codeId = url.searchParams.get("redemptions");
    if (codeId) {
      const redemptions = await listRedemptions(codeId);
      const distinctUsers = new Set(redemptions.map((x) => x.userId)).size;
      return Response.json({ redemptions, distinctUsers }, { status: 200 });
    }
    return Response.json({ discounts: await listDiscounts() }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "discount list error" }, { status: 500 });
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
      return Response.json({ ok: true, discounts: await listDiscounts() }, { status: 200 });
    }
    // default = create
    const checked = validateCreate(body);
    if (!checked.ok) return Response.json({ error: "invalid", reason: checked.reason }, { status: 400 });
    const created = await createDiscount(checked.value);
    if (!created.ok) return Response.json({ error: "create failed", reason: created.reason }, { status: 409 });
    return Response.json({ ok: true, id: created.id, discounts: await listDiscounts() }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "discount error" }, { status: 500 });
  }
}
