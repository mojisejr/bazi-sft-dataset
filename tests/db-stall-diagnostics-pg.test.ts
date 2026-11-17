/**
 * The three stall cases of src/db/stall-diagnostics.ts on real sockets and the real driver, told apart from the log
 * lines alone: a silent socket, a slow statement, and a statement held up by a busy connection (written behind the
 * slow one, or waiting for a connection).
 * Same disposable loopback database and proxy idea as tests/db-resilient-sql-pg.test.ts (DB_STALL_TEST_DATABASE_URL,
 * database name stall_proof; npm run test:db-stall requires it instead of skipping).
 */
import net from "node:net";

import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { createResilientSql } from "@/db/resilient-sql";

const databaseUrl = process.env.DB_STALL_TEST_DATABASE_URL;
const required = process.env.DB_STALL_REQUIRE_DB === "1";

function stallProxy(target: URL) {
  const open = new Set<{ client: net.Socket; server: net.Socket; silent: boolean }>();
  const listener = net.createServer((client) => {
    const pair = { client, server: net.connect(Number(target.port), target.hostname), silent: false };
    open.add(pair);
    client.on("data", (chunk) => { if (!pair.silent) pair.server.write(chunk); });
    pair.server.on("data", (chunk) => { if (!pair.silent) client.write(chunk); });
    const drop = () => { open.delete(pair); client.destroy(); pair.server.destroy(); };
    client.on("close", drop).on("error", drop);
    pair.server.on("close", drop).on("error", drop);
  });
  return {
    listen: () => new Promise<number>((resolve) => listener.listen(0, "127.0.0.1", () => resolve((listener.address() as net.AddressInfo).port))),
    silenceOpenConnections: () => { for (const pair of open) pair.silent = true; return open.size; },
    close: () => { for (const pair of open) { pair.client.destroy(); pair.server.destroy(); } listener.close(); },
  };
}

type Line = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The reading a person would make from the lines of one stalled query, written down so the test can check it. */
function classify(stall: Line, late: Line | undefined) {
  if (stall.diag.query.sent === false) return "waiting for a connection";
  if (stall.diag.query.active === false) return "written behind another statement";
  if (late?.outcome === "answered") return "slow statement";
  if (late?.outcome === "rejected") return "silent socket";
  return "unsettled";
}

