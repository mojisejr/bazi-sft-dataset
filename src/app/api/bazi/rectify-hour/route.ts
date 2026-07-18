import { z, ZodError } from "zod";

import {
  loadRectificationBank,
  runRectificationStep,
} from "@/lib/bazi/hour-rectification";
import { InvalidQuestionBankError } from "@/lib/bazi/hour-rectification/adapters/network-repository";

export const runtime = "nodejs";

// v1 is PERSONAL: the same answers resolve to different ยาม for different charts, so the birth data
// is required. The client still resends the FULL answer trail each step (stateless replay) — now as
// (questionId, optionId) pairs against the pre-generated bank.
const AnsweredStepSchema = z.object({
  questionId: z.string().trim().min(1),
  optionId: z.string().trim().min(1),
});

const RunStepRequestSchema = z.object({
  // YYYY-MM-DD — reject junk like "2026-99-99" up front rather than deep in the calc engine.
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate must be YYYY-MM-DD")
    .refine((value) => !Number.isNaN(Date.parse(value)), "birthDate is not a real date"),
  gender: z.string().trim().min(1),
  province: z.string().trim().min(1),
  calendarSystem: z.enum(["solar", "lunar"]).optional(),
  timezone: z.string().trim().min(1).optional(),
  answeredSteps: z.array(AnsweredStepSchema).default([]),
});

/**
 * POST /api/bazi/rectify-hour — สอบยาม (Hour Rectification) v1 runtime step. Stateless & personal:
 * the client sends birth data + the full answer trail so far each request; the server recomputes
 * the user's 12 real hour signatures and replays the deterministic bank walk against the
 * pre-generated question-network.json (lib/bazi/hour-rectification, offline-generated — see
 * scripts/generate-rectification-network.ts). No LLM at runtime, no DB, no server session — same
 * DB-free-by-construction discipline as /api/bazi/public-calc.
 */
export function createRectifyHourHandler() {
  return async function POST(request: Request) {
    try {
      const payload = await request.json();
      const input = RunStepRequestSchema.parse(payload);

      const bank = loadRectificationBank();
      const result = await runRectificationStep(bank, input);

      if (result.status === "error") {
        // A malformed answer trail (unknown question/option id) is a client-input problem, not a
        // server fault — 400, not 500.
        return Response.json({ error: result.reason }, { status: 400 });
      }

      return Response.json(result, { status: 200 });
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid rectify-hour payload.", details: error.issues },
          { status: 400 },
        );
      }

      // question-network.json missing (not generated yet) OR present-but-incompatible (v0/draft):
      // both are real, distinguishable "the artifact isn't ready" states — 503, not an opaque 500.
      if (
        (error instanceof Error &&
          (error as NodeJS.ErrnoException).code === "ENOENT") ||
        error instanceof InvalidQuestionBankError
      ) {
        return Response.json(
          {
            error:
              error instanceof InvalidQuestionBankError
                ? error.message
                : "Hour rectification question bank has not been generated yet.",
          },
          { status: 503 },
        );
      }

      const message = error instanceof Error ? error.message : "Unknown rectification error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createRectifyHourHandler();
