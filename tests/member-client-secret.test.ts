/**
 * mumate-member-identity-hardening-001 slice 1 step 3 — member routes answer only the MuMate FE server.
 *
 * These routes take the member from an `anonId` in the request, so only the MuMate FE server may call them:
 * they require x-mumate-client-secret = BAZI_CLIENT_ID_SECRET (held only by the FE server), checked before
 * any work.
 * Routes where the member id is optional (anonymous card readings, chat) require it only when an id is
 * sent, so anonymous use is unchanged and nobody can act as a member without it.
 *
 * 🔴 MUTANT CONTRACT:
 *   M1  isMumateClient skips the comparison                       → the wrong-secret test reddens
 *   M2  requireMumateClient fails open in production without a secret → the fail-closed test reddens
 *   M3  any listed route drops its guard                          → its 403 case reddens (no work done)
 *   M4  an optional-id route stops guarding when an id is sent    → its member case reddens
 *   M5  a new route reads anonId without the guard or an exemption → the coverage scan reddens, naming it
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const work = vi.hoisted(() => ({ db: 0 }));

// Any database use counts as "work done". The guard must answer before it.
vi.mock("@/db/client", () => ({
  createDbClient: () => {
    work.db += 1;
    throw new Error("database touched before the client check");
  },
}));

import { isMumateClient, requireMumateClient } from "@/lib/mumate-client";

const SECRET = "s".repeat(43);
const OTHER = "99999999-8888-4777-8666-555555555555";

const withSecret = (headers: Record<string, string> = {}) => ({ ...headers, "x-mumate-client-secret": SECRET });

beforeEach(() => {
  vi.stubEnv("BAZI_CLIENT_ID_SECRET", SECRET);
  work.db = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isMumateClient / requireMumateClient", () => {
  const req = (h: Record<string, string>) => new Request("http://bazi:3000/api/qi/wallet", { headers: h });

  test("the FE's secret is accepted", () => {
    expect(isMumateClient(req(withSecret()), { BAZI_CLIENT_ID_SECRET: SECRET })).toBe(true);
    expect(requireMumateClient(req(withSecret()), { BAZI_CLIENT_ID_SECRET: SECRET, NODE_ENV: "production" })).toBeNull();
  });

  test("M1 — a wrong, short, or missing secret is refused with 403", async () => {
    for (const h of [{ "x-mumate-client-secret": "nope" }, { "x-mumate-client-secret": SECRET.slice(1) }, {}] as Array<Record<string, string>>) {
      expect(isMumateClient(req(h), { BAZI_CLIENT_ID_SECRET: SECRET })).toBe(false);
      const denied = requireMumateClient(req(h), { BAZI_CLIENT_ID_SECRET: SECRET, NODE_ENV: "production" });
      expect(denied?.status).toBe(403);
    }
  });

  test("M2 — production with no secret configured fails closed (403), even for a caller that sends one", () => {
    expect(requireMumateClient(req(withSecret()), { NODE_ENV: "production" })?.status).toBe(403);
    expect(requireMumateClient(req(withSecret()), { BAZI_CLIENT_ID_SECRET: "  ", NODE_ENV: "production" })?.status).toBe(403);
  });

  test("local development with no secret configured stays open", () => {
    expect(requireMumateClient(req({}), { NODE_ENV: "development" })).toBeNull();
  });
});

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// Every route that takes the member from the request with no other auth. Always guarded.
const MEMBER_ROUTES: Array<[string, Method[]]> = [
  ["account/consent", ["GET", "POST"]],
  ["account/delete", ["POST", "GET", "DELETE", "PATCH"]],
  ["account/export", ["POST", "GET"]],
  ["account/notification-prefs", ["GET", "PUT"]],
  ["achievements", ["GET"]],
  ["coupon/redeem", ["POST"]],
  ["home", ["POST"]],
  ["karma", ["GET"]],
  ["manifest/checkin", ["POST"]],
  ["manifest/entry", ["POST", "GET"]],
  ["manifest/goals", ["GET", "POST", "PATCH", "DELETE"]],
  ["manifest/insights", ["POST"]],
  ["manifest/photo", ["POST"]],
  ["manifest/photo/[id]", ["GET"]],
  ["missions", ["GET", "POST"]],
  ["profile", ["GET", "PATCH", "POST"]],
  ["profile/avatar", ["GET", "POST"]],
  ["profile/display-name", ["GET", "POST"]],
  ["qi/credit-consume", ["POST"]],
  ["qi/earn", ["POST"]],
  ["qi/entitlements", ["GET"]],
  ["qi/feature-check", ["POST"]],
  ["qi/feature-consume", ["POST"]],
  ["qi/matching-consume", ["POST"]],
  ["qi/spend", ["POST"]],
  ["qi/streak-restore", ["POST"]],
  ["qi/wallet", ["GET"]],
  ["referral", ["GET", "POST"]],
  ["user/intent", ["POST", "GET"]],
  ["wallet", ["GET", "POST"]],
];

// Routes where the member id is optional: anonymous use stays open, an id needs the secret.
const OPTIONAL_ID_ROUTES: string[] = [
  "divine-cards/predict",
  "oracle-cards/predict",
  "tarot/predict",
  "fortune-sage/predict",
  "siamsi-kiangkung/predict",
  "louise-hay/chat",
  "reading/newdata-reading/llm",
  "reading/newdata-reading2/llm",
];

async function invoke(route: string, method: Method, headers: Record<string, string>, body?: unknown) {
  const mod = (await import(`@/app/api/${route}/route`)) as Record<string, (req: Request, ctx: unknown) => Promise<Response>>;
  const url = `http://bazi:3000/api/${route.replace("[id]", "11111111-2222-4333-8444-555555555555")}?anonId=${OTHER}`;
  const init: RequestInit = { method, headers: { "content-type": "application/json", ...headers } };
  if (method !== "GET" && method !== "DELETE") init.body = JSON.stringify(body ?? { anonId: OTHER });
  return mod[method](new Request(url, init), { params: Promise.resolve({ id: "11111111-2222-4333-8444-555555555555" }) });
}

describe.each(MEMBER_ROUTES.flatMap(([r, ms]) => ms.map((m) => [`${m} /api/${r}`, r, m] as const)))("%s", (_n, route, method) => {
  test("M3 — no secret ⇒ 403 before any database work", async () => {
    const res = await invoke(route, method, {});
    expect(res.status).toBe(403);
    expect(work.db).toBe(0);
  });

  test("a wrong secret ⇒ 403", async () => {
    const res = await invoke(route, method, { "x-mumate-client-secret": "nope" });
    expect(res.status).toBe(403);
    expect(work.db).toBe(0);
  });
});

// a body each optional-id route accepts (cards: random draw; chat: one user message)
const BODY = { random: true, question: "q", message: "m", messages: [{ role: "user", content: "m" }] };

describe.each(OPTIONAL_ID_ROUTES)("POST /api/%s", (route) => {
  test("M4 — a member id without the secret ⇒ 403 before any database work", async () => {
    const res = await invoke(route, "POST", {}, { ...BODY, anonId: OTHER });
    expect(res.status).toBe(403);
    expect(work.db).toBe(0);
  });

  test("anonymous use (no member id, no secret) is not refused", async () => {
    const res = await invoke(route, "POST", {}, BODY).catch(() => new Response(null, { status: 500 }));
    expect(res.status).not.toBe(403);
  });
});

describe("M5 — every route that reads a member id from the request is guarded or exempt for a reason", () => {
  // Routes that read anonId but are authenticated another way, or only report ids to an admin.
  const EXEMPT: Record<string, string> = {
    "src/app/api/cron/account-purge/route.ts": "Bearer CRON_SECRET",
    "src/app/api/cron/qi-quota-reset/route.ts": "Bearer CRON_SECRET",
    "src/app/api/ops/chat-status/route.ts": "x-ops-secret",
    "src/app/api/ops/entitlement/route.ts": "OPS secret",
    "src/app/api/ops/subscription/route.ts": "OPS secret",
    "src/app/api/ops/user-attribution/route.ts": "x-ops-secret",
    "src/app/api/ops/user-delete/route.ts": "OPS secret",
    "src/app/api/ops/user-snapshot/route.ts": "x-ops-secret",
    "src/app/api/ops/users/route.ts": "x-ops-secret",
    "src/app/api/profile/admin/route.ts": "OPS secret",
    "src/app/api/qi/admin-adjust/route.ts": "OPS secret",
    "src/app/api/qi/grant/route.ts": "QI_GRANT_SECRET",
    "src/app/api/v1/chat/completions/route.ts": "Bearer OPEN_WEBUI_API_TOKEN",
    "src/app/api/stats/route.ts": "reads no member id from the request (reports ids; recorded separately)",
  };

  test("no unguarded route mentions anonId", () => {
    const files = execFileSync("git", ["grep", "-l", "anonId", "--", "src/app/api"], { encoding: "utf8" })
      .split("\n")
      .filter((f) => f.endsWith("route.ts"));
    expect(files.length).toBeGreaterThan(40);
    const unguarded = files.filter((f) => !EXEMPT[f] && !readFileSync(f, "utf8").includes("requireMumateClient("));
    expect(unguarded).toEqual([]);
  });
});
