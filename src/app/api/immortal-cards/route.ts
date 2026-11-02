// /api/immortal-cards — ไพ่เทพเซียน (หลังบ้าน)
//   GET                                    → รายการชุดไพ่
//   POST { mode:"siamsi" }                 → เซียมซี 8 เซียน เปิด 1 ใบ เนื้อหาตามไฟล์
//   POST { mode:"oracle", deck, question } → จั่ว 3 ใบ 50/30/20 + คำทำนาย AI (ถ้าชุดนั้นมีเนื้อหา)
import { z } from "zod";

import { IMMORTAL_DECKS, drawImmortal, getImmortalDeck } from "@/lib/bazi/immortal-cards/decks";
import { polishImmortalReading } from "@/lib/bazi/immortal-cards/reading";

export const runtime = "nodejs";

const Body = z.object({
  mode: z.enum(["siamsi", "oracle"]),
  deck: z.string().default("poysian"),
  question: z.string().trim().max(500).optional(),
});

export async function GET() {
  return Response.json({ decks: IMMORTAL_DECKS.map((d) => ({ key: d.key, name: d.name, count: d.cards.length, hasContent: d.hasContent })) });
}

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { message: "payload ไม่ถูกต้อง" } }, { status: 400 });
  const { mode, question } = parsed.data;
  const deck = getImmortalDeck(mode === "siamsi" ? "poysian" : parsed.data.deck);
  if (!deck) return Response.json({ error: { message: "ไม่พบชุดไพ่" } }, { status: 404 });
  if (mode === "siamsi") return Response.json({ cards: drawImmortal(deck, 1) });
  const cards = drawImmortal(deck, 3);
  if (!deck.hasContent) return Response.json({ cards, reading: null, note: "ชุดนี้ยังไม่มีเนื้อหา" });
  try {
    return Response.json({ cards, reading: await polishImmortalReading(cards, question) });
  } catch (e) {
    return Response.json({ cards, reading: null, note: e instanceof Error ? e.message : "AI ไม่ตอบ" });
  }
}
