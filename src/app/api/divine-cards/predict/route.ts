import { z } from "zod";

import {
  drawRandom,
  getAllCards,
  getCardByNo,
  type DivineCard,
  type DivineDraw,
} from "@/lib/bazi/divine-cards/deck";
import { buildDivineReading } from "@/lib/bazi/divine-cards/reading-engine";
import { polishDivineReading } from "@/lib/bazi/divine-cards/reading-llm";
import { createDbDivineCardImageRepository } from "@/lib/bazi/divine-cards/image-repository";

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
    apiKey: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    provider: z.enum(["gemini", "opencode", "anthropic"]).default("gemini"),
  })
  .refine((v) => v.random || v.cardNos, {
    message: "ต้องส่ง cardNos (เลือกเอง 3 ใบ) หรือ random:true",
  });

type CardPayload = DivineCard & { imageUrl: string | null };

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
  const { mode, question, cardNos, random, apiKey, model, provider } = parsed.data;

  if (mode === "llm" && !apiKey && provider === "gemini") {
    return badRequest("โหมด LLM ต้องกรอก API key");
  }

  // เลือกไพ่: random หรือเลือกเอง
  let cards: DivineDraw;
  if (cardNos && !random) {
    const unique = new Set(cardNos);
    if (unique.size !== 3) return badRequest("ไพ่ทั้ง 3 ใบต้องไม่ซ้ำกัน");
    const picked = cardNos.map((no) => getCardByNo(no));
    if (picked.some((c) => !c)) return badRequest("มีเลขไพ่ที่ไม่อยู่ในสำรับ");
    cards = [picked[0]!, picked[1]!, picked[2]!];
  } else {
    const drawn = drawRandom(3);
    cards = [drawn[0], drawn[1], drawn[2]];
  }

  const reading = buildDivineReading(cards, question);

  // ดึงรูปจาก DB (best-effort — DB/ตารางมีปัญหาก็ยังตอบ engine ได้)
  // ใช้ Supabase URL ก่อน, ถ้าไม่มีค่อย fallback เป็น data-url จาก base64 เดิม
  let imageByNo = new Map<number, string>();
  try {
    const rows = await createDbDivineCardImageRepository().getByNos(cards.map((c) => c.no));
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
    });
  }

  // mode === "llm": เกลาคำจาก engine
  try {
    const llm = await polishDivineReading({ reading, question, apiKey, model, provider });
    return Response.json({
      source: "llm",
      cards: cardPayload,
      slots: reading.slots.map((s) => ({
        position: s.position,
        weight: s.weight,
        role: s.role,
        no: s.card.no,
      })),
      engineProse: reading.engineProse,
      llmProse: llm.text,
      model: llm.model,
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "LLM ตอบไม่สำเร็จ", 502);
  }
}

/** GET — ส่งรายการไพ่ทั้งหมด (สำหรับโหมดเลือกเอง) */
export async function GET() {
  return Response.json({ cards: getAllCards() });
}
