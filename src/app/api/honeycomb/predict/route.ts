import { z } from "zod";

import { readHoneycomb, HoneycombNumberError } from "@/lib/bazi/honeycomb/pyramid";

export const runtime = "nodejs";

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

const PredictSchema = z.object({
  phoneNumber: z.string().trim().min(1, "กรุณากรอกเบอร์มือถือ"),
});

/** POST — สร้างปิรามิดจากเบอร์ + ตีความรายชั้น (deterministic, ไม่แต่งคำ) */
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

  try {
    const reading = readHoneycomb(parsed.data.phoneNumber);
    return Response.json(reading);
  } catch (error) {
    if (error instanceof HoneycombNumberError) {
      return badRequest(error.message);
    }
    return badRequest("คำนวณปิรามิดไม่สำเร็จ", 500);
  }
}
