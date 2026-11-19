import { z, ZodError } from "zod";

import { lanternCount, releaseLantern } from "@/features/taisui/rewards";
import { requireMumateClient } from "@/lib/mumate-client";

export const runtime = "nodejs";

const Body = z.object({ anonId: z.string().trim().min(1).max(128) });

/** GET /api/taisui/lantern — how many lanterns members have released (a count only). */
export async function GET(request: Request) {
  const denied = requireMumateClient(request);
  if (denied) return denied;
  try {
    return Response.json({ count: await lanternCount() });
  } catch (error) {
    console.error("[taisui/lantern] count failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "lantern_failed" }, { status: 500 });
  }
}

/** POST /api/taisui/lantern — one lantern per member. The wish text never reaches the server. */
export async function POST(request: Request) {
  const denied = requireMumateClient(request);
  if (denied) return denied;
  try {
    const body = Body.parse(await request.json());
    return Response.json(await releaseLantern(body.anonId));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: "invalid_input" }, { status: 400 });
    console.error("[taisui/lantern] release failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "lantern_failed" }, { status: 500 });
  }
}