describe.skipIf(!databaseUrl && !required)("stall diagnostics against a real database", () => {
  let proxy: ReturnType<typeof stallProxy>;
  let proxied: string;
  const pools: ReturnType<typeof postgres>[] = [];
  const lines: string[] = [];
  const parsed = () => lines.map((line) => JSON.parse(line) as Line);
  const stalls = () => parsed().filter((line) => line.event === "db_query_stall");
  const lates = () => parsed().filter((line) => line.event === "db_query_late_settle");

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("Set DB_STALL_TEST_DATABASE_URL to a disposable loopback stall_proof database.");
    const url = new URL(databaseUrl);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/stall_proof") {
      throw new Error("Refusing the stall proof outside a disposable loopback stall_proof database.");
    }
    proxy = stallProxy(url);
    const port = await proxy.listen();
    const p = new URL(databaseUrl);
    p.hostname = "127.0.0.1";
    p.port = String(port);
    proxied = p.toString();
  });
  beforeEach(() => { lines.length = 0; });
  afterAll(async () => {
    proxy?.close();
    await Promise.all(pools.map((pool) => pool.end({ timeout: 0 }).catch(() => {})));
  });

  const guarded = (max: number) => createResilientSql(() => {
    const pool = postgres(proxied, { prepare: false, max, connect_timeout: 10, idle_timeout: 20, max_lifetime: 60 * 30 });
    pools.push(pool);
    return pool;
  }, { firstMs: 500, retryMs: 5_000, retireGraceS: 1, log: (line) => lines.push(line) });

  test("silent socket: sent, being answered, no byte comes back, and the abandoned query is rejected when the socket is destroyed", async () => {
    const sql = guarded(2);
    await Promise.all([sql.unsafe("select 1"), sql.unsafe("select pg_sleep(0.05)")]);
    expect(proxy.silenceOpenConnections()).toBeGreaterThan(0);
    await expect(sql.unsafe("select 42 as answer")).resolves.toEqual([{ answer: 42 }]);
    await wait(1_600);
    const [stall] = stalls();
    const [late] = lates();
    expect(stall.diag.query).toMatchObject({ sent: true, active: true, sharing_connection: 0 });
    expect(stall.diag.query.connection.served).toBeGreaterThanOrEqual(1);
    expect(stall.diag.pool).toMatchObject({ max: 2, in_flight: 1, active: 1, pipelined: 0, not_sent: 0 });
    expect(stall.diag.sockets.length).toBeGreaterThanOrEqual(1);
    expect(late).toMatchObject({ attempt: 1, outcome: "rejected" });
    expect(late.error_code).toMatch(/^CONNECTION_/);
    expect(late.late_ms).toBeGreaterThanOrEqual(900);
    expect(classify(stall, late)).toBe("silent socket");
  });

  test("slow statement: sent, being answered, and the abandoned query answers late", async () => {
    const sql = guarded(2);
    await sql.unsafe("select 1");
    await sql.unsafe("select pg_sleep(1.2)");
    await wait(300);
    const [stall] = stalls();
    const late = lates().find((line) => line.attempt === 1);
    expect(stall.diag.query).toMatchObject({ sent: true, active: true });
    expect(late).toMatchObject({ outcome: "answered" });
    expect(late!.settled_after_ms).toBeGreaterThanOrEqual(1_150);
    expect(late!.late_ms).toBeGreaterThanOrEqual(600);
    // the socket that carried it read bytes between the stall and the late answer
    expect(late!.sockets?.some((socket: Line) => socket.read_delta > 0) ?? true).toBe(true);
    expect(classify(stall, late)).toBe("slow statement");
  });

  test("busy connection, statement without parameters: the driver writes it behind the slow one and the log says what is ahead", async () => {
    const sql = guarded(1);
    await sql.unsafe("select 1");
    const slow = Promise.resolve(sql.unsafe("select pg_sleep(1.4)")); // the handle is lazy: start it now
    await wait(50);
    await expect(sql.unsafe("select 7 as answer")).resolves.toEqual([{ answer: 7 }]);
    await slow;
    await wait(300);
    const behind = stalls().find((line) => line.diag.attempt === 1 && line.diag.query.active === false);
    expect(behind).toBeDefined();
    expect(behind!.diag.query).toMatchObject({ sent: true, active: false, sharing_connection: 1, ahead: { label: "read:other" } });
    expect(behind!.diag.query.ahead.running_ms).toBeGreaterThanOrEqual(450);
    expect(behind!.diag.pool).toMatchObject({ max: 1, in_flight: 2, pipelined: 1, active: 1, not_sent: 0 });
    expect(classify(behind!, undefined)).toBe("written behind another statement");
    const head = stalls().find((line) => line.diag.attempt === 1 && line.diag.query.active === true);
    expect(head!.diag.query).toMatchObject({ sent: true, ahead: null });
    expect(classify(head!, lates().find((line) => line.outcome === "answered"))).toBe("slow statement");
  });

  test("busy connection, statement with parameters (what Drizzle sends): it waits for a connection and is reported as not sent", async () => {
    const sql = guarded(1);
    await sql.unsafe("select 1");
    const slow = Promise.resolve(sql.unsafe("select pg_sleep($1::float8)", [1.4] as never));
    await wait(50);
    await expect(sql.unsafe("select $1::int as answer", [7] as never)).resolves.toEqual([{ answer: 7 }]);
    await slow;
    await wait(300);
    const waiting = stalls().find((line) => line.diag.attempt === 1 && line.diag.query.sent === false);
    expect(waiting).toBeDefined();
    expect(waiting!.diag.pool).toMatchObject({ max: 1, in_flight: 2, not_sent: 1, active: 1, pipelined: 0 });
    expect(classify(waiting!, undefined)).toBe("waiting for a connection");
  });

  test("the path without a stall logs nothing", async () => {
    const sql = guarded(3);
    await Promise.all([1, 2, 3, 4, 5, 6].map((n) => sql.unsafe(`select ${n} as n`)));
    await (sql as unknown as ReturnType<typeof postgres>).begin(async (tx) => { await tx.unsafe("select 1"); });
    expect(lines).toEqual([]);
  });
});
