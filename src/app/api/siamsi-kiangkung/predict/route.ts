import { z } from "zod";

import { drawOne, getAllCards, getCardByNo, type SiamsiCard } from "@/lib/bazi/siamsi-kiangkung/deck";
import { buildSiamsiReading } from "@/lib/bazi/siamsi-kiangkung/reading-engine";
import { gateFeature } from "@/lib/bazi/qi/quota";

export const runtime = "nodejs";

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

// 1 คำถาม = 1 ใบ (ตามกติกาไพ่เซียมซีเคี้ยงคุง) — เลือกเองด้วย cardNo หรือ random
const PredictSchema = z
  .object({
    question: z.string().trim().max(500).optional(),
    cardNo: z.number().int().optional(),
    random: z.boolean().optional(),
    /** ผูกระบบแต้ม Qi (ตัดโควตาต่อ user) — ไม่ส่งมา = ไม่ตัดโควตา (backward-compat) */
    anonId: z.string().trim().min(1).max(128).optional(),
  })
  .refine((v) => v.random || typeof v.cardNo === "number", {
    message: "ต้องส่ง cardNo (เลือกเอง 1 ใบ) หรือ random:true",
  });

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const parsed = PredictSchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload.");
  }
  const { question, cardNo, random, anonId } = parsed.data;

  // ตัดสิทธิ์เปิดไพ่ (ฟรีรายวัน → credit → หัก QI) เมื่อผูก anonId — โควตาเดียวกับไพ่ใบอื่น
  const { blocked, result: gate } = await gateFeature(anonId, "card");
  if (blocked) return blocked;
  const qi = gate && gate.ok ? { source: gate.source, cost: gate.cost } : null;

  let card: SiamsiCard;
  if (typeof cardNo === "number" && !random) {
    const picked = getCardByNo(cardNo);
    if (!picked) return badRequest("ไม่มีเลขไพ่นี้ในสำรับ");
    card = picked;
  } else {
    card = drawOne();
  }

  const reading = buildSiamsiReading(card, question);

  return Response.json({
    source: "engine",
    card: reading.card,
    engineProse: reading.engineProse,
    qi,
  });
}

/** GET — ส่งรายการไพ่ทั้งหมด (80 ใบ) */
export async function GET() {
  return Response.json({ cards: getAllCards() });
}
