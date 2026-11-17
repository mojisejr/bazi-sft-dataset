/**
 * src/db/stall-diagnostics.ts through src/db/resilient-sql.ts, without a database. Stand-in pools script each
 * query's answer and the state postgres.js would show for it. One test uses the real driver against a listener
 * that accepts connections and never answers. The real-database cases are in tests/db-stall-diagnostics-pg.test.ts.
 */
import net from "node:net";

import postgres from "postgres";
import { describe, expect, test } from "vitest";

import { DbStallError, createResilientSql } from "@/db/resilient-sql";
import { KNOWN_TABLES, queryLabel } from "@/db/stall-diagnostics";

type Script = {
  /** resolve with rows, never settle, or settle after `ms` with rows or an error */
  answer: { rows: unknown[] } | "stall" | { after: number; rows?: unknown[]; error?: Error };
  /** what postgres.js would expose on the query: `state` is the connection's backend object, `active` the one being answered */
  state?: object | null;
  active?: boolean;
};

function fakePool(scripts: Script[], options: Record<string, unknown> = {}) {
  function pending() {
    const script = scripts.shift() ?? { answer: { rows: [{ ok: 1 }] } };
    const outcome = () => {
      const a = script.answer;
      if (a === "stall") return new Promise(() => {});
      if ("after" in a) {
        return new Promise((resolve, reject) => setTimeout(() => (a.error ? reject(a.error) : resolve(a.rows ?? [])), a.after));
      }
      return Promise.resolve(a.rows);
    };
    const query = {
      then: (res: never, rej: never) => outcome().then(res, rej),
      values: () => query,
      ...("state" in script ? { state: script.state, active: script.active ?? false } : {}),
    };
    return query;
  }
  return Object.assign(() => pending(), {
    unsafe: () => pending(),
    options: { parsers: {}, serializers: {}, ...options },
    end: async () => {},
  });
}

function harness(...pools: Script[][]) {
  let made = 0;
  const lines: string[] = [];
  const sql = createResilientSql(() => fakePool(pools[made++] ?? []) as never, {
    firstMs: 20, retryMs: 60, retireGraceS: 30, log: (line) => lines.push(line),
  });
  return { sql, lines, parsed: () => lines.map((line) => JSON.parse(line)) };
}

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const aTable = [...KNOWN_TABLES][0];

describe("query label", () => {
  test("names a table only when it is on the fixed list", () => {
    expect(KNOWN_TABLES.size).toBeGreaterThan(50);
    expect(queryLabel("read", `select "id" from "${aTable}" where "id" = $1`)).toBe(`read:${aTable}`);
    expect(queryLabel("write", `insert into ${aTable} (id) values ($1)`)).toBe(`write:${aTable}`);
    expect(queryLabel("write", `update "public"."${aTable}" set x = 1`)).toBe(`write:${aTable}`);
    expect(queryLabel("read", "select * from someone_secret_table where email = 'a@b.co'")).toBe("read:other");
    expect(queryLabel("other", "select pg_sleep(9)")).toBe("other:other");
    expect(queryLabel("read", undefined)).toBe("read:other");
  });
});

