import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ grant: vi.fn(), client: vi.fn(), earn: vi.fn(), denied: vi.fn() }));
vi.mock("@/db/paid-grant-client", () => ({ createPaidGrantSqlClient: mocks.client }));
vi.mock("@/lib/bazi/qi/paid-grant", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/bazi/qi/paid-grant")>();
  return { ...original, createPaidQiGrant: () => mocks.grant };
});
vi.mock("@/db/client", () => ({ createDbClient: vi.fn(() => { throw new Error("generic replaying pool must not serve paid grants"); }) }));
vi.mock("@/lib/bazi/qi/engine", () => ({
  earnQi: mocks.earn,
  QiError: class extends Error { constructor(message: string, readonly status: number) { super(message); } },
}));
vi.mock("@/lib/mumate-client", () => ({ requireMumateClient: mocks.denied }));

import { POST as grant } from "@/app/api/qi/grant/route";
import { POST as earn } from "@/app/api/qi/earn/route";
import { PaidQiGrantError } from "@/lib/bazi/qi/paid-grant";

const body = { secret: "synthetic-secret", anonId: "synthetic-member", kind: "qi", qi: 100, reason: "QI100", ref: "synthetic-charge" };
const request = (value: unknown) => new Request("http://localhost/api/qi/grant", { method: "POST", body: JSON.stringify(value) });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.QI_GRANT_SECRET = "synthetic-secret";
  mocks.denied.mockReturnValue(null);
  mocks.grant.mockResolvedValue({ alreadyGranted: false, firstBuyBonus: true, grantedQi: 100, qi: 130, coins: 0, xp: 0 });
});

describe("paid QI grant boundary", () => {
  it("authenticates before opening any grant connection", async () => {
    expect((await grant(request({ ...body, secret: "wrong" }))).status).toBe(401);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.grant).not.toHaveBeenCalled();
  });

  it("requires a positive amount and charge reference before the database", async () => {
    expect((await grant(request({ ...body, ref: undefined }))).status).toBe(400);
    expect((await grant(request({ ...body, qi: 0 }))).status).toBe(400);
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("uses the atomic paid path once, including the bonus, without generic earn", async () => {
    const response = await grant(request(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ alreadyGranted: false, qi: 130, firstBuyBonus: true });
    expect(mocks.grant).toHaveBeenCalledExactlyOnceWith({ anonId: body.anonId, qi: 100, reason: "qi:buy:QI100", ref: body.ref });
    expect(mocks.earn).not.toHaveBeenCalled();
  });

  it("returns payload conflict without re-crediting or falling back", async () => {
    mocks.grant.mockRejectedValueOnce(new PaidQiGrantError("GRANT_CONFLICT", "Charge reference has conflicting grant history."));
    const response = await grant(request(body));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "GRANT_CONFLICT" });
    expect(mocks.grant).toHaveBeenCalledTimes(1);
  });

  it("never replays an unknown result and does not expose SQL/parameters", async () => {
    mocks.grant.mockRejectedValueOnce(new Error("SQL with synthetic private parameters"));
    const response = await grant(request(body));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "QI grant outcome could not be confirmed.", code: "GRANT_UNCONFIRMED" });
    expect(mocks.grant).toHaveBeenCalledTimes(1);
    expect(mocks.earn).not.toHaveBeenCalled();
  });

  it("refuses a standalone first-buy reward on the public earn path", async () => {
    const response = await earn(request({ anonId: body.anonId, code: "first_buy_bonus" }));
    expect(response.status).toBe(400);
    expect(mocks.earn).not.toHaveBeenCalled();
  });

  it("retains the normal earn path for unrelated rewards", async () => {
    mocks.earn.mockResolvedValueOnce({ awarded: true, capped: false, qi: 10, balance: { qi: 10, coins: 0, xp: 0 } });
    expect((await earn(request({ anonId: body.anonId, code: "daily_checkin" }))).status).toBe(200);
    expect(mocks.earn).toHaveBeenCalledExactlyOnceWith(body.anonId, "daily_checkin", null);
  });
});
