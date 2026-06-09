import { ZodError } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { buildWorkComparison } from "@/lib/bazi/pair-matching";
import type { DayPillar } from "@/lib/bazi/pair-types";
import { type BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";

type HandlerOptions = {
  repository?: BaziKnowledgeRepository;
};

const MAX_CANDIDATES = 3;

function dayPillarOf(state: Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>): DayPillar {
  return { stem: state.fourPillars.day.stem, branch: state.fourPillars.day.branch };
}

/**
 * POST /api/bazi/work
 * Body: { self: RawInput, candidates: RawInput[] }  (1..3 candidates)
 * Returns: { self (calculated chart), candidates (calculated charts), comparison }
 */
export function createWorkBaziHandler(options: HandlerOptions = {}) {
  return async function POST(request: Request) {
    try {
      const body = await request.json();
      const { self, candidates } = body ?? {};

      if (!self || !Array.isArray(candidates) || candidates.length === 0) {
        return Response.json(
          { error: "ต้องมี self และ candidates อย่างน้อย 1 คน" },
          { status: 400 },
        );
      }
      if (candidates.length > MAX_CANDIDATES) {
        return Response.json(
          { error: `เปรียบเทียบได้สูงสุด ${MAX_CANDIDATES} คน` },
          { status: 400 },
        );
      }

      const repository = options.repository ?? createDbKnowledgeRepository();
      const [selfState, ...candidateStates] = await Promise.all([
        calculateBaziStateFromRawInput(self, { repository }),
        ...candidates.map((c: unknown) => calculateBaziStateFromRawInput(c, { repository })),
      ]);

      const comparison = buildWorkComparison(
        dayPillarOf(selfState),
        candidateStates.map(dayPillarOf),
      );

      return Response.json(
        { self: selfState, candidates: candidateStates, comparison },
        { status: 200 },
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid work payload.", details: error.issues },
          { status: 400 },
        );
      }

      const message = error instanceof Error ? error.message : "Unknown work calculation error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createWorkBaziHandler();
