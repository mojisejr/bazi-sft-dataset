import { ZodError } from "zod";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { buildLoveFacets, buildPairComparison } from "@/lib/bazi/pair-matching";
import type { DayPillar, PillarPos } from "@/lib/bazi/pair-types";
import { type BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";

type HandlerOptions = {
  repository?: BaziKnowledgeRepository;
};

function dayPillarOf(state: Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>): DayPillar {
  return { stem: state.fourPillars.day.stem, branch: state.fourPillars.day.branch };
}

/** สี่เสา (ก้าน/กิ่ง) ของหนึ่งคน สำหรับคำนวณ 4 มิติความเข้ากัน. */
function facetPillarsOf(
  state: Awaited<ReturnType<typeof calculateBaziStateFromRawInput>>,
): Record<PillarPos, DayPillar> {
  const p = state.fourPillars;
  const lite = (x: { stem: string; branch: string }): DayPillar => ({ stem: x.stem, branch: x.branch });
  return { hour: lite(p.hour), day: lite(p.day), month: lite(p.month), year: lite(p.year) };
}

/**
 * POST /api/bazi/pair
 * Body: { personA: RawInput, personB: RawInput }
 * Returns: { personA, personB (full calculated charts), comparison }
 */
export function createPairBaziHandler(options: HandlerOptions = {}) {
  return async function POST(request: Request) {
    try {
      const body = await request.json();
      const { personA, personB } = body ?? {};

      if (!personA || !personB) {
        return Response.json(
          { error: "Both personA and personB are required." },
          { status: 400 },
        );
      }

      const repository = options.repository ?? createDbKnowledgeRepository();
      const [stateA, stateB] = await Promise.all([
        calculateBaziStateFromRawInput(personA, { repository }),
        calculateBaziStateFromRawInput(personB, { repository }),
      ]);

      const comparison = buildPairComparison(dayPillarOf(stateA), dayPillarOf(stateB));
      const loveFacets = buildLoveFacets(facetPillarsOf(stateA), facetPillarsOf(stateB));

      return Response.json(
        { personA: stateA, personB: stateB, comparison, loveFacets },
        { status: 200 },
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid pair payload.", details: error.issues },
          { status: 400 },
        );
      }

      const message = error instanceof Error ? error.message : "Unknown pair calculation error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createPairBaziHandler();
