import { z } from "zod";

import {
  drawRandom,
  getAllCards,
  getCardByNo,
  type OracleCard,
  type OracleDraw,
} from "@/lib/bazi/oracle-cards/deck";
import { buildOracleReading } from "@/lib/bazi/oracle-cards/reading-engine";
import { polishOracleReading } from "@/lib/bazi/oracle-cards/reading-llm";
import { seedForDraw } from "@/lib/bazi/seed";
import { createDbOracleCardImageRepository } from "@/lib/bazi/oracle-cards/image-repository";
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
    cardNos: z.array(z.number().int()).length(3).optional(),
    random: z.boolean().optional(),
    /** ผูกระบบแต้ม Qi (ตัดโควตาต่อ user) — ไม่ส่งมา = ไม่ตัดโควตา (backward-compat) */
    anonId: z.string().trim().min(1).max(128).optional(),
    apiKey: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    provider: z.enum(["gemini", "opencode", "anthropic"]).default("gemini"),
  })
  .refine((v) => v.random || v.cardNos, {
    message: "ต้องส่ง cardNos (เลือกเอง 3 ใบ) หรือ random:true",
  });

type CardPayload = OracleCard & { imageUrl: string | null };

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
  const { mode, question, cardNos, random, anonId, apiKey, model, provider } = parsed.data;

  // ตัดสิทธิ์เปิดการ์ด (ฟรีรายวัน → credit → หัก QI) เมื่อผูก anonId
  const { blocked, result: gate } = await gateFeature(anonId, "card");
  if (blocked) return blocked;
  // ที่มาของการตัดสิทธิ์ให้ FE โชว์ป้ายตามจริง (free=ฟรีวันนี้ · qi=หัก N ชี่ · credit=ใช้เครดิต)
  const qi = gate && gate.ok ? { source: gate.source, cost: gate.cost } : null;

  // โหมด AI ใช้คีย์เซิร์ฟเวอร์ได้เลย (ไม่บังคับกรอกคีย์) — guard กันยิงรัว/โควตา/เพดานต้นทุน
  const usedOwnKey = Boolean(apiKey);
  if (mode === "llm" && provider === "gemini") {
    const blocked = guardServerLlm(req, "oracle_llm", usedOwnKey);
    if (blocked) return blocked;
  }

  // เลือกไพ่: random หรือเลือกเอง
  let cards: OracleDraw;
  if (cardNos && !random) {
    const unique = new Set(cardNos);
    if (unique.size !== 3) return badRequest("ไพ่ทั้ง 3 ใบต้องไม่ซ้ำกัน");
    const picked = cardNos.map((no) => getCardByNo(no));
    if (picked.some((c) => !c)) return badRequest("มีเลขไพ่ที่ไม่อยู่ในสำรับ");
    cards = [picked[0]!, picked[1]!, picked[2]!];
  } else {
    // จั่วผูก คำถาม+ผู้ใช้+nonce → คนละคน/คนละครั้งได้ไพ่ต่างกัน (เอ็ม 2026-09-26; เดิม seed คำถามอย่างเดียว = ชนกันข้ามคน)
    const seed = seedForDraw(question, anonId);
    const drawn = drawRandom(3, seed);
    cards = [drawn[0], drawn[1], drawn[2]];
  }

  const reading = buildOracleReading(cards, question);

  // ดึงรูปจาก DB (best-effort — DB/ตารางมีปัญหาก็ยังตอบ engine ได้)
  // ใช้ Supabase URL ก่อน, ถ้าไม่มีค่อย fallback เป็น data-url จาก base64
  let imageByNo = new Map<number, string>();
  try {
    const rows = await createDbOracleCardImageRepository().getByNos(cards.map((c) => c.no));
    imageByNo = new Map(
      rows.map((r) => {
        const url = r.imageUrl ?? (r.imageBase64 ? `data:${r.mime};base64,${r.imageBase64}` : null);
        return [r.cardNo, url] as const;
      }).filter((e): e is readonly [number, string] => e[1] !== null),
    );
  } catch {
    imageByNo = new Map();
  }

  const cardPayload: CardPayload[] = cards.map((card) => ({
    ...card,
    imageUrl: imageByNo.get(card.no) ?? null,
  }));

  if (mode === "engine") {
    return Response.json({
      source: "engine",
      cards: cardPayload,
      slots: reading.slots.map((s) => ({
        position: s.position,
        weight: s.weight,
        role: s.role,
        no: s.card.no,
      })),
      engineProse: reading.engineProse,
      qi,
    });
  }

  // mode === "llm": เกลาคำจาก engine
  const slots = reading.slots.map((s) => ({ position: s.position, weight: s.weight, role: s.role, no: s.card.no }));
  try {
    const llm = await polishOracleReading({ reading, question, apiKey, model, provider });
    return Response.json({ source: "llm", cards: cardPayload, slots, engineProse: reading.engineProse, llmProse: llm.text, model: llm.model, qi });
  } catch {
    // LLM ล่ม/ช้า → fallback เป็น engine payload (ผู้ใช้ถามแล้วต้องได้คำตอบเสมอ ไม่ 502) — FE จะโชว์สรุปจาก engine
    return Response.json({ source: "engine", cards: cardPayload, slots, engineProse: reading.engineProse, qi });
  }
}

/** GET — ส่งรายการไพ่ทั้งหมด (สำหรับโหมดเลือกเอง) */
export async function GET() {
  return Response.json({ cards: getAllCards() });
}
