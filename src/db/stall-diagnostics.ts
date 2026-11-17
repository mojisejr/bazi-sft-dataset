import net from "node:net";

import { getTableName, isTable } from "drizzle-orm";

import * as schema from "@/db/schema";

// What a stalled query looked like, so its cause can be read from the log (mumate-fe-db-resilience-001 slice 7).
//
// resilient-sql.ts reports that a query passed its bound. That alone cannot tell three different things apart:
//   - the query never reached a connection (all connections busy or still connecting),
//   - it was written to a connection behind another query that had not answered (postgres.js pipelines on a busy
//     connection, so one slow statement holds every statement written after it on that connection),
//   - it was the statement the connection was working on and the answer did not come (slow statement or silent socket).
// This module reads that state at the moment of the stall, and again when the abandoned query finally settles.
//
// Rules: it changes no behaviour and never throws into the query path. It never logs SQL text, parameters, row data
// or error messages - only counts, durations, numbers the driver and the socket already hold, an error CODE, and a
// label built from a fixed list of table names. On the path without a stall it keeps counters only.

type Log = (line: string) => void;

/** Tables reached through raw SQL rather than the Drizzle schema. Together with the schema this is the fixed list. */
const RAW_SQL_TABLES = [
  "v2_payment", "user", "user_provider", "ai_question_log", "discount_code", "discount_redemption", "share_snapshot",
  "member_subscription", "promo_campaign_link", "ebook_funnel_event", "course_video", "ebook_order", "member_payment",
  "user_friend_get_friend", "promo_share_campaign", "payment_quote", "payment_package",
] as const;

export const KNOWN_TABLES: ReadonlySet<string> = new Set<string>([
  ...(Object.values(schema) as unknown[]).filter(isTable).map((table) => getTableName(table)),
  ...RAW_SQL_TABLES,
]);

export type QueryKind = "read" | "write" | "other";

/** `kind:table` where table is a name from the fixed list, else `kind:other`. Nothing else from the text leaves. */
export function queryLabel(kind: QueryKind, text: unknown): string {
  if (typeof text !== "string") return `${kind}:other`;
  const match = /\b(?:from|into|update|join)\s+(?:"?[a-z_][a-z0-9_]*"?\.)?"?([a-z_][a-z0-9_]*)"?/i.exec(text.slice(0, 4_000));
  const table = match?.[1]?.toLowerCase();
  return `${kind}:${table && KNOWN_TABLES.has(table) ? table : "other"}`;
}

/** Only a short upper-case code or SQLSTATE may be logged from an error - never its message. */
function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code) ? code : "other";
}

type Connection = { seq: number; firstSeen: number; served: number };
type Entry = { query: unknown; kind: QueryKind; text: unknown; startedAt: number; attempt: 1 | 2; abandonedAt?: number };
type PoolState = {
  id: number;
  createdAt: number;
  max: number | null;
  port: number | null;
  inFlight: Set<Entry>;
  served: number;
  transactions: number;
  stalls: number;
};

const SOCKET_LIMIT = 12;
const SOCKET_SNAPSHOT_EVERY_MS = 1_000;

/** postgres.js sets `state` to the connection's backend object when it writes the query, and `active` on the one being answered. */
function driverState(query: unknown): { backend: object | null; pid: number | null; active: boolean | null } {
  const q = query as { state?: unknown; active?: unknown } | null;
  if (!q || (typeof q !== "object" && typeof q !== "function") || !("state" in q)) return { backend: null, pid: null, active: null };
  const backend = q.state && typeof q.state === "object" ? (q.state as object) : null;
  const pid = backend && typeof (backend as { pid?: unknown }).pid === "number" ? (backend as { pid: number }).pid : null;
  return { backend, pid, active: typeof q.active === "boolean" ? q.active : null };
}

