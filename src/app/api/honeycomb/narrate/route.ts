import { z } from "zod";

import { readHoneycomb, HoneycombNumberError } from "@/lib/bazi/honeycomb/pyramid";
import { narrateHoneycombReading } from "@/lib/bazi/honeycomb/reading-llm";
import { guardServerLlm } from "@/lib/bazi/llm-guard";

export const runtime = "nodejs";

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

const NarrateSchema = z.object({
  phoneNumber: z.string().trim().min(1, "กรุณากรอกเบอร์มือถือ"),
  apiKey: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  provider: z.enum(["gemini", "opencode", "anthropic"]).default("gemini"),
});

/** POST — เรียบเรียงคำอ่านปิรามิดด้วย LLM (ปุ่มเสริม) */
export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const parsed = NarrateSchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload.");
  }
  const { phoneNumber, apiKey, model, provider } = parsed.data;

  // โหมด AI ใช้คีย์เซิร์ฟเวอร์ได้เลย (ไม่บังคับกรอกคีย์) — guard กันยิงรัว/โควตา/เพดานต้นทุน
  const usedOwnKey = Boolean(apiKey);
  if (provider === "gemini") {
    const blocked = guardServerLlm(req, "honeycomb_llm", usedOwnKey);
    if (blocked) return blocked;
  }

  let reading;
  try {
    reading = readHoneycomb(phoneNumber);
  } catch (error) {
    if (error instanceof HoneycombNumberError) {
      return badRequest(error.message);
    }
    return badRequest("คำนวณปิรามิดไม่สำเร็จ", 500);
  }

  try {
    const llm = await narrateHoneycombReading({ reading, apiKey, model, provider });
    return Response.json({ llmProse: llm.text, model: llm.model });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "LLM ตอบไม่สำเร็จ", 502);
  }
}
