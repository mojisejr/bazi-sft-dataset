import { z, ZodError } from "zod";

import {
  loadRectificationNetwork,
  runRectificationStep,
} from "@/lib/bazi/hour-rectification";

export const runtime = "nodejs";

const RunStepRequestSchema = z.object({
  answeredOptionIds: z.array(z.string().trim().min(1)).default([]),
});

/**
 * POST /api/bazi/rectify-hour — สอบยาม (Hour Rectification) runtime step. Stateless: the client
 * sends the FULL answer trail so far each request, the server replays it deterministically
 * against the pre-generated question-network.json (lib/bazi/hour-rectification, offline-generated
 * — see scripts/generate-rectification-network.ts). No LLM at runtime, no DB, no server session —
 * same DB-free-by-construction discipline as /api/bazi/public-calc.
 */
export function createRectifyHourHandler() {
  return async function POST(request: Request) {
    try {
      const payload = await request.json();
      const input = RunStepRequestSchema.parse(payload);

      const network = loadRectificationNetwork();
      const result = runRectificationStep(network, input);

      if (result.status === "error") {
        // A malformed answer trail (unknown node/option id) is a client-input problem, not a
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

      // question-network.json missing (not generated yet in this environment) is a real,
      // distinguishable failure mode worth its own message rather than a generic 500.
      if (
        error instanceof Error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return Response.json(
          { error: "Hour rectification question network has not been generated yet." },
          { status: 503 },
        );
      }

      const message = error instanceof Error ? error.message : "Unknown rectification error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createRectifyHourHandler();
