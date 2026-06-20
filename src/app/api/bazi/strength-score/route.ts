import { ZodError } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { type BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";

export const runtime = "nodejs";

type HandlerOptions = {
  repository?: BaziKnowledgeRepository;
};

/**
 * POST — คะแนนความแข็ง/อ่อนของดิถี (strength score) + คำอธิบาย breakdown
 * เป็น slice เบาของ /api/bazi/calculate
 */
export function createStrengthScoreHandler(options: HandlerOptions = {}) {
  return async function POST(request: Request) {
    try {
      const payload = await request.json();
      const repository = options.repository ?? createDbKnowledgeRepository();
      const calculatedState = await calculateBaziStateFromRawInput(payload, { repository });

      return Response.json(
        {
          dayMaster: calculatedState.dayMaster,
          strengthScore: calculatedState.strengthScore,
          explainable: calculatedState.explainable?.strengthScore ?? null,
        },
        { status: 200 },
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid calculate payload.", details: error.issues },
          { status: 400 },
        );
      }

      const message = error instanceof Error ? error.message : "Unknown calculation error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createStrengthScoreHandler();