export function createStallDiagnostics(log: Log, now: () => number = Date.now) {
  let poolSeq = 0;
  let connectionSeq = 0;
  let snapshotSeq = 0;
  let lastSnapshotAt = -Infinity;
  const connections = new WeakMap<object, Connection>();
  const sockets = new WeakMap<net.Socket, { firstSeen: number; pool: number; at: number; read: number; written: number }>();

  function connectionOf(backend: object, at: number) {
    let known = connections.get(backend);
    if (!known) connections.set(backend, (known = { seq: ++connectionSeq, firstSeen: at, served: 0 }));
    return known;
  }

  /** Wire counters of every open socket to the database port. Read only when a query stalls or settles late. */
  function socketSnapshot(pool: PoolState, at: number, force = false) {
    if (pool.port === null) return { sockets: null };
    if (!force && at - lastSnapshotAt < SOCKET_SNAPSHOT_EVERY_MS) return { sockets: null, sockets_seq: snapshotSeq };
    const handles = (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles?.();
    if (!Array.isArray(handles)) return { sockets: null };
    lastSnapshotAt = at;
    const open = handles.filter((h): h is net.Socket => h instanceof net.Socket && !h.destroyed && h.remotePort === pool.port);
    const rows = open.slice(0, SOCKET_LIMIT).map((socket) => {
      const read = socket.bytesRead;
      const written = socket.bytesWritten;
      const before = sockets.get(socket);
      // a socket first seen now belongs to the newest pool or an older one that was never snapshotted
      const firstSeenPool = before?.pool ?? poolSeq;
      sockets.set(socket, { firstSeen: before?.firstSeen ?? at, pool: firstSeenPool, at, read, written });
      return {
        port: socket.localPort ?? null,
        first_seen_pool: firstSeenPool,
        seen_ms: before ? at - before.firstSeen : 0,
        read,
        written,
        write_buffer: socket.writableLength,
        since_ms: before ? at - before.at : null,
        read_delta: before ? read - before.read : null,
        written_delta: before ? written - before.written : null,
      };
    });
    return { sockets: rows, sockets_total: open.length, sockets_seq: ++snapshotSeq };
  }

  function poolCounts(pool: PoolState, at: number) {
    let notSent = 0;
    let pipelined = 0;
    let active = 0;
    let unknown = 0;
    let abandoned = 0;
    for (const entry of pool.inFlight) {
      if (entry.abandonedAt !== undefined) abandoned += 1;
      const state = driverState(entry.query);
      if (state.active === null) unknown += 1;
      else if (!state.backend) notSent += 1;
      else if (state.active) active += 1;
      else pipelined += 1;
    }
    return {
      id: pool.id, age_ms: at - pool.createdAt, max: pool.max, in_flight: pool.inFlight.size, not_sent: notSent,
      pipelined, active, unknown, abandoned, transactions: pool.transactions, served: pool.served, stalls: pool.stalls,
    };
  }

  function queryState(pool: PoolState, entry: Entry, at: number) {
    const state = driverState(entry.query);
    if (state.active === null) return { sent: null };
    if (!state.backend) return { sent: false };
    const connection = connectionOf(state.backend, at);
    let sharing = 0;
    let ahead: { label: string; running_ms: number } | null = null;
    for (const other of pool.inFlight) {
      if (other === entry) continue;
      const otherState = driverState(other.query);
      if (otherState.backend !== state.backend) continue;
      sharing += 1;
      if (otherState.active) ahead = { label: queryLabel(other.kind, other.text), running_ms: at - other.startedAt };
    }
    return {
      sent: true,
      active: state.active,
      connection: { seq: connection.seq, pid: state.pid, seen_ms: at - connection.firstSeen, served: connection.served },
      sharing_connection: sharing,
      ahead,
    };
  }

  return {
    pool(options: unknown): PoolState {
      const o = (options ?? {}) as { max?: unknown; port?: unknown };
      const port = Array.isArray(o.port) ? o.port[0] : o.port;
      return {
        id: ++poolSeq,
        createdAt: now(),
        max: typeof o.max === "number" ? o.max : null,
        port: typeof port === "number" ? port : null,
        inFlight: new Set(),
        served: 0,
        transactions: 0,
        stalls: 0,
      };
    },

    /** Counters only: one entry while the query is in flight, tallies when it settles. */
    track(pool: PoolState, query: unknown, settled: PromiseLike<unknown>, kind: QueryKind, text: unknown, attempt: 1 | 2): Entry {
      const entry: Entry = { query, kind, text, startedAt: now(), attempt };
      pool.inFlight.add(entry);
      const done = (rejected: boolean, error?: unknown) => {
        try {
          const at = now();
          pool.inFlight.delete(entry);
          pool.served += 1;
          const state = driverState(query);
          if (state.backend) connectionOf(state.backend, at).served += 1;
          if (entry.abandonedAt === undefined) return;
          log(JSON.stringify({
            event: "db_query_late_settle",
            attempt,
            label: queryLabel(kind, text),
            outcome: rejected ? "rejected" : "answered",
            ...(rejected ? { error_code: errorCode(error) } : {}),
            settled_after_ms: at - entry.startedAt,
            late_ms: at - entry.abandonedAt,
            pool: poolCounts(pool, at),
            ...socketSnapshot(pool, at),
          }));
        } catch {
          // diagnostics never reach the query path
        }
      };
      settled.then(() => done(false), (error) => done(true, error));
      return entry;
    },

    transaction(pool: PoolState, settled: PromiseLike<unknown>) {
      pool.transactions += 1;
      const done = () => { pool.transactions -= 1; };
      settled.then(done, done);
    },

    /** Read BEFORE the pool is retired, so the state is the one the stall happened in. */
    stalled(pool: PoolState, entry: Entry, boundMs: number): Record<string, unknown> {
      try {
        const at = now();
        entry.abandonedAt = at;
        pool.stalls += 1;
        return {
          diag: {
            v: 1,
            attempt: entry.attempt,
            label: queryLabel(entry.kind, entry.text),
            timer_late_ms: at - entry.startedAt - boundMs,
            query: queryState(pool, entry, at),
            pool: poolCounts(pool, at),
            ...socketSnapshot(pool, at),
          },
        };
      } catch {
        return { diag: { v: 1, error: "diag_failed" } };
      }
    },
  };
}
