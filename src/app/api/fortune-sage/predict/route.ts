import { z } from "zod";

import { drawRandom, getAllSticks, getStickByNo } from "@/lib/bazi/fortune-sage/deck";

export const runtime = "nodejs";

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

const PredictSchema = z.object({
  question: z.string().trim().max(500).optional(),
  topic: z.enum(["career", "finance", "health", "love", "family"]).optional(),
  /** ระบุหัวเซี่ยงแซเอง (ไม่บังคับ) — ถ้าไม่ส่งจะสุ่ม */
  no: z.number().int().optional(),
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
  const { question, topic, no } = parsed.data;

  let stick;
  if (no !== undefined) {
    stick = getStickByNo(no);
    if (!stick) return badRequest("ไม่พบหัวเซี่ยงแซตามเลขที่ระบุ");
  } else {
    stick = drawRandom();
  }

  return Response.json({ stick, question: question ?? null, topic: topic ?? null });
}

/** GET — ส่งรายการหัวเซี่ยงแซทั้งหมด (เผื่อโหมดดูทั้งหมด/เลือกเอง) */
export async function GET() {
  return Response.json({ sticks: getAllSticks() });
}
