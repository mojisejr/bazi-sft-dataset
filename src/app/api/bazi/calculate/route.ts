import { ZodError } from "zod";

import {
  calculateBaziStateFromRawInput,
} from "@/features/bazi-math/bazi-engine-adapter";
import {
  type BaziKnowledgeRepository,
} from "@/lib/bazi/symbolic-engine";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";

type HandlerOptions = {
  repository?: BaziKnowledgeRepository;
};

export function createCalculateBaziHandler(options: HandlerOptions = {}) {
  return async function POST(request: Request) {
    try {
      const payload = await request.json();
      const repository = options.repository ?? createDbKnowledgeRepository();
      const calculatedState = await calculateBaziStateFromRawInput(payload, { repository });

      return Response.json({ calculatedState }, { status: 200 });
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          {
            error: "Invalid calculate payload.",
            details: error.issues,
          },
          { status: 400 },
        );
      }

      const message = error instanceof Error ? error.message : "Unknown calculation error.";

      return Response.json(
        {
          error: message,
        },
        { status: 500 },
      );
    }
  };
}

export const POST = createCalculateBaziHandler();