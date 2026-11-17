/**
 * Real PostgreSQL proof. REFERRAL_TEST_DATABASE_URL must name a disposable
 * loopback database called referral_proof; APP_DATABASE_URL is never used.
 * npm run test:referral-db requires this URL instead of silently skipping.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  db: undefined as unknown,
  randomInt: vi.fn(),
  realRandomInt: undefined as unknown as (min: number, max: number) => number,
}));
vi.mock("@/db/client", () => ({ createDbClient: () => fixture.db }));
vi.mock("node:crypto", async (original) => {
  const actual = await original<typeof import("node:crypto")>();
  fixture.realRandomInt = actual.randomInt;
  return { ...actual, randomInt: fixture.randomInt };
});

import { GET, POST } from "@/app/api/referral/route";
import * as schema from "@/db/schema";

const databaseUrl = process.env.REFERRAL_TEST_DATABASE_URL;
const required = process.env.REFERRAL_REQUIRE_DB === "1";
const clientSecret = "referral-test-client-only";
const tables = ["bazi_referral_code", "bazi_referral_redemption", "bazi_user_profile", "bazi_wallet", "bazi_ledger_txn", "bazi_qi_claim"];

function request(member = "new-member", body?: { anonId: string; code: string }) {
  return new Request(`http://localhost/api/referral?anonId=${encodeURIComponent(member)}`, {
    method: body ? "POST" : "GET",
    headers: { "x-mumate-client-secret": clientSecret, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe.skipIf(!databaseUrl && !required)("referral with real PostgreSQL", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("Set REFERRAL_TEST_DATABASE_URL to a disposable loopback referral_proof database.");
    const url = new URL(databaseUrl);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/referral_proof") {
      throw new Error("Refusing referral fixtures outside a disposable loopback referral_proof database.");
    }
    sql = postgres(databaseUrl, { prepare: false, max: 10, connect_timeout: 5 });
    fixture.db = drizzle(sql, { schema });
    for (const file of ["0033_manifest_ledger.sql", "0034_mission_referral.sql", "0038_qi_point_system.sql", "0040_user_profile_display_name.sql"]) {
      const statements = readFileSync(path.resolve("drizzle", file), "utf8").split("--> statement-breakpoint");
      for (const statement of statements) {
        const ddl = statement.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n").trim();
        if (tables.some((table) => ddl.includes(`"${table}"`))) await sql.unsafe(ddl);
      }
    }
  });

  beforeEach(async () => {
    vi.stubEnv("BAZI_CLIENT_ID_SECRET", clientSecret);
    vi.spyOn(console, "error").mockImplementation(() => {});
    fixture.randomInt.mockReset().mockReturnValue(45678);
    await sql.unsafe(`TRUNCATE ${tables.map((table) => `"${table}"`).join(", ")}`);
    await sql`INSERT INTO bazi_referral_code (anon_id, code) VALUES ('owner', 'MUMATE123')`;
    await sql`INSERT INTO bazi_wallet (anon_id, coins, xp, qi) VALUES ('owner', 10, 20, 70)`;
    await sql`INSERT INTO bazi_ledger_txn (anon_id, qi_delta, reason) VALUES ('owner', 70, 'fixture')`;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  afterAll(async () => { if (sql) await sql.end({ timeout: 2 }); });

  async function rewardState() {
    return {
      wallets: await sql`SELECT * FROM bazi_wallet ORDER BY anon_id`,
      ledger: await sql`SELECT * FROM bazi_ledger_txn ORDER BY id`,
      redemptions: await sql`SELECT * FROM bazi_referral_redemption ORDER BY id`,
      claims: await sql`SELECT * FROM bazi_qi_claim ORDER BY anon_id, code, period_key`,
    };
  }

  // Both initial reads see no row. PostgreSQL's real table lock holds the
  // inserts until both are waiting, so the race does not depend on timing luck.
  async function race(members: string[]) {
    let release!: () => void;
    let locked!: () => void;
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const unlocked = new Promise<void>((resolve) => { release = resolve; });
    const transaction = sql.begin(async (tx) => {
      await tx`LOCK TABLE bazi_referral_code IN SHARE MODE`;
      locked();
      await unlocked;
    });
    await ready;
    const pending = members.map((member) => GET(request(member)));
    try {
      await vi.waitFor(async () => {
        const [row] = await sql`SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
          AND query LIKE 'insert into "bazi_referral_code"%'`;
        expect(row.n).toBe(members.length);
      }, { timeout: 3000, interval: 20 });
    } finally {
      release();
      await transaction;
    }
    return Promise.all(pending);
  }

  test("retries a real code collision and returns 200 without changing rewards", async () => {
    const before = await rewardState();
    await sql`INSERT INTO bazi_referral_code (anon_id, code) VALUES ('taken', 'MUMATE12345')`;
    fixture.randomInt.mockReturnValueOnce(12345).mockReturnValueOnce(45678);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ code: "MUMATE45678", rewardPerInvite: 50 });
    expect(fixture.randomInt.mock.calls).toEqual([[10000, 100000], [10000, 100000]]);
    expect(await sql`SELECT count(*)::int AS n FROM bazi_referral_code`).toMatchObject([{ n: 3 }]);
    expect(await rewardState()).toEqual(before);
  });

  test("keeps the existing code without generating a candidate or changing rewards", async () => {
    const before = await rewardState();
    const response = await GET(request("owner"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ code: "MUMATE123" });
    expect(fixture.randomInt).not.toHaveBeenCalled();
    expect(await sql`SELECT count(*)::int AS n FROM bazi_referral_code`).toMatchObject([{ n: 1 }]);
    expect(await rewardState()).toEqual(before);
  });

  test("concurrent requests for one member converge on one code and row", async () => {
    const before = await rewardState();
    const responses = await race(["same-member", "same-member"]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await Promise.all(responses.map((response) => response.json()))).toMatchObject([{ code: "MUMATE45678" }, { code: "MUMATE45678" }]);
    expect(await sql`SELECT count(*)::int AS n FROM bazi_referral_code WHERE anon_id = 'same-member'`).toMatchObject([{ n: 1 }]);
    expect(await rewardState()).toEqual(before);
  });

  test("concurrent different members retry a shared candidate and retain unique codes", async () => {
    fixture.randomInt.mockReturnValueOnce(45678).mockReturnValueOnce(45678).mockReturnValue(78901);
    const responses = await race(["member-a", "member-b"]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    expect(bodies.map((body) => body.code).sort()).toEqual(["MUMATE45678", "MUMATE78901"]);
    expect(await sql`SELECT count(*)::int AS n, count(DISTINCT code)::int AS distinct_codes FROM bazi_referral_code`).toMatchObject([{ n: 3, distinct_codes: 3 }]);
  });

  test("a full three-digit space no longer blocks new members", async () => {
    const before = await rewardState();
    await sql`INSERT INTO bazi_referral_code (anon_id, code)
      SELECT 'legacy-' || n, 'MUMATE' || n FROM generate_series(100, 999) AS n WHERE n <> 123`;
    expect(await sql`SELECT count(*)::int AS n FROM bazi_referral_code WHERE code ~ '^MUMATE[0-9]{3}$'`).toMatchObject([{ n: 900 }]);
    fixture.randomInt.mockImplementation(fixture.realRandomInt);
    const responses = await Promise.all(["new-a", "new-b", "new-c"].map((member) => GET(request(member))));
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    const codes = (await Promise.all(responses.map((response) => response.json()))).map((body) => body.code as string);
    for (const code of codes) expect(code).toMatch(/^MUMATE[1-9]\d{4}$/);
    expect(new Set(codes).size).toBe(3);
    expect(vi.mocked(console.error)).not.toHaveBeenCalled();
    expect(await rewardState()).toEqual(before);
  });

  test("ten collisions at five digits move on to six digits instead of failing", async () => {
    const before = await rewardState();
    await sql`INSERT INTO bazi_referral_code (anon_id, code) VALUES ('taken', 'MUMATE12345')`;
    fixture.randomInt.mockImplementation((min: number) => (min === 10000 ? 12345 : 654321));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ code: "MUMATE654321" });
    expect(fixture.randomInt).toHaveBeenCalledTimes(11);
    expect(fixture.randomInt.mock.calls[10]).toEqual([100000, 1000000]);
    expect(vi.mocked(console.error)).not.toHaveBeenCalled();
    expect(await rewardState()).toEqual(before);
  });

  test("collisions at every width return a safe 503 and leave rewards unchanged", async () => {
    const before = await rewardState();
    await sql`INSERT INTO bazi_referral_code (anon_id, code) VALUES
      ('taken-5', 'MUMATE12345'), ('taken-6', 'MUMATE123456'), ('taken-7', 'MUMATE1234567'), ('taken-8', 'MUMATE12345678')`;
    fixture.randomInt.mockImplementation((min: number) => Number("12345678".slice(0, String(min).length)));
    const response = await GET(request("private-member-marker"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ error: "สร้างโค้ดแนะนำไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" });
    expect(fixture.randomInt).toHaveBeenCalledTimes(40);
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0][0])).toEqual({ event: "referral_code_exhausted", attempts: 40 });
    expect(JSON.stringify([body, vi.mocked(console.error).mock.calls])).not.toMatch(/private-member-marker|MUMATE1|params:|insert into/i);
    expect(await rewardState()).toEqual(before);
  });

  test("a real non-unique database failure is not retried or exposed", async () => {
    const before = await rewardState();
    await sql`ALTER TABLE bazi_referral_code ADD CONSTRAINT referral_proof_denied CHECK (code <> 'MUMATE45678')`;
    try {
      const response = await GET(request("private-member-marker"));
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
      expect(fixture.randomInt).toHaveBeenCalledTimes(1);
      const logs = JSON.stringify(vi.mocked(console.error).mock.calls);
      expect(logs).toContain("23514");
      expect(JSON.stringify([body, logs])).not.toMatch(/private-member-marker|MUMATE45678|params:|insert into/i);
      expect(await rewardState()).toEqual(before);
    } finally {
      await sql`ALTER TABLE bazi_referral_code DROP CONSTRAINT referral_proof_denied`;
    }
  });

  test("old-code lookup is read-only and existing redemption rewards are awarded once", async () => {
    const before = await rewardState();
    const invite = await GET(new Request("http://localhost/api/referral?code=mumate123", { headers: { "x-mumate-client-secret": clientSecret } }));
    expect(invite.status).toBe(200);
    expect(await invite.json()).toEqual({ code: "MUMATE123", inviterName: null });
    expect(await rewardState()).toEqual(before);
    const response = await POST(request("friend", { anonId: "friend", code: "MUMATE123" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ referrerRewardQi: 50, refereeRewardQi: 30 });
    expect(await sql`SELECT anon_id, coins, xp, qi FROM bazi_wallet ORDER BY anon_id`).toEqual([
      { anon_id: "friend", coins: 0, xp: 50, qi: 30 },
      { anon_id: "owner", coins: 10, xp: 20, qi: 120 },
    ]);
    const awarded = await rewardState();
    expect(awarded.ledger).toHaveLength(3);
    expect(awarded.redemptions).toHaveLength(1);
    expect((await POST(request("friend", { anonId: "friend", code: "MUMATE123" }))).status).toBe(409);
    expect((await POST(request("owner", { anonId: "owner", code: "MUMATE123" }))).status).toBe(409);
    expect(await rewardState()).toEqual(awarded);
  });

  test("a new five-digit code passes lookup and redeem; malformed codes are refused", async () => {
    await sql`INSERT INTO bazi_referral_code (anon_id, code) VALUES ('new-owner', 'MUMATE45678')`;
    const lookup = (code: string) => GET(new Request(`http://localhost/api/referral?code=${code}`, { headers: { "x-mumate-client-secret": clientSecret } }));
    const invite = await lookup("mumate45678");
    expect(invite.status).toBe(200);
    expect(await invite.json()).toEqual({ code: "MUMATE45678", inviterName: null });
    expect((await lookup("MUMATE99999")).status).toBe(404);
    for (const bad of ["MUMATE12", "MUMATE123456789", "MUMATE12A45", "MUMATE", "XMUMATE12345"]) {
      expect((await lookup(bad)).status).toBe(400);
      expect((await POST(request("friend", { anonId: "friend", code: bad }))).status).toBe(400);
    }
    const before = await rewardState();
    const response = await POST(request("friend", { anonId: "friend", code: "MUMATE45678" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ redeemed: "MUMATE45678", referrerRewardQi: 50, refereeRewardQi: 30 });
    const after = await rewardState();
    expect(after.redemptions).toHaveLength(before.redemptions.length + 1);
    expect(await sql`SELECT anon_id, qi FROM bazi_wallet WHERE anon_id IN ('friend', 'new-owner') ORDER BY anon_id`).toEqual([
      { anon_id: "friend", qi: 30 },
      { anon_id: "new-owner", qi: 50 },
    ]);
    expect((await POST(request("friend", { anonId: "friend", code: "MUMATE45678" }))).status).toBe(409);
  });
});