describe("stall diagnostics", () => {
  test("a query that answers in time logs nothing", async () => {
    const h = harness([{ answer: { rows: [{ x: 1 }] } }]);
    await expect(h.sql.unsafe("select 1 as x")).resolves.toEqual([{ x: 1 }]);
    expect(h.lines).toEqual([]);
  });

  test("a stall line keeps its old fields and gains the state of the query and the pool", async () => {
    const h = harness([{ answer: "stall" }], [{ answer: { rows: [{ x: 2 }] } }]);
    await expect(h.sql.unsafe(`select "id" from "${aTable}"`)).resolves.toEqual([{ x: 2 }]);
    const [line] = h.parsed();
    expect(line).toMatchObject({ event: "db_query_stall", kind: "read", action: "retry_on_fresh_pool" });
    expect(line.diag).toMatchObject({
      v: 1, attempt: 1, label: `read:${aTable}`, query: { sent: null },
      pool: { id: 1, in_flight: 1, abandoned: 1, stalls: 1, served: 0 }, sockets: null,
    });
    expect(line.diag.timer_late_ms).toBeGreaterThanOrEqual(-5);
    expect(line.diag.pool.age_ms).toBeGreaterThanOrEqual(15);
  });

  test("three places a stalled query can be are told apart: never sent, written behind another, being answered", async () => {
    const connection = { pid: 4242 };
    const h = harness(
      [
        { answer: "stall", state: connection, active: true }, // the slow one at the head of the connection
        { answer: "stall", state: connection, active: false }, // written behind it on the same connection
        { answer: "stall", state: null }, // never reached a connection
      ],
      [{ answer: { rows: [1] } }, { answer: { rows: [2] } }, { answer: { rows: [3] } }],
    );
    await Promise.all([
      h.sql.unsafe(`select * from "${aTable}"`),
      h.sql.unsafe("select 2"),
      h.sql.unsafe("select 3"),
    ]);
    const stalls = h.parsed().filter((line) => line.event === "db_query_stall").map((line) => line.diag);
    expect(stalls).toHaveLength(3);
    expect(stalls[0].query).toMatchObject({ sent: true, active: true, sharing_connection: 1, ahead: null, connection: { pid: 4242 } });
    expect(stalls[1].query).toMatchObject({ sent: true, active: false, sharing_connection: 1, ahead: { label: `read:${aTable}` } });
    expect(stalls[1].query.connection.seq).toBe(stalls[0].query.connection.seq);
    expect(stalls[1].query.ahead.running_ms).toBeGreaterThanOrEqual(15);
    expect(stalls[2].query).toEqual({ sent: false });
    expect(stalls[0].pool).toMatchObject({ in_flight: 3, not_sent: 1, pipelined: 1, active: 1, unknown: 0 });
  });

  test("an abandoned query that answers later says how late", async () => {
    const h = harness([{ answer: { after: 70, rows: [{ late: 1 }] }, state: { pid: 7 }, active: true }], [{ answer: { rows: [{ x: 1 }] } }]);
    await h.sql.unsafe("select 1");
    await settle(90);
    const late = h.parsed().find((line) => line.event === "db_query_late_settle");
    expect(late).toMatchObject({ attempt: 1, label: "read:other", outcome: "answered", pool: { id: 1, in_flight: 0, served: 1 } });
    expect(late).not.toHaveProperty("error_code");
    expect(late.late_ms).toBeGreaterThanOrEqual(30);
    expect(late.settled_after_ms).toBeGreaterThanOrEqual(60);
  });

  test("an abandoned query that is rejected later logs the code and never the message", async () => {
    const destroyed = Object.assign(new Error("write CONNECTION_DESTROYED pooler.example:6543 member 0812345678"), { code: "CONNECTION_DESTROYED" });
    const odd = Object.assign(new Error("boom"), { code: "member said: hello" });
    const h = harness(
      [{ answer: { after: 50, error: destroyed } }, { answer: { after: 50, error: odd } }],
      [{ answer: { rows: [] } }, { answer: { rows: [] } }],
    );
    await Promise.all([h.sql.unsafe("select 1"), h.sql.unsafe("select 2")]);
    await settle(80);
    const late = h.parsed().filter((line) => line.event === "db_query_late_settle");
    expect(late.map((line) => [line.outcome, line.error_code])).toEqual([["rejected", "CONNECTION_DESTROYED"], ["rejected", "other"]]);
    expect(h.lines.join("\n")).not.toMatch(/0812345678|pooler\.example|hello|boom/);
  });

  test("giving up after the retry is described too, on the second pool", async () => {
    const h = harness([{ answer: "stall" }], [{ answer: "stall", state: null }]);
    await expect(h.sql.unsafe("select pg_sleep(9)")).rejects.toBeInstanceOf(DbStallError);
    const [first, second] = h.parsed();
    expect(first.action).toBe("retry_on_fresh_pool");
    expect(second).toMatchObject({ action: "gave_up", diag: { attempt: 2, query: { sent: false }, pool: { id: 2 } } });
  });

  test("no SQL text, parameter or personal data reaches the log", async () => {
    const secrets = ["somchai@example.com", "0891234567", "U4af4980629", "birth_secret_1990", "MUMATE87402", "private_note"];
    const text = `select "private_note" from "${aTable}" where email = 'somchai@example.com' and phone = '0891234567' /* birth_secret_1990 */`;
    const failure = Object.assign(new Error("duplicate key (line_id)=(U4af4980629) MUMATE87402"), { code: "23505" });
    const h = harness(
      [{ answer: "stall", state: { pid: 1 }, active: true }, { answer: { after: 40, error: failure }, state: { pid: 1 }, active: false }],
      [{ answer: "stall" }, { answer: { rows: [] } }],
    );
    const results = await Promise.allSettled([
      h.sql.unsafe(text, ["somchai@example.com", "U4af4980629"] as never),
      h.sql.unsafe(`insert into "${aTable}" (code) values ('MUMATE87402')`),
    ]);
    await settle(120);
    expect(results[0].status).toBe("rejected");
    expect(h.lines.length).toBeGreaterThanOrEqual(3);
    const all = h.lines.join("\n");
    for (const secret of secrets) expect(all).not.toContain(secret);
    expect(all).not.toMatch(/select|insert|where|values|duplicate/i);
    // every string in a line is an event name, an action, a kind, a label from the fixed list or an error code
    const strings: string[] = [];
    JSON.parse(`[${h.lines.join(",")}]`, (_key, value) => { if (typeof value === "string") strings.push(value); return value; });
    for (const value of strings) {
      expect(value).toMatch(new RegExp(`^(db_query_stall|db_query_late_settle|retry_on_fresh_pool|gave_up|read|write|other|answered|rejected|[A-Z0-9_]{1,40}|(read|write|other):(other|${aTable}))$`));
    }
  });

  test("transactions are counted while open and their result is untouched", async () => {
    let finish: (value: unknown) => void = () => {};
    const pool = Object.assign(fakePool([{ answer: "stall" }]), { begin: () => new Promise((resolve) => { finish = resolve; }) });
    const lines: string[] = [];
    let made = 0;
    const sql = createResilientSql(() => (made++ === 0 ? pool : fakePool([])) as never, { firstMs: 20, retryMs: 60, log: (line) => lines.push(line) });
    const tx = (sql as unknown as { begin: (fn: () => void) => Promise<unknown> }).begin(() => {});
    await sql.unsafe("select 1");
    expect(JSON.parse(lines[0]).diag.pool.transactions).toBe(1);
    finish("committed");
    await expect(tx).resolves.toBe("committed");
  });

  test("the real driver: a query waiting for a connection that never opens is reported as never sent", async () => {
    const held: net.Socket[] = [];
    const blackHole = net.createServer((socket) => { held.push(socket); socket.on("error", () => {}); });
    const port = await new Promise<number>((resolve) => blackHole.listen(0, "127.0.0.1", () => resolve((blackHole.address() as net.AddressInfo).port)));
    const pools: ReturnType<typeof postgres>[] = [];
    const lines: string[] = [];
    const sql = createResilientSql(() => {
      const pool = postgres(`postgres://nobody:nothing@127.0.0.1:${port}/nowhere`, { prepare: false, max: 2, connect_timeout: 5 });
      pools.push(pool);
      return pool;
    }, { firstMs: 150, retryMs: 150, retireGraceS: 0, log: (line) => lines.push(line) });
    try {
      await expect(sql.unsafe("select 1")).rejects.toBeInstanceOf(DbStallError);
      const [first, second] = lines.map((line) => JSON.parse(line)).filter((line) => line.event === "db_query_stall");
      expect(first.diag).toMatchObject({ attempt: 1, query: { sent: false }, pool: { max: 2, in_flight: 1, not_sent: 1, active: 0 } });
      expect(second.diag).toMatchObject({ attempt: 2, query: { sent: false }, pool: { id: 2 } });
      // the socket to the listener is counted: bytes went out (the startup message) and none came back
      expect(first.diag.sockets_total).toBeGreaterThanOrEqual(1);
      expect(first.diag.sockets[0]).toMatchObject({ read: 0, write_buffer: 0 });
      expect(first.diag.sockets[0].written).toBeGreaterThan(0);
    } finally {
      await Promise.all(pools.map((pool) => pool.end({ timeout: 0 }).catch(() => {})));
      for (const socket of held) socket.destroy();
      await new Promise((resolve) => blackHole.close(resolve));
    }
  });
});
