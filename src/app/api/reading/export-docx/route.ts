import { z } from "zod";

import {
  BaziEngineAdapterError,
  calculateBaziStateFromRawInput,
  type BaziStatePayload,
} from "@/features/bazi-math/bazi-engine-adapter";
import { buildReadingDocxBuffer } from "@/lib/bazi/reading-docx";
import { CalculatedStateSchema, RawInputSchema } from "@/lib/bazi/schema-types";

export const runtime = "nodejs";

const ExportDocxRequestSchema = z.object({
  rawInput: RawInputSchema,
  calculatedState: CalculatedStateSchema.optional(),
  // คำอ่านที่ generate ไว้แล้ว (เช่นฉบับ LLM polish) ราย topicId → ใส่ในรายงานแทนผล engine
  readings: z.record(z.string(), z.string()).optional(),
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

  const parsed = ExportDocxRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid request.", "invalid_payload");
  }

  const { rawInput, calculatedState: providedState, readings } = parsed.data;

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

  const buffer = await buildReadingDocxBuffer(rawInput, calculatedState, { readings });
  const filename = `reading-${rawInput.birthDate}-${rawInput.gender}.docx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
