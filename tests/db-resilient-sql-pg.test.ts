/**
 * Real-socket stall proof for src/db/resilient-sql.ts. DB_STALL_TEST_DATABASE_URL must name a disposable loopback
 * database called stall_proof; APP_DATABASE_URL is never used. npm run test:db-stall requires it instead of skipping.
 *
 * A TCP proxy sits between postgres.js and Postgres and can go silent on every connection already open - bytes are
 * accepted and never delivered, the shape of production's 2026-10-09 hang, where Postgres held statements at PARSE.
 * New connections pass normally.
 */
import net from "node:net";

import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

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

const pending = Symbol("still pending");
const within = <T,>(work: Promise<T>, ms: number) =>
  Promise.race([work, new Promise<typeof pending>((resolve) => setTimeout(() => resolve(pending), ms))]);

describe.skipIf(!databaseUrl && !required)("resilient sql against a real stalled socket", () => {
  let direct: ReturnType<typeof postgres>;
  let proxy: ReturnType<typeof stallProxy>;
  let proxied: string;
  const pools: ReturnType<typeof postgres>[] = [];
  const lines: string[] = [];

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("Set DB_STALL_TEST_DATABASE_URL to a disposable loopback stall_proof database.");
    const url = new URL(databaseUrl);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/stall_proof") {
      throw new Error("Refusing the stall proof outside a disposable loopback stall_proof database.");
    }
    direct = postgres(databaseUrl, { max: 1 });
    await direct`create table if not exists stall_proof_write (id int primary key)`;
    proxy = stallProxy(url);
    const port = await proxy.listen();
    const p = new URL(databaseUrl);
    p.hostname = "127.0.0.1";
    p.port = String(port);
    proxied = p.toString();
  });
  afterEach(async () => { await direct`truncate stall_proof_write`; lines.length = 0; });
  afterAll(async () => {
    proxy?.close();
    await Promise.all(pools.map((pool) => pool.end({ timeout: 0 }).catch(() => {})));
    if (direct) await direct`drop table if exists stall_proof_write`;
    await direct?.end();
  });

  // same settings as src/db/client.ts except ssl (loopback) and pool size
  const makePool = () => {
    const pool = postgres(proxied, { prepare: false, max: 3, connect_timeout: 10, idle_timeout: 20, max_lifetime: 60 * 30 });
    pools.push(pool);
    return pool;
  };
  async function warm(sql: ReturnType<typeof postgres>) {
    await Promise.all([1, 2, 3].map(() => sql.unsafe("select pg_sleep(0.05)")));
  }

  test("without the guard, a query on a silenced connection never answers (the bug)", async () => {
    const plain = makePool();
    await warm(plain);
    expect(proxy.silenceOpenConnections()).toBeGreaterThan(0);
    const stuck = plain.unsafe("select 1 as answer");
    stuck.catch(() => {});
    await expect(within(stuck, 1_500)).resolves.toBe(pending);
  });

  test("with the guard, the same stall costs one bound and the caller gets the normal rows", async () => {
    const sql = createResilientSql(makePool, { firstMs: 500, retryMs: 5_000, retireGraceS: 1, log: (l) => lines.push(l) });
    await warm(sql);
    expect(proxy.silenceOpenConnections()).toBeGreaterThan(0);
    const started = Date.now();
    await expect(sql.unsafe("select 42 as answer")).resolves.toEqual([{ answer: 42 }]);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(JSON.parse(lines[0])).toMatchObject({ event: "db_query_stall", kind: "read", action: "retry_on_fresh_pool" });
  });

  test("a write stalled the same way lands exactly once after the retry", async () => {
    const sql = createResilientSql(makePool, { firstMs: 500, retryMs: 5_000, retireGraceS: 1, log: (l) => lines.push(l) });
    await warm(sql);
    proxy.silenceOpenConnections();
    await expect(sql.unsafe("insert into stall_proof_write (id) values (1) returning id")).resolves.toEqual([{ id: 1 }]);
    // give the retired pool time to destroy its silenced sockets, then count what the database actually holds
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(await direct`select count(*)::int as n from stall_proof_write`).toEqual([{ n: 1 }]);
    expect(JSON.parse(lines[0])).toMatchObject({ kind: "write" });
  });
});
