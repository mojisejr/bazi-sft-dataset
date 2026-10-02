// src/lib/mumate-client.ts — "is this the MuMate FE server?" (mumate-member-identity-hardening-001 slice 1, 2026-10-02)
//
// Member routes take the member from an `anonId` in the request. Only the FE server may name a member: it
// sends x-mumate-client-secret = BAZI_CLIENT_ID_SECRET (mootech-fe lib/bazi/fetch.ts). Call
// requireMumateClient(req) first in every member route; tests/member-client-secret.test.ts keeps every
// route that reads anonId on it or on a named exemption.
//
// Fail closed in production: with no secret configured nobody passes. Local development without the secret
// stays open so the engine can be run on its own.
import { timingSafeEqual } from "node:crypto";

export const CLIENT_SECRET_HEADER = "x-mumate-client-secret";

export function isMumateClient(req: Request, env: Partial<NodeJS.ProcessEnv> = process.env): boolean {
  const secret = env.BAZI_CLIENT_ID_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(req.headers.get(CLIENT_SECRET_HEADER)?.trim() ?? "");
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

/** null = carry on; otherwise the 403 to return before doing anything. */
export function requireMumateClient(req: Request, env: Partial<NodeJS.ProcessEnv> = process.env): Response | null {
  if (isMumateClient(req, env)) return null;
  if (!env.BAZI_CLIENT_ID_SECRET?.trim() && env.NODE_ENV !== "production") return null;
  return Response.json({ error: "forbidden" }, { status: 403 });
}
