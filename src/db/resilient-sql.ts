import type postgres from "postgres";

// A postgres.js client that does not let one stalled statement freeze the engine (mumate-vercel-to-do-001 slice 7,
// 2026-10-10). On 2026-10-09 20:20-20:30 +07 production bazi stopped answering for 9.5 minutes: Supabase's Postgres
// log showed its statements stuck at PARSE with an empty query - the database had received only the first protocol
// message of each and was idle, waiting for the rest. postgres.js has no per-query bound, so each stalled statement
// held one of the 10 pool connections for good, until all 10 were held and every route (and /api/health) hung.
//
// Every query here runs against the CURRENT pool with a short bound. If the bound passes, that pool is retired (it
// gets `end({ timeout })`, so healthy queries still running on it finish; stuck sockets are destroyed afterwards), a
// fresh pool takes its place, and the query runs once more there with a longer bound - so a stall costs the user a few
// seconds, not an error, and a legitimately slow query still completes on the second try. Only a second timeout
// reaches the caller.
//
// Retrying a write is safe for the failure we saw: a statement stuck at PARSE never executed, and a dropped socket
// aborts its implicit transaction. A duplicate would need a write that was genuinely executing past FIRST_ATTEMPT_MS;
// every retry is logged with its kind so that case would be visible.

type Sql = ReturnType<typeof postgres>;
type Pending = PromiseLike<unknown> & { values(): PromiseLike<unknown>; catch?: (f: () => void) => unknown };

export const FIRST_ATTEMPT_MS = 5_000;
export const RETRY_ATTEMPT_MS = 30_000;
/** How long a retired pool keeps serving the queries already on it before its sockets are destroyed. */
export const RETIRE_GRACE_S = 30;

export class DbStallError extends Error {
  constructor(readonly ms: number) {
    super(`database query got no answer within ${ms} ms`);
  }
}

type Options = { firstMs?: number; retryMs?: number; retireGraceS?: number; log?: (line: string) => void };

function kindOf(text: unknown): "read" | "write" | "other" {
  const head = typeof text === "string" ? text.trimStart().slice(0, 12).toLowerCase() : "";
  if (head.startsWith("select") || head.startsWith("with")) return "read";
  if (head.startsWith("insert") || head.startsWith("update") || head.startsWith("delete")) return "write";
  return "other";
}

function bounded<T>(work: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stall = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DbStallError(ms)), ms);
  });
  return Promise.race([Promise.resolve(work), stall]).finally(() => clearTimeout(timer));
}

export function createResilientSql(createPool: () => Sql, options: Options = {}): Sql {
  const firstMs = options.firstMs ?? FIRST_ATTEMPT_MS;
  const retryMs = options.retryMs ?? RETRY_ATTEMPT_MS;
  const retireGraceS = options.retireGraceS ?? RETIRE_GRACE_S;
  const log = options.log ?? ((line: string) => console.error(line));
  let current = createPool();

  function retire(stalled: Sql) {
    if (stalled !== current) return; // another query already replaced it
    const next = createPool();
    // drizzle's driver rewrites parsers/serializers on the client it is given (drizzle-orm/postgres-js/driver.js);
    // carry them over so rows keep the same shape on the new pool.
    Object.assign(next.options.parsers, stalled.options.parsers);
    Object.assign(next.options.serializers, stalled.options.serializers);
    current = next;
    stalled.end({ timeout: retireGraceS }).catch(() => {});
  }

  async function run(build: (sql: Sql) => Pending, asValues: boolean, text: unknown): Promise<unknown> {
    const started = Date.now();
    const pool = current;
    const first = asValues ? build(pool).values() : build(pool);
    try {
      return await bounded(first, firstMs);
    } catch (error) {
      if (!(error instanceof DbStallError)) throw error;
      // the abandoned query settles later (answer or destroyed socket); nobody awaits it any more
      Promise.resolve(first).then(undefined, () => {});
      retire(pool);
      log(JSON.stringify({ event: "db_query_stall", kind: kindOf(text), waited_ms: Date.now() - started, action: "retry_on_fresh_pool" }));
    }
    const retried = asValues ? build(current).values() : build(current);
    try {
      return await bounded(retried, retryMs);
    } catch (error) {
      if (error instanceof DbStallError) {
        Promise.resolve(retried).then(undefined, () => {});
        log(JSON.stringify({ event: "db_query_stall", kind: kindOf(text), waited_ms: Date.now() - started, action: "gave_up" }));
      }
      throw error;
    }
  }

  // The lazy handle every caller gets back: awaiting it runs the query in row mode, `.values()` in array mode - the
  // two shapes drizzle's postgres-js session uses (`await client.unsafe(q, p)` and `client.unsafe(q, p).values()`).
  function handle(build: (sql: Sql) => Pending, text: unknown) {
    return {
      then(resolve?: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return run(build, false, text).then(resolve, reject);
      },
      catch(reject: (e: unknown) => unknown) {
        return run(build, false, text).catch(reject);
      },
      values() {
        return run(build, true, text);
      },
    };
  }

  const facade = function (strings: TemplateStringsArray, ...values: unknown[]) {
    return handle((sql) => (sql as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Pending)(strings, ...values), strings?.[0]);
  } as unknown as Sql;

  return new Proxy(facade, {
    get(_target, key) {
      if (key === "unsafe") {
        return (text: string, params?: unknown[], queryOptions?: unknown) =>
          handle((sql) => (sql.unsafe as unknown as (...a: unknown[]) => Pending)(text, params, queryOptions), text);
      }
      if (key === "options") return current.options;
      const value = (current as unknown as Record<PropertyKey, unknown>)[key];
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(current) : value;
    },
  });
}
