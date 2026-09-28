// /api/ops/promo-share — แอดมิน (/ops) ตั้งค่า "แชร์เพื่อน Pro ฟรี 1 เดือน" (promo_share_campaign).
// secret-gated ด้วย OPS_ADMIN_SECRET (fail-closed) เหมือน /api/ops/coupon.
//   GET  ?secret=                                     → { settings }
//   POST { secret, enabled?, maxPerIssuer?, maxTotal? } → { settings }
import { z, ZodError } from "zod";

import { getShareSettings, updateShareSettings } from "@/lib/bazi/promo/share-settings";

export const runtime = "nodejs";

function unauthorized() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}

export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  const url = new URL(request.url);
  if (!secret || url.searchParams.get("secret") !== secret) return unauthorized();
  try {
    return Response.json({ settings: await getShareSettings() }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "promo-share read error" }, { status: 500 });
  }
}

const PostSchema = z.object({
  secret: z.string().trim().min(1),
  enabled: z.boolean().optional(),
  maxPerIssuer: z.number().int().min(0).max(100000).optional(),
  maxTotal: z.number().int().min(0).max(10000000).optional(),
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
    const settings = await updateShareSettings({ enabled: body.enabled, maxPerIssuer: body.maxPerIssuer, maxTotal: body.maxTotal });
    return Response.json({ settings }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "promo-share update error" }, { status: 500 });
  }
}
