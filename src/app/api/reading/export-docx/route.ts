import { z } from "zod";

import {
  BaziEngineAdapterError,
  calculateBaziStateFromRawInput,
  type BaziStatePayload,
} from "@/features/bazi-math/bazi-engine-adapter";
import { buildReadingDocxBuffer } from "@/lib/bazi/reading-docx";
import { CalculatedStateSchema, RawInputSchema } from "@/lib/bazi/schema-types";
import { createDbSubstitutionRuleRepository } from "@/lib/bazi/substitution-rules-repository";
import { getKnowledgeOverlay } from "@/lib/bazi/knowledge-override.server";
import { runWithKnowledgeOverlay } from "@/lib/bazi/knowledge/knowledge-overlay-context";

export const runtime = "nodejs";

const ExportDocxRequestSchema = z.object({
  rawInput: RawInputSchema,
  calculatedState: CalculatedStateSchema.optional(),
  // คำอ่านที่ generate ไว้แล้ว (เช่นฉบับ LLM polish) ราย topicId → ใส่ในรายงานแทนผล engine
  readings: z.record(z.string(), z.string()).optional(),
  // ตารางบทเสริม (วัยจร) ฉบับ LLM แต่งคำ → ใช้แทนผล engine ถ้ามี
  relationshipLines: z
    .array(
      z.object({
        ageRange: z.string(),
        symbol: z.string(),
        relationLine: z.string(),
        deepNote: z.string(),
      }),
    )
    .optional(),
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

  const { rawInput, calculatedState: providedState, readings, relationshipLines } = parsed.data;

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

  // กฎแทนคำของซินแส (จาก DB) — ใช้กับบทที่ regenerate จาก engine (บทที่มี override ผ่านกฎมาแล้ว)
  // best-effort: โหลดไม่ได้ → ออกเอกสารต่อได้โดยไม่แทนคำ
  const substitutionRules = await createDbSubstitutionRuleRepository()
    .listRules()
    .catch(() => []);

  // องค์ความรู้ที่ซินแสแก้ออนไลน์ (เฟส 2) — ห่อ build ด้วย overlay context ให้บทที่ regenerate ใช้ค่าใหม่
  const knowledgeOverlay = await getKnowledgeOverlay();
  const buffer = await runWithKnowledgeOverlay(knowledgeOverlay, () =>
    buildReadingDocxBuffer(rawInput, calculatedState, {
      readings,
      relationshipLines,
      substitutionRules,
    }),
  );
  const filename = `reading-${rawInput.birthDate}-${rawInput.gender}.docx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
