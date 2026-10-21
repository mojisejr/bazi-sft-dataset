/**
 * bdash live-read guards against a real Postgres (mumate-bdash-v2-001 slice 2). BDASH_TEST_DATABASE_URL must name a
 * disposable database; APP_DATABASE_URL is never used. npm run test:bdash-db requires it instead of skipping.
 */
import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { cached, clearBdashCache, dbRunner, RangeTooHeavyError } from "@/lib/bdash/live";
import { parseRange } from "@/lib/bdash/range";

const url = process.env.BDASH_TEST_DATABASE_URL;
const required = process.env.BDASH_REQUIRE_DB === "1";
if (required && !url) throw new Error("BDASH_TEST_DATABASE_URL is required for test:bdash-db");

const range = parseRange({ range: "7" }, "2026-10-21");
const quiet = () => {};

describe.skipIf(!url)("bdash live reads on Postgres", () => {
  test("a statement over the timeout becomes 'range too heavy'", async () => {
    clearBdashCache();
    const run = dbRunner({ url, timeoutMs: 200, log: quiet });
    await expect(cached("stay", range, async (q) => q("sleep").execute(sql`select pg_sleep(1)`), { run })).rejects.toBeInstanceOf(RangeTooHeavyError);
  });

  test("the transaction cannot write", async () => {
    clearBdashCache();
    const run = dbRunner({ url, log: quiet });
    await expect(cached("money", range, async (q) => q("write").execute(sql`create table bdash_must_not_exist (i int)`), { run })).rejects.toMatchObject({
      cause: expect.objectContaining({ code: "25006" }), // read_only_sql_transaction
    });
  });

  test("every query logs its duration", async () => {
    clearBdashCache();
    const lines: string[] = [];
    const run = dbRunner({ url, log: (l) => lines.push(l) });
    await cached("features", range, async (q) => q("one").execute(sql`select 1`), { run });
    expect(JSON.parse(lines[0])).toMatchObject({ event: "bdash_query", page: "features", query: "one", days: 7, ms: expect.any(Number) });
  });
});
