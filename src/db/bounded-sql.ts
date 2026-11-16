import type postgres from 'postgres'

type Sql = ReturnType<typeof postgres>
type CallableSql = (...args: unknown[]) => unknown
type Pending = PromiseLike<unknown> & { values(): PromiseLike<unknown>; raw(): PromiseLike<unknown> }
type Generation = { sql: Sql; retired: boolean; id: number }
type Scope = { active: boolean; parent?: Scope }

/** A timed out write may already have committed. Callers must not replay it blindly. */
export class DbStallError extends Error {
  readonly code = 'DB_STALL'
  readonly outcome = 'unknown'
  constructor(readonly timeoutMs: number) {
    super(`database operation did not finish within ${timeoutMs} ms`)
    this.name = 'DbStallError'
  }
}

export class DbTransactionExpiredError extends Error {
  readonly code = 'DB_TRANSACTION_EXPIRED'
  constructor() {
    super('database transaction is no longer active')
    this.name = 'DbTransactionExpiredError'
  }
}

/** Opt in only at a call site whose operation is known to have no side effects. */
export async function retrySafeRead<T>(operation: () => PromiseLike<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    // Drizzle wraps driver failures in DrizzleQueryError.cause. Require our actual
    // sentinel in a bounded cause chain, not a message/code that a DB error shares.
    let cause: unknown = error
    let stalled = false
    const seen = new Set<unknown>()
    for (let depth = 0; depth < 8 && cause && !seen.has(cause); depth++) {
      if (cause instanceof DbStallError) { stalled = true; break }
      seen.add(cause)
      cause = typeof cause === 'object' ? (cause as { cause?: unknown }).cause : undefined
    }
    if (!stalled) throw error
    return await operation()
  }
}

type Options = {
  queryTimeoutMs?: number
  transactionTimeoutMs?: number
  log?: (line: string) => void
}

/**
 * Stable facade for Drizzle over replaceable postgres.js pools. No SQL is classified
 * or replayed here. In particular, timing out COMMIT does not prove a rollback.
 * Transaction handles retain their original generation and expire before retirement;
 * a callback resuming later can never submit work to the replacement pool.
 */
export function createResilientSql(createPool: () => Sql, options: Options = {}): Sql {
  const queryMs = options.queryTimeoutMs ?? 5_000
  const transactionMs = options.transactionTimeoutMs ?? 15_000
  if (![queryMs, transactionMs].every(n => Number.isFinite(n) && n > 0)) {
    throw new Error('database deadlines must be positive finite milliseconds')
  }
  const log = options.log ?? (line => console.error(line))
  let current: Generation = { sql: createPool(), retired: false, id: 1 }

  function replacement(generation: Generation) {
    if (current !== generation) return
    const next = createPool()
    Object.assign(next.options.parsers, generation.sql.options.parsers)
    Object.assign(next.options.serializers, generation.sql.options.serializers)
    current = { sql: next, retired: false, id: generation.id + 1 }
  }

  function getCurrent() {
    // A synchronous factory failure cannot strand the facade forever. The next
    // request may try construction again, but never uses the retired pool.
    if (current.retired) replacement(current)
    return current
  }

  function assertActive(generation: Generation, scope?: Scope) {
    for (let s = scope; s; s = s.parent) {
      if (!s.active) throw new DbTransactionExpiredError()
    }
    if (generation.retired) {
      if (scope) throw new DbTransactionExpiredError()
      throw new DbStallError(queryMs)
    }
  }

  function retire(generation: Generation, ms: number) {
    if (generation.retired) return
    generation.retired = true
    // Force-close rather than leave uncertain writes running beside a replacement.
    // Even a closed socket cannot prove whether a COMMIT response was lost.
    void generation.sql.end({ timeout: 0 }).catch(() => {})
    replacement(generation)
    log(JSON.stringify({ event: 'db_query_stall', generation: generation.id, waited_ms: ms, action: 'retire_pool_no_replay' }))
  }

  function bounded<T>(work: () => PromiseLike<T>, generation: Generation, ms: number, scope?: Scope): Promise<T> {
    assertActive(generation, scope)
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (scope) scope.active = false
        try {
          retire(generation, ms)
        } catch {
          // Pool construction/logging must not turn a bounded failure into an
          // uncaught timer exception. The retired generation remains unusable.
        }
        reject(new DbStallError(ms))
      }, ms)
      // Register both handlers: the original operation can settle after the deadline.
      Promise.resolve().then(work).then(
        value => { clearTimeout(timer); resolve(value) },
        error => {
          clearTimeout(timer)
          // Other in-flight queries can be rejected by the pool's forced close
          // before their own deadline. Preserve the common stall classification
          // so an explicitly safe read can recover too; writes still never replay.
          reject(generation.retired ? new DbStallError(ms) : error)
        },
      )
    })
  }

  function facade(get: () => Generation, raw?: Sql, scope?: Scope): Sql {
    function query(build: (client: Sql) => Pending) {
      let started: Promise<unknown> | undefined
      let asValues = false
      let asRaw = false
      const run = () => {
        if (!started) {
          const generation = get()
          started = bounded(() => {
            assertActive(generation, scope)
            const pending = build(raw ?? generation.sql)
            return asValues ? pending.values() : asRaw ? pending.raw() : pending
          }, generation, queryMs, scope)
        }
        return started
      }
      const handle = {
        then: (yes?: ((value: unknown) => unknown) | null, no?: ((error: unknown) => unknown) | null) => run().then(yes, no),
        catch: (no: (error: unknown) => unknown) => run().catch(no),
        finally: (done: () => void) => run().finally(done),
        values: () => { asValues = true; return handle },
        raw: () => { asRaw = true; return handle },
        execute: () => { void run().catch(() => {}); return handle },
      }
      return handle
    }

    function transaction(key: 'begin' | 'savepoint', args: unknown[]) {
      const generation = get()
      assertActive(generation, scope)
      const callback = args[args.length - 1]
      if (typeof callback !== 'function') throw new Error('transaction requires a callback')
      const child: Scope = { active: true, parent: scope }
      const client = raw ?? generation.sql
      const wrapped = (tx: Sql) => {
        assertActive(generation, child)
        return callback(facade(() => generation, tx, child))
      }
      return bounded(
        () => (client as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)[key](...args.slice(0, -1), wrapped),
        generation, transactionMs, child,
      ).finally(() => { child.active = false })
    }

    const target = ((...args: unknown[]) => {
      if (Array.isArray((args[0] as { raw?: unknown })?.raw)) return query(client => (client as unknown as CallableSql)(...args) as Pending)
      // Identifier/value builders do not execute a query, but must stay on this tx.
      const generation = get()
      assertActive(generation, scope)
      return ((raw ?? generation.sql) as unknown as CallableSql)(...args)
    }) as unknown as Sql
    return new Proxy(target, {
      get(_target, key) {
        if (key === 'unsafe') return (...args: unknown[]) => query(client => (client.unsafe as unknown as CallableSql)(...args) as Pending)
        if (key === 'begin' || key === 'savepoint') return (...args: unknown[]) => transaction(key, args)
        // These ownership/streaming APIs are not used by this app. Do not expose
        // an unguarded raw client if a future caller starts using one.
        if (key === 'reserve' || key === 'listen' || key === 'subscribe' || key === 'notify') {
          return () => { throw new Error(`guarded database client does not support ${String(key)}`) }
        }
        const generation = get()
        const value = ((raw ?? generation.sql) as unknown as Record<PropertyKey, unknown>)[key]
        return typeof value === 'function' ? value.bind(raw ?? generation.sql) : value
      },
    })
  }
  return facade(getCurrent)
}
