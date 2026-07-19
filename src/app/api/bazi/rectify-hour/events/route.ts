import { z, ZodError } from "zod";

import { runRectificationByEvents } from "@/lib/bazi/hour-rectification/run-events";
import { EVENT_TYPES, MAX_EVENTS, MIN_EVENTS } from "@/lib/bazi/hour-rectification/domain/events";

export const runtime = "nodejs";

// v2 event-based lane — a SEPARATE sub-route from the v1 quiz route (/api/bazi/rectify-hour), which
// is left completely untouched. Deterministic, stateless, no LLM, no DB (same DB-free-by-
// construction discipline as public-calc): birth data + 2-4 dated life events → a time estimate.
const EventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  // Gregorian (CE) year. Bounds keep obviously-wrong input (พ.ศ. sent raw, or a future/ancient
  // year) out before it reaches the annual-ganzhi maths.
  year: z.number().int().min(1900).max(2100),
});

const RequestSchema = z.object({
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate must be YYYY-MM-DD")
    .refine((value) => !Number.isNaN(Date.parse(value)), "birthDate is not a real date"),
  // Enum, not free string: the spouse-star logic (財 male / 官 female) is binary, so an unexpected
  // value must 400, not silently fall through to the female branch.
  gender: z.enum(["male", "female"]),
  province: z.string().trim().min(1),
  events: z.array(EventSchema).min(MIN_EVENTS).max(MAX_EVENTS),
});

/**
 * POST /api/bazi/rectify-hour/events — สอบยาม v2 (event-based). Stateless & deterministic: birth
 * data + 2-4 dated life events → the engine computes all 12 candidate hour-charts, scores each with
 * the classical rule table, and returns a time estimate + expert breakdown. No LLM, no DB, no
 * server session. The v1 quiz route is not touched.
 */
export function createRectifyHourEventsHandler() {
  return async function POST(request: Request) {
    try {
      const payload = await request.json();
      const input = RequestSchema.parse(payload);

      const result = await runRectificationByEvents(input);
      // need_events / inconclusive / result are all 200 — they're valid engine outcomes the client
      // renders differently, not errors.
      return Response.json(result, { status: 200 });
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid rectify-hour events payload.", details: error.issues },
          { status: 400 },
        );
      }
      const message = error instanceof Error ? error.message : "Unknown rectification error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createRectifyHourEventsHandler();
