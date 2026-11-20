import { z, ZodError } from "zod";

import { chartLuck, pairRelation, yearFacts, birthPillars } from "@/features/taisui/year-relations";
import { requireMumateClient } from "@/lib/mumate-client";

export const runtime = "nodejs";

const Birth = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  gender: z.enum(["male", "female"]),
});

const Body = z.object({
  birth: Birth,
  partner: Birth.optional(), // the sender of a red packet; only their year animal is used
  year: z.number().int().min(2026).max(2030).optional(),
});

/**
 * POST /api/taisui — the year against each of the person's pillars (facts only, no prose).
 * Called by mootech-fe's server with the client secret; never by a browser.
 */
export async function POST(request: Request) {
  const denied = requireMumateClient(request);
  if (denied) return denied;
  try {
    const body = Body.parse(await request.json());
    const facts = yearFacts(body.birth, body.year ?? 2027, await chartLuck(body.birth));
    const partner = body.partner
      ? (() => {
          const sender = birthPillars({ ...body.partner, birthTime: body.partner.birthTime });
          const senderYear = sender.find((p) => p.key === "year")!.branch;
          const me = facts.pillars.find((p) => p.key === "year")!.branch;
          return { yearBranch: senderYear, relation: pairRelation(me, senderYear) };
        })()
      : undefined;
    return Response.json({ ...facts, ...(partner ? { partner } : {}) });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }
    // No birth data in logs: only the error class.
    console.error("[taisui] failed", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "taisui_failed" }, { status: 500 });
  }
}
