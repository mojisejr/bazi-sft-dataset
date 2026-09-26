import { z } from "zod";

import { drawRandom, getAllCards, getCardByNo, type TarotCard } from "@/lib/bazi/tarot/deck";
import { buildTarotReading } from "@/lib/bazi/tarot/reading-engine";
import { polishTarotReading } from "@/lib/bazi/tarot/reading-llm";
import { seedForDraw } from "@/lib/bazi/seed";
import { guardServerLlm } from "@/lib/bazi/llm-guard";
import { gateFeature } from "@/lib/bazi/qi/quota";

export const runtime = "nodejs";

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

const PredictSchema = z
  .object({
    mode: z.enum(["engine", "llm"]).default("engine"),
    question: z.string().trim().max(500).optional(),
    /** เลือกเอง 1 หรือ 3 ใบ (สเปรด อดีต/ปัจจุบัน/อนาคต) */
    cardNos: z.array(z.number().int()).min(1).max(3).optional(),
    random: z.boolean().optional(),
    /** จำนวนใบเมื่อสุ่ม (ค่าเริ่มต้น 3) */
    count: z.union([z.literal(1), z.literal(3)]).default(3),
    /** ผูกระบบแต้ม Qi (ตัดโควตาต่อ user) — ไม่ส่งมา = ไม่ตัดโควตา */
    anonId: z.string().trim().min(1).max(128).optional(),
    apiKey: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    provider: z.enum(["gemini", "opencode", "anthropic"]).default("gemini"),
  })
  .refine((v) => v.random || v.cardNos, {
    message: "ต้องส่ง cardNos (เลือกเอง 1 หรือ 3 ใบ) หรือ random:true",
  });

type CardPayload = TarotCard;

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
  const { mode, question, cardNos, random, count, anonId, apiKey, model, provider } = parsed.data;

  // ตัดสิทธิ์เปิดไพ่ (ฟรีรายวัน → credit → หัก QI) เมื่อผูก anonId — ใช้โควตากลุ่ม "card" เดียวกับเด็คอื่น
  const { blocked, result: gate } = await gateFeature(anonId, "card");
  if (blocked) return blocked;
  const qi = gate && gate.ok ? { source: gate.source, cost: gate.cost } : null;

  const usedOwnKey = Boolean(apiKey);
  if (mode === "llm" && provider === "gemini") {
    const guardBlocked = guardServerLlm(req, "tarot_llm", usedOwnKey);
    if (guardBlocked) return guardBlocked;
  }

  // เลือกไพ่: random หรือเลือกเอง
  let cards: TarotCard[];
  if (cardNos && !random) {
    const unique = new Set(cardNos);
    if (unique.size !== cardNos.length) return badRequest("ไพ่แต่ละใบต้องไม่ซ้ำกัน");
    const picked = cardNos.map((no) => getCardByNo(no));
    if (picked.some((c) => !c)) return badRequest("มีเลขไพ่ที่ไม่อยู่ในสำรับ");
    cards = picked as TarotCard[];
  } else {
    // seed จากคำถาม → คำถามต่างกันได้ไพ่ต่างกัน (คำถามเดิม = ไพ่เดิม)
    const seed = seedForDraw(question, anonId); // เอ็ม 2026-09-26: ผูกผู้ใช้+nonce กันไพ่ชนข้ามคน
    cards = drawRandom(count, seed);
  }

  const reading = buildTarotReading(cards, question);
  const slots = reading.slots.map((s) => ({ position: s.position, role: s.role, no: s.card.no }));
  const cardPayload: CardPayload[] = cards;

  if (mode === "engine") {
    return Response.json({
      source: "engine",
      cards: cardPayload,
      slots,
      engineProse: reading.engineProse,
      qi,
    });
  }

  // mode === "llm": เกลาคำจาก engine
  try {
    const llm = await polishTarotReading({ reading, question, apiKey, model, provider });
    return Response.json({
      source: "llm",
      cards: cardPayload,
      slots,
      engineProse: reading.engineProse,
      llmProse: llm.text,
      model: llm.model,
      qi,
    });
  } catch {
    // LLM ล่ม → fallback engine payload (ไม่ 502)
    return Response.json({
      source: "engine",
      cards: cardPayload,
      slots,
      engineProse: reading.engineProse,
      qi,
    });
  }
}

/** GET — ส่งรายการไพ่ทั้งหมด (สำหรับโหมดเลือกเอง / หน้าเทสต์) */
export async function GET() {
  return Response.json({ cards: getAllCards() });
}
