import { z } from "zod";

import { answerFengshuiChat } from "@/features/open-webui/card-answer";
import { summarizeFengshuiReading } from "@/lib/bazi/fengshui/reading-llm";
import { drawRandom, getAllCards, getCardByNo, getEnglishCard, type FengshuiCard } from "@/lib/bazi/fengshui/deck";
import { seedForDraw } from "@/lib/bazi/seed";
import { guardServerLlm } from "@/lib/bazi/llm-guard";
import { gateFeature } from "@/lib/bazi/qi/quota";
import { requireMumateClient } from "@/lib/mumate-client";

export const runtime = "nodejs";

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

// ไพ่อาถรรพ์ฮวงจุ้ยเคี้ยงคุง (ซินแสนุ้ย 2026-10-07): หน้าบ้าน + หลังบ้าน จั่ว 1 หรือ 3 ใบ + ถามต่อได้ (สูตรเดียวกับแชท)
const PredictSchema = z
  .object({
    mode: z.enum(["engine", "llm"]).default("engine"),
    question: z.string().trim().max(500).optional(),
    /** เลือกเอง 1 หรือ 3 ใบ */
    cardNos: z.array(z.number().int()).min(1).max(3).optional(),
    random: z.boolean().optional(),
    /** จำนวนใบเมื่อสุ่ม (ค่าเริ่มต้น 3) */
    count: z.union([z.literal(1), z.literal(3)]).default(3),
    /** summary = สรุปคำทำนายแบบไพ่อื่น (หน้าบ้าน) · chat = ตอบแบบแชทเสี่ยวมู่/มี่ (หลังบ้าน) — ซินแสนุ้ย 2026-10-11 */
    style: z.enum(["summary", "chat"]).default("summary"),
    /** เสี่ยวมู่ (ครับ) / เสี่ยวมี่ (ค่ะ) — ใช้กับ style chat */
    persona: z.enum(["mu", "mi"]).default("mu"),
    /** ผูกระบบแต้ม Qi (ตัดโควตาต่อ user) — ไม่ส่งมา = ไม่ตัดโควตา */
    anonId: z.string().trim().min(1).max(128).optional(),
    apiKey: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    provider: z.enum(["gemini", "opencode", "anthropic"]).default("gemini"),
  })
  .refine((v) => v.random || v.cardNos, {
    message: "ต้องส่ง cardNos (เลือกเอง 1 หรือ 3 ใบ) หรือ random:true",
  });

function cardPayload(card: FengshuiCard) {
  const en = getEnglishCard(card.no);
  return {
    no: card.no,
    name: card.name,
    meaning: card.meaning,
    caution: card.caution,
    advice: card.advice,
    imageUrl: card.imageUrl ?? null,
    en: en ? { name: en.name, meaning: en.meaning, caution: en.caution, advice: en.advice } : null,
  };
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = PredictSchema.safeParse(payload);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload.");
  const { mode, question, cardNos, random, count, style, persona, anonId, apiKey, model, provider } = parsed.data;

  // hardening: naming a member needs the FE server's secret; anonymous use is unchanged
  if (anonId) {
    const denied = requireMumateClient(req);
    if (denied) return denied;
  }
  // ตัดสิทธิ์เปิดไพ่ (ฟรีรายวัน → credit → หัก QI) — โควตากลุ่ม "card" เดียวกับเด็คอื่น
  const { blocked, result: gate } = await gateFeature(anonId, "card");
  if (blocked) return blocked;
  const qi = gate && gate.ok ? { source: gate.source, cost: gate.cost } : null;

  // summary สรุปได้แม้ไม่มีคำถาม (ภาพรวมสถานที่) · chat ต้องมีคำถาม
  const wantsLlm = mode === "llm" && (style === "summary" || Boolean(question));
  if (wantsLlm && provider === "gemini") {
    const guardBlocked = guardServerLlm(req, "fengshui_llm", Boolean(apiKey));
    if (guardBlocked) return guardBlocked;
  }

  let cards: FengshuiCard[];
  if (cardNos && !random) {
    if (new Set(cardNos).size !== cardNos.length) return badRequest("ไพ่แต่ละใบต้องไม่ซ้ำกัน");
    const picked = cardNos.map((no) => getCardByNo(no));
    if (picked.some((c) => !c)) return badRequest("มีเลขไพ่ที่ไม่อยู่ในสำรับ");
    cards = picked as FengshuiCard[];
  } else {
    cards = drawRandom(count, seedForDraw(question, anonId)); // ผูกผู้ใช้+nonce กันไพ่ชนข้ามคน
  }

  const base = { cards: cards.map(cardPayload), deckSize: getAllCards().length, qi };
  if (!wantsLlm) return Response.json({ source: "engine", ...base });

  try {
    if (style === "summary") {
      const out = await summarizeFengshuiReading({ cards, question, apiKey, model, provider });
      return Response.json({ source: "llm", ...base, summary: out.text, model: out.model });
    }
    const out = await answerFengshuiChat(cards, { question: question as string, persona, apiKey, model, provider });
    return Response.json({ source: "llm", ...base, answer: out.text, model: out.model });
  } catch {
    return Response.json({ source: "engine", ...base }); // LLM ล่ม → คืนไพ่อย่างเดียว (ไม่ 502)
  }
}
