import { z } from "zod";

import {
  BaziEngineAdapterError,
  calculateBaziStateFromRawInput,
  type BaziStatePayload,
} from "@/features/bazi-math/bazi-engine-adapter";
import { CalculatedStateSchema, RawInputSchema } from "@/lib/bazi/schema-types";
import { polishRelationshipLinesLlm } from "@/lib/bazi/reading-llm";

export const runtime = "nodejs";

/**
 * Gen เฉพาะช่อง "คำอธิบายดี-ร้ายเชิงลึก" (deepNote) ของตารางบทเสริม (วัยจร) ด้วย LLM
 * แยกจากการรันบท turning_points เต็มบท เพื่อให้ซินแสกด gen/regenerate ตารางได้เดี่ยว ๆ
 * คง ageRange/symbol/relationLine + ป้าย [เฝ้าระวัง]/[ยุคทอง] เดิม — ถ้า LLM ล้มเหลว คืนแถวเดิม
 */
const RelationshipLineSchema = z.object({
  ageRange: z.string(),
  symbol: z.string(),
  relationLine: z.string(),
  deepNote: z.string(),
});

const RequestSchema = z.object({
  rawInput: RawInputSchema,
  calculatedState: CalculatedStateSchema.optional(),
  rows: z.array(RelationshipLineSchema).min(1),
  apiKey: z.string().trim().min(1),
  model: z.string().trim().min(1).optional(),
  provider: z.enum(["gemini", "opencode", "anthropic"]).default("gemini"),
});

function badRequest(message: string, code = "bad_request") {
  return Response.json({ error: { message, type: code } }, { status: 400 });
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.", "invalid_json");
  }

  const parsed = RequestSchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid request.", "invalid_payload");
  }

  const { rawInput, calculatedState: providedState, rows, apiKey, model, provider } = parsed.data;

  let calculatedState: BaziStatePayload;
  try {
    calculatedState = providedState ?? (await calculateBaziStateFromRawInput(rawInput));
  } catch (error) {
    if (error instanceof BaziEngineAdapterError) {
      return badRequest(error.message, error.code);
    }
    return badRequest(
      error instanceof Error ? error.message : "คำนวณดวงไม่สำเร็จ",
      "calculation_failed",
    );
  }

  try {
    const relationshipLines = await polishRelationshipLinesLlm({
      rows,
      rawInput,
      calculatedState,
      apiKey,
      model,
      provider,
    });
    return Response.json({ relationshipLines });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "เรียก LLM ไม่สำเร็จ",
      "llm_failed",
    );
  }
}
