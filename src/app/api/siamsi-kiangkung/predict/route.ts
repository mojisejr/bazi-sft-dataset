import { z } from "zod";

import { answerSiamsiChat } from "@/features/open-webui/card-answer";
import { guardServerLlm } from "@/lib/bazi/llm-guard";
import { gateFeature } from "@/lib/bazi/qi/quota";
import { seedForDraw } from "@/lib/bazi/seed";
import { drawRandom, getAllCards, getCardByNo, type SiamsiCard } from "@/lib/bazi/siamsi-kiangkung/deck";
import { buildSiamsiMultiReading } from "@/lib/bazi/siamsi-kiangkung/reading-engine";
import { summarizeSiamsiReading } from "@/lib/bazi/siamsi-kiangkung/reading-llm";
import { requireMumateClient } from "@/lib/mumate-client";

export const runtime = "nodejs";

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

// ไพ่เซียมซีเคี้ยงคุง 80 ใบ — การชี้แนะ แผนงาน การตัดสินใจ ขอความเห็น (ซินแสนุ้ย 2026-10-15)
// เลือกเอง (cardNo 1 ใบ / cardNos 1-3 ใบ) หรือ random (count 1|3, ค่าเริ่มต้น 1 = กติกาเดิม 1 คำถาม 1 ใบ)
// หลังบ้านสุ่ม 1 หรือ 3 ใบแบบไพ่ฮวงจุ้ย (เอ็ม 2026-10-15) · mode llm = ทำนายด้วย AI แบบไพ่ฮวงจุ้ย/ทาโรต์
//   style summary = สรุปคำทำนาย (หน้าเปิดไพ่) · chat = ตอบแบบแชทเสี่ยวมู่/มี่ (หลังบ้าน, ต้องมีคำถาม)
const PredictSchema = z
  .object({
    mode: z.enum(["engine", "llm"]).default("engine"),
    question: z.string().trim().max(500).optional(),
    cardNo: z.number().int().optional(),
    cardNos: z.array(z.number().int()).min(1).max(3).optional(),
    random: z.boolean().optional(),
    /** จำนวนใบเมื่อสุ่ม (ค่าเริ่มต้น 1) */
    count: z.union([z.literal(1), z.literal(3)]).default(1),
    style: z.enum(["summary", "chat"]).default("summary"),
    /** เสี่ยวมู่ (ครับ) / เสี่ยวมี่ (ค่ะ) — ใช้กับ style chat */
    persona: z.enum(["mu", "mi"]).default("mu"),
    /** ผูกระบบแต้ม Qi (ตัดโควตาต่อ user) — ไม่ส่งมา = ไม่ตัดโควตา (backward-compat) */
    anonId: z.string().trim().min(1).max(128).optional(),
    apiKey: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    provider: z.enum(["gemini", "opencode", "anthropic"]).default("gemini"),
  })
  .refine((v) => v.random || typeof v.cardNo === "number" || v.cardNos, {
    message: "ต้องส่ง cardNo/cardNos (เลือกเอง 1-3 ใบ) หรือ random:true",
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
  const { mode, question, cardNo, cardNos, random, count, style, persona, anonId, apiKey, model, provider } = parsed.data;
  // hardening slice 1: naming a member needs the FE server's secret; anonymous use is unchanged
  if (anonId) {
    const denied = requireMumateClient(req);
    if (denied) return denied;
  }

  // ตัดสิทธิ์เปิดไพ่ (ฟรีรายวัน → credit → หัก QI) เมื่อผูก anonId — โควตาเดียวกับไพ่ใบอื่น
  const { blocked, result: gate } = await gateFeature(anonId, "card");
  if (blocked) return blocked;
  const qi = gate && gate.ok ? { source: gate.source, cost: gate.cost } : null;

  // summary สรุปได้แม้ไม่มีคำถาม · chat ต้องมีคำถาม
  const wantsLlm = mode === "llm" && (style === "summary" || Boolean(question));
  if (wantsLlm && provider === "gemini") {
    const guardBlocked = guardServerLlm(req, "siamsi_llm", Boolean(apiKey));
    if (guardBlocked) return guardBlocked;
  }

  let cards: SiamsiCard[];
  const chosen = !random ? (cardNos ?? (typeof cardNo === "number" ? [cardNo] : null)) : null;
  if (chosen) {
    if (new Set(chosen).size !== chosen.length) return badRequest("ไพ่แต่ละใบต้องไม่ซ้ำกัน");
    const picked = chosen.map((no) => getCardByNo(no));
    if (picked.some((c) => !c)) return badRequest("ไม่มีเลขไพ่นี้ในสำรับ");
    cards = picked as SiamsiCard[];
  } else {
    cards = drawRandom(count, seedForDraw(question, anonId)); // ผูกผู้ใช้+nonce กันไพ่ชนข้ามคน (มิเรอร์ฮวงจุ้ย)
  }

  const reading = buildSiamsiMultiReading(cards, question);
  const payloadCards = cards.map((c) => ({ ...c, imageUrl: c.imageUrl ?? null }));
  const base = {
    /** ใบแรก (เข้ากันได้กับผู้เรียกเดิมที่อ่าน card เดี่ยว — FE /api/fortune/siamsi) */
    card: payloadCards[0],
    cards: payloadCards,
    engineProse: reading.engineProse,
    deckSize: getAllCards().length,
    qi,
  };
  if (!wantsLlm) return Response.json({ source: "engine", ...base });

  try {
    if (style === "summary") {
      const out = await summarizeSiamsiReading({ cards, question, apiKey, model, provider });
      return Response.json({ source: "llm", ...base, summary: out.text, model: out.model });
    }
    const out = await answerSiamsiChat(cards, { question: question as string, persona, apiKey, model, provider });
    return Response.json({ source: "llm", ...base, answer: out.text, model: out.model });
  } catch {
    return Response.json({ source: "engine", ...base }); // LLM ล่ม → คืนไพ่+คำทำนายจากตำรา (ไม่ 502)
  }
}

/** GET — ส่งรายการไพ่ทั้งหมด (80 ใบ พร้อม imageUrl) */
export async function GET() {
  return Response.json({ cards: getAllCards() });
}
