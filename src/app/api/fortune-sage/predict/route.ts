import { z } from "zod";

import { drawRandom, getAllSticks, getStickByNo } from "@/lib/bazi/fortune-sage/deck";
import { polishSageReading } from "@/lib/bazi/fortune-sage/reading-llm";
import { guardServerLlm } from "@/lib/bazi/llm-guard";
import { gateFeature } from "@/lib/bazi/qi/quota";
import { seedForDraw } from "@/lib/bazi/seed";

export const runtime = "nodejs";

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

const PredictSchema = z.object({
  mode: z.enum(["engine", "llm"]).default("engine"),
  question: z.string().trim().max(500).optional(),
  topic: z.enum(["career", "finance", "health", "love", "family"]).optional(),
  /** ระบุหัวเซี่ยงแซเอง (ไม่บังคับ) — ถ้าไม่ส่งจะสุ่ม */
  no: z.number().int().optional(),
  /** ผูกระบบแต้ม Qi (ตัดโควตาต่อ user) — ไม่ส่งมา = ไม่ตัดโควตา (backward-compat) */
  anonId: z.string().trim().min(1).max(128).optional(),
  apiKey: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  provider: z.enum(["gemini", "opencode", "anthropic"]).default("gemini"),
});

/** POST — เสี่ยงทาย: สุ่ม 1 หัวเซี่ยงแซ แล้วคืนข้อความดิบ (ไม่แต่งคำ) */
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
  const { mode, question, topic, no, anonId, apiKey, model, provider } = parsed.data;

  // ตัดโควตาเสี่ยงทาย (ฟรีรายวัน → credit ที่แลกด้วย Qi) เมื่อผูก anonId
  const { blocked, result: gate } = await gateFeature(anonId, "card");
  if (blocked) return blocked;
  // ที่มาของการตัดสิทธิ์ให้ FE โชว์ป้ายตามจริง (free=ฟรีวันนี้ · qi=หัก N ชี่ · credit=ใช้เครดิต) — เหมือน oracle/divine
  const qi = gate && gate.ok ? { source: gate.source, cost: gate.cost } : null;

  const usedOwnKey = Boolean(apiKey);
  if (mode === "llm" && provider === "gemini") {
    const g = guardServerLlm(req, "sage_llm", usedOwnKey);
    if (g) return g;
  }

  let stick;
  if (no !== undefined) {
    stick = getStickByNo(no);
    if (!stick) return badRequest("ไม่พบหัวเซี่ยงแซตามเลขที่ระบุ");
  } else {
    // seed จากคำถาม → คำถามต่างกันได้หัวเซี่ยงแซต่างกัน (ปอง 2026-09-21)
    stick = drawRandom(seedForDraw(question, anonId)); // เอ็ม 2026-09-26: ผูกผู้ใช้+nonce กันชนข้ามคน
  }

  // มีคำถาม + โหมด llm → เกลาคำตอบตรงคำถาม (1 ย่อหน้า) จากเนื้อเซี่ยงแซ; ล่ม → คงผลปกติ (ไม่ 502)
  let tailored: string | null = null;
  if (mode === "llm" && question?.trim()) {
    try {
      const llm = await polishSageReading({ stick, question: question.trim(), apiKey, model, provider });
      tailored = llm.text;
    } catch {
      tailored = null;
    }
  }

  return Response.json({ stick, tailored, question: question ?? null, topic: topic ?? null, qi });
}

/** GET — ส่งรายการหัวเซี่ยงแซทั้งหมด (เผื่อโหมดดูทั้งหมด/เลือกเอง) */
export async function GET() {
  return Response.json({ sticks: getAllSticks() });
}
