import { ZodError } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { buildSemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";
import { type BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";

export const runtime = "nodejs";

type HandlerOptions = {
  repository?: BaziKnowledgeRepository;
};

/**
 * POST — สร้างกราฟห้องปฏิกิริยา (semantic chamber graph) จากวันเกิด
 * รองรับหน้า /reaction-chamber ที่เดิมเรียก engine ตรง ๆ ไม่มี API
 */
export function createChamberGraphHandler(options: HandlerOptions = {}) {
  return async function POST(request: Request) {
    try {
      const payload = await request.json();
      const repository = options.repository ?? createDbKnowledgeRepository();
      const calculatedState = await calculateBaziStateFromRawInput(payload, { repository });
      const graph = buildSemanticChamberGraph(calculatedState);

      return Response.json({ graph }, { status: 200 });
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

export const POST = createChamberGraphHandler();
