import { z, ZodError } from "zod";

import { openPacket } from "@/features/taisui/rewards";
import { requireMumateClient } from "@/lib/mumate-client";

export const runtime = "nodejs";

const Body = z.object({
  anonId: z.string().trim().min(1).max(128), // the receiver, resolved from the session by mootech-fe
  code: z.string().regex(/^MUMATE\d{3,8}$/), // the sender's referral code from the packet link
});

/** POST /api/taisui/packet — open a red packet: a random 5 to 10 QI once per receiver per sender, under daily caps. */
export async function POST(request: Request) {
  const denied = requireMumateClient(request);
  if (denied) return denied;
  try {
    const body = Body.parse(await request.json());
    return Response.json(await openPacket(body.anonId, body.code));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: "invalid_input" }, { status: 400 });
    console.error("[taisui/packet] failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "packet_failed" }, { status: 500 });
  }
}
