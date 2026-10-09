/**
 * src/db/resilient-sql.ts with stand-in pools (no database). The real-socket stall proof is in
 * tests/db-resilient-sql-pg.test.ts. Bounds are shrunk to milliseconds; the logic is the same.
 */
import { sql as dsql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, test, vi } from "vitest";

import { DbStallError, createResilientSql } from "@/db/resilient-sql";

type Answer = { rows: unknown[] } | "stall" | Error;

/** A stand-in for one postgres.js pool: each query gets the next scripted answer. */
function fakePool(answers: Answer[]) {
  const calls: { text: unknown; mode: "rows" | "values" }[] = [];
  const end = vi.fn(async () => {});
  function pending(text: unknown) {
    const answer = answers.shift() ?? { rows: [{ ok: 1 }] };
    const settle = (mode: "rows" | "values") => {
      calls.push({ text, mode });
      if (answer === "stall") return new Promise(() => {});
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve(mode === "values" ? answer.rows.map((r) => Object.values(r as object)) : answer.rows);
    };
    return { then: (res: never, rej: never) => settle("rows").then(res, rej), values: () => settle("values") };
  }
  const pool = Object.assign((strings: TemplateStringsArray) => pending(strings[0]), {
    unsafe: (text: string) => pending(text),
    options: { parsers: {} as Record<string, unknown>, serializers: {} as Record<string, unknown> },
    end,
  });
  return { pool, calls, end };
}

function harness(...scripts: Answer[][]) {
  const pools = scripts.map(fakePool);
  let made = 0;
  const createPool = vi.fn(() => pools[made++].pool as never);
  const lines: string[] = [];
  const sql = createResilientSql(createPool, { firstMs: 20, retryMs: 60, retireGraceS: 30, log: (l) => lines.push(l) });
  return { sql, pools, createPool, lines };
}

describe("resilient sql", () => {
  test("an answered query goes straight through on the first pool", async () => {
    const h = harness([{ rows: [{ x: 1 }] }]);
    await expect(h.sql.unsafe("select 1 as x")).resolves.toEqual([{ x: 1 }]);
    expect(h.createPool).toHaveBeenCalledTimes(1);
    expect(h.lines).toEqual([]);
  });

  test("a stalled query is retried on a fresh pool and the caller gets the normal answer", async () => {
    const h = harness(["stall"], [{ rows: [{ x: 2 }] }]);
    const started = Date.now();
    await expect(h.sql.unsafe("select 2 as x")).resolves.toEqual([{ x: 2 }]);
    expect(Date.now() - started).toBeLessThan(200);
    expect(h.createPool).toHaveBeenCalledTimes(2);
    // the stalled pool is retired gracefully: queries already on it may finish, then its sockets go
    expect(h.pools[0].end).toHaveBeenCalledWith({ timeout: 30 });
    expect(JSON.parse(h.lines[0])).toMatchObject({ event: "db_query_stall", kind: "read", action: "retry_on_fresh_pool" });
  });

  test("array mode survives the retry (drizzle's .values() path)", async () => {
    const h = harness(["stall"], [{ rows: [{ a: 1, b: 2 }] }]);
    await expect(h.sql.unsafe("select 1, 2").values()).resolves.toEqual([[1, 2]]);
    expect(h.pools[1].calls).toEqual([{ text: "select 1, 2", mode: "values" }]);
  });

  test("tagged-template queries (health's select 1) are bounded too", async () => {
    const h = harness(["stall"], [{ rows: [{ "?column?": 1 }] }]);
    await expect(h.sql`select 1`).resolves.toEqual([{ "?column?": 1 }]);
    expect(h.createPool).toHaveBeenCalledTimes(2);
  });

  test("a database error is not a stall: no retry, no new pool, the error reaches the caller", async () => {
    const failure = Object.assign(new Error("duplicate key"), { code: "23505" });
    const h = harness([failure]);
    await expect(h.sql.unsafe("insert into t values (1)")).rejects.toBe(failure);
    expect(h.createPool).toHaveBeenCalledTimes(1);
    expect(h.pools[0].end).not.toHaveBeenCalled();
  });

  test("many queries stalled on the same pool replace it once", async () => {
    const h = harness(["stall", "stall", "stall"], [{ rows: [1] }, { rows: [2] }, { rows: [3] }]);
    const answers = await Promise.all([h.sql.unsafe("select 1"), h.sql.unsafe("select 2"), h.sql.unsafe("select 3")]);
    expect(answers).toEqual([[1], [2], [3]]);
    expect(h.createPool).toHaveBeenCalledTimes(2);
    expect(h.pools[0].end).toHaveBeenCalledTimes(1);
  });

  test("a write is retried and logged as a write", async () => {
    const h = harness(["stall"], [{ rows: [{ id: 7 }] }]);
    await expect(h.sql.unsafe("insert into t values (7) returning id")).resolves.toEqual([{ id: 7 }]);
    expect(JSON.parse(h.lines[0])).toMatchObject({ kind: "write", action: "retry_on_fresh_pool" });
  });

  test("a second stall gives up with DbStallError after both bounds, logged", async () => {
    const h = harness(["stall"], ["stall"]);
    await expect(h.sql.unsafe("select pg_sleep(9)")).rejects.toBeInstanceOf(DbStallError);
    expect(h.lines.map((l) => JSON.parse(l).action)).toEqual(["retry_on_fresh_pool", "gave_up"]);
  });

  test("drizzle on top: its parser overrides follow the client to the fresh pool, and queries still return rows", async () => {
    const h = harness(["stall"], [{ rows: [{ x: 1 }] }]);
    const db = drizzle(h.sql);
    expect(h.pools[0].pool.options.parsers["1184"]).toBeTypeOf("function");
    await expect(db.execute(dsql`select 1 as x`)).resolves.toEqual([{ x: 1 }]);
    expect(h.pools[1].pool.options.parsers["1184"]).toBe(h.pools[0].pool.options.parsers["1184"]);
    expect(h.pools[1].pool.options.serializers["114"]).toBeTypeOf("function");
  });
});
