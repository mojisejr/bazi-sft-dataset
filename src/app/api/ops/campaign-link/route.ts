// /api/ops/campaign-link — แอดมิน (/ops) บันทึก/แก้ไข/ลบ "แคมเปญลิงก์ broadcast" (promo_campaign_link).
// secret-gated ด้วย OPS_ADMIN_SECRET (fail-closed) เหมือน /api/ops/coupon.
//   GET  ?secret=                                   → { links: [...] }
//   POST { secret, action:"create"|"update"|"delete", ... }
import { z, ZodError } from "zod";

import { listCampaignLinks, createCampaignLink, updateCampaignLink, deleteCampaignLink } from "@/lib/bazi/promo/campaign-link";

export const runtime = "nodejs";

function unauthorized() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}

export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  const url = new URL(request.url);
  if (!secret || url.searchParams.get("secret") !== secret) return unauthorized();
  try {
    return Response.json({ links: await listCampaignLinks() }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "campaign-link list error" }, { status: 500 });
  }
}

const InputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  packageCode: z.string().trim().min(1).max(64),
  code: z.string().trim().max(64).optional().nullable(),
  host: z.string().trim().min(1).max(200),
  liffId: z.string().trim().max(120).optional().nullable(),
});

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
    if (body.action === "delete") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return Response.json({ error: "missing id" }, { status: 400 });
      await deleteCampaignLink(id);
      return Response.json({ links: await listCampaignLinks() }, { status: 200 });
    }
    if (body.action === "create" || body.action === "update") {
      const input = InputSchema.parse(body);
      if (body.action === "update") {
        const id = typeof body.id === "string" ? body.id : "";
        if (!id) return Response.json({ error: "missing id" }, { status: 400 });
        await updateCampaignLink(id, input);
      } else {
        await createCampaignLink(input);
      }
      return Response.json({ links: await listCampaignLinks() }, { status: 200 });
    }
    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "campaign-link error" }, { status: 500 });
  }
}
