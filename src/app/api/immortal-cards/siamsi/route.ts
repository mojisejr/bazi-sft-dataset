// POST — เซียมซีโป๊ยเซียนสำหรับ FE (ซินแสนุ้ย 2026-11-03): เปิด 1 ใบตามไฟล์ ไม่ผ่าน AI · ตัดโควตา "card" เหมือนเซียมซีเดิม
import { z } from "zod";

import { drawImmortal, getImmortalDeck } from "@/lib/bazi/immortal-cards/decks";
import { gateFeature } from "@/lib/bazi/qi/quota";
import { requireMumateClient } from "@/lib/mumate-client";

export const runtime = "nodejs";

const Schema = z.object({
  anonId: z.string().trim().min(1).max(128).optional(),
  question: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: { message: "Invalid payload." } }, { status: 400 });
  const { anonId, question } = parsed.data;
  if (anonId) {
    const denied = requireMumateClient(req);
    if (denied) return denied;
  }
  const { blocked, result: gate } = await gateFeature(anonId, "card");
  if (blocked) return blocked;
  const qi = gate && gate.ok ? { source: gate.source, cost: gate.cost } : null;
  const [card] = drawImmortal(getImmortalDeck("poysian")!, 1);
  // deep (ตำราเต็ม) ไม่ส่งออกไป FE
  const { deep: _deep, ...rest } = card;
  return Response.json({ card: rest, question: question ?? null, qi });
}
