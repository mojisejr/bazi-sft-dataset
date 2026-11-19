// ประวัติเซียมซีโป๊ยเซียน 20 ใบล่าสุด (GET ?anonId=) + รีวิว 👍/👎 + ข้อความ รับ 3-5 QI (POST) — เดือนละไม่เกิน 100 QI
import { z } from "zod";

import { listHistory, submitReview } from "@/lib/bazi/immortal-cards/history";
import { requireMumateClient } from "@/lib/mumate-client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = requireMumateClient(req);
  if (denied) return denied;
  const anonId = new URL(req.url).searchParams.get("anonId")?.trim() ?? "";
  if (!anonId || anonId.length > 128) return Response.json({ error: { message: "anonId required" } }, { status: 400 });
  return Response.json(await listHistory(anonId));
}

const ReviewSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  id: z.string().uuid(),
  rating: z.union([z.literal(1), z.literal(-1)]),
  review: z.string().max(1000),
});

export async function POST(req: Request) {
  const denied = requireMumateClient(req);
  if (denied) return denied;
  const parsed = ReviewSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: { message: "Invalid payload." } }, { status: 400 });
  const { anonId, id, rating, review } = parsed.data;
  const r = await submitReview(anonId, id, rating, review);
  if (!r.ok) return Response.json({ error: { message: r.reason } }, { status: r.status });
  return Response.json(r);
}
