import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import net from 'node:net'
import { randomUUID } from 'node:crypto'
import { createPaidQiGrant } from '@/lib/bazi/qi/paid-grant'
import { createResilientSql } from '@/db/bounded-sql'

// This suite creates synthetic tables only in a named, disposable loopback database.
// It never accepts an application database or silently succeeds when a required proof is skipped.
const databaseUrl = process.env.QI_GRANT_TEST_DATABASE_URL
if (process.env.QI_GRANT_REQUIRE_DB === '1' && !databaseUrl) throw new Error('QI_GRANT_TEST_DATABASE_URL required')
// postgres.js supports max_pipeline at runtime but its published Options type omits it.
const poolOptions = (max: number) => ({ ssl: false as const, prepare: false, max, max_pipeline: 1 })

function checkedTarget() {
  const url = new URL(databaseUrl!)
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/qi_grant_proof') {
    throw new Error('Paid grant proof requires loopback /qi_grant_proof; restored/production databases refused')
  }
  return url
}

function commitReplyProxy(target: URL) {
  const upstreamPort = Number(target.port)
  const upstreamHost = target.hostname
  let suppressCommit = false
  let commits = 0
  const sockets = new Set<net.Socket>()
  const listener = net.createServer(client => {
    const server = net.connect(upstreamPort, upstreamHost)
    sockets.add(client); sockets.add(server)
    let hideReply = false
    client.on('data', chunk => {
      if (suppressCommit && /\bcommit\b/i.test(chunk.toString('utf8'))) { hideReply = true; commits++ }
      server.write(chunk)
    })
    server.on('data', chunk => { if (!hideReply) client.write(chunk) })
    const close = () => { sockets.delete(client); sockets.delete(server); client.destroy(); server.destroy() }
    client.on('close', close).on('error', close)
    server.on('close', close).on('error', close)
  })
  return {
    listen: () => new Promise<number>(resolve => listener.listen(0, '127.0.0.1', () => resolve((listener.address() as net.AddressInfo).port))),
    loseCommit: () => { suppressCommit = true },
    commits: () => commits,
    close: () => { for (const socket of sockets) socket.destroy(); listener.close() },
  }
}

describe.skipIf(!databaseUrl)('paid QI · actual SQL against disposable PostgreSQL', () => {
  let direct: ReturnType<typeof postgres>
  let guarded: ReturnType<typeof postgres>
  let grant: ReturnType<typeof createPaidQiGrant>
  const input = () => ({ anonId: `synthetic_${randomUUID()}`, qi: 100, reason: 'qi:buy:proof', ref: `proof_${randomUUID()}` })

  beforeAll(async () => {
    checkedTarget()
    direct = postgres(databaseUrl!, { ssl: false, prepare: false, max: 5 })
    await direct.unsafe(`CREATE TABLE IF NOT EXISTS bazi_wallet (
      anon_id text PRIMARY KEY, coins integer NOT NULL DEFAULT 0, xp integer NOT NULL DEFAULT 0,
      qi integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`)
    await direct.unsafe(`CREATE TABLE IF NOT EXISTS bazi_ledger_txn (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), anon_id text NOT NULL,
      coin_delta integer NOT NULL DEFAULT 0, xp_delta integer NOT NULL DEFAULT 0,
      qi_delta integer NOT NULL DEFAULT 0, reason text NOT NULL, ref text,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT proof_ledger_failure CHECK (reason <> 'qi:buy:forced_failure'))`)
    await direct.unsafe(`CREATE TABLE IF NOT EXISTS bazi_qi_claim (
      anon_id text NOT NULL, code text NOT NULL, period_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(anon_id, code, period_key))`)
    guarded = createResilientSql(() => postgres(databaseUrl!, poolOptions(2)),
      { queryTimeoutMs: 1000, transactionTimeoutMs: 4000, log: () => {} })
    grant = createPaidQiGrant(guarded)
  })

  afterAll(async () => {
    await guarded?.end({ timeout: 0 })
    await direct?.end({ timeout: 0 })
  })

  async function facts(anonId: string, ref: string) {
    const wallets = await direct`SELECT qi FROM bazi_wallet WHERE anon_id = ${anonId}`
    const [ledger] = await direct`SELECT count(*)::int AS n FROM bazi_ledger_txn WHERE ref = ${ref}`
    const [bonuses] = await direct`SELECT count(*)::int AS n FROM bazi_ledger_txn WHERE anon_id = ${anonId} AND reason = 'qi:earn:first_buy_bonus'`
    const [claims] = await direct`SELECT count(*)::int AS n FROM bazi_qi_claim WHERE anon_id = ${anonId} AND code = 'first_buy_bonus'`
    return { qi: wallets[0]?.qi ?? 0, wallets: wallets.length, ledger: ledger.n, bonuses: bonuses.n, claims: claims.n }
  }

  it('ten concurrent identical references credit one purchase and one first-buy bonus', async () => {
    const value = input()
    const results = await Promise.all(Array.from({ length: 10 }, () => grant(value)))
    expect(results.filter(result => !result.alreadyGranted)).toHaveLength(1)
    expect(results.filter(result => result.firstBuyBonus)).toHaveLength(1)
    expect(await facts(value.anonId, value.ref)).toEqual({ qi: 130, wallets: 1, ledger: 1, bonuses: 1, claims: 1 })
  })

  it('same charge with changed customer, amount or reason is rejected without another credit', async () => {
    const value = input()
    await grant(value)
    for (const changed of [{ ...value, anonId: 'synthetic_other' }, { ...value, qi: 101 }, { ...value, reason: 'qi:buy:other' }]) {
      await expect(grant(changed)).rejects.toMatchObject({ code: 'GRANT_CONFLICT', status: 409 })
    }
    expect(await facts(value.anonId, value.ref)).toEqual({ qi: 130, wallets: 1, ledger: 1, bonuses: 1, claims: 1 })
    expect((await direct`SELECT anon_id FROM bazi_wallet WHERE anon_id = 'synthetic_other'`).length).toBe(0)
  })

  it('distinct charges for one wallet each credit once but share one first-buy bonus', async () => {
    const value = input()
    const second = { ...value, ref: `proof_${randomUUID()}`, qi: 200 }
    const results = await Promise.all([grant(value), grant(second)])
    expect(results.filter(result => result.firstBuyBonus)).toHaveLength(1)
    expect(await facts(value.anonId, value.ref)).toEqual({ qi: 330, wallets: 1, ledger: 1, bonuses: 1, claims: 1 })
    expect((await facts(value.anonId, second.ref)).ledger).toBe(1)
  })

  it('explicit read-committed transaction overrides a repeatable-read session default', async () => {
    const directUrl = process.env.QI_GRANT_DIRECT_DATABASE_URL ?? databaseUrl!
    const target = new URL(directUrl)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/qi_grant_proof') {
      throw new Error('Isolation proof requires the disposable loopback database')
    }
    const clients = [0, 1].map(() => postgres(directUrl, { ssl: false, prepare: false, max: 1 }))
    try {
      for (const client of clients) {
        await client.unsafe("SET SESSION default_transaction_isolation = 'repeatable read'")
        expect((await client.unsafe('SHOW default_transaction_isolation'))[0].default_transaction_isolation).toBe('repeatable read')
      }
      const value = input()
      const results = await Promise.all(clients.map(client => createPaidQiGrant(client)(value)))
      expect(results.filter(result => !result.alreadyGranted)).toHaveLength(1)
      expect(await facts(value.anonId, value.ref)).toEqual({ qi: 130, wallets: 1, ledger: 1, bonuses: 1, claims: 1 })
    } finally {
      await Promise.all(clients.map(client => client.end({ timeout: 0 })))
    }
  })

  it('ledger rejection rolls back wallet, purchase and first-buy claim together', async () => {
    const value = { ...input(), reason: 'qi:buy:forced_failure' }
    await expect(grant(value)).rejects.toMatchObject({ code: '23514' })
    expect(await facts(value.anonId, value.ref)).toEqual({ qi: 0, wallets: 0, ledger: 0, bonuses: 0, claims: 0 })
    await grant({ ...value, reason: 'qi:buy:proof' })
    expect(await facts(value.anonId, value.ref)).toEqual({ qi: 130, wallets: 1, ledger: 1, bonuses: 1, claims: 1 })
  })

  it('duplicate historical ledger rows refuse another credit without rewriting history', async () => {
    const value = input()
    await direct`INSERT INTO bazi_wallet (anon_id, qi) VALUES (${value.anonId}, 200)`
    for (let i = 0; i < 2; i++) {
      await direct`INSERT INTO bazi_ledger_txn (anon_id, qi_delta, reason, ref) VALUES (${value.anonId}, ${value.qi}, ${value.reason}, ${value.ref})`
    }
    await expect(grant(value)).rejects.toMatchObject({ code: 'GRANT_CONFLICT', status: 409 })
    expect(await facts(value.anonId, value.ref)).toEqual({ qi: 200, wallets: 1, ledger: 2, bonuses: 0, claims: 0 })
  })

  it('historical purchase without a wallet requires review rather than automatic re-credit', async () => {
    const value = input()
    await direct`INSERT INTO bazi_ledger_txn (anon_id, qi_delta, reason, ref) VALUES (${value.anonId}, ${value.qi}, ${value.reason}, ${value.ref})`
    await expect(grant(value)).rejects.toMatchObject({ code: 'GRANT_HISTORY_INCONSISTENT', status: 409 })
    expect(await facts(value.anonId, value.ref)).toEqual({ qi: 0, wallets: 0, ledger: 1, bonuses: 0, claims: 0 })
  })

  it('legacy bonus claim without a bonus ledger never awards another bonus', async () => {
    const value = input()
    await direct`INSERT INTO bazi_qi_claim (anon_id, code, period_key) VALUES (${value.anonId}, 'first_buy_bonus', 'all')`
    expect(await grant(value)).toMatchObject({ alreadyGranted: false, firstBuyBonus: false, grantedQi: 100, qi: 100 })
    expect(await facts(value.anonId, value.ref)).toEqual({ qi: 100, wallets: 1, ledger: 1, bonuses: 0, claims: 1 })
  })

  it('lost COMMIT acknowledgement is unknown; explicit same-ref retry credits nothing twice', async () => {
    const value = input()
    const target = checkedTarget()
    const proxy = commitReplyProxy(target)
    target.port = String(await proxy.listen())
    const faulted = createResilientSql(() => postgres(target.toString(), poolOptions(1)),
      { queryTimeoutMs: 200, transactionTimeoutMs: 700, log: () => {} })
    try {
      await faulted.unsafe('SELECT 1')
      proxy.loseCommit()
      await expect(createPaidQiGrant(faulted)(value)).rejects.toMatchObject({ code: 'DB_STALL', outcome: 'unknown' })
      expect(proxy.commits()).toBe(1)
      expect(await facts(value.anonId, value.ref)).toEqual({ qi: 130, wallets: 1, ledger: 1, bonuses: 1, claims: 1 })
      expect(await grant(value)).toMatchObject({ alreadyGranted: true, firstBuyBonus: false, grantedQi: 0, qi: 130 })
      expect(await facts(value.anonId, value.ref)).toEqual({ qi: 130, wallets: 1, ledger: 1, bonuses: 1, claims: 1 })
    } finally {
      await faulted.end({ timeout: 0 })
      proxy.close()
    }
  })

  it('a timed-out advisory-lock wait cannot continue into a late wallet mutation', async () => {
    const value = input()
    let unlock!: () => void
    let announce!: () => void
    const held = new Promise<void>(resolve => { announce = resolve })
    const release = new Promise<void>(resolve => { unlock = resolve })
    const blocker = direct.begin(async tx => {
      await tx.unsafe("SELECT pg_advisory_xact_lock(hashtextextended('mumate:paid-qi:' || $1, 0))", [value.ref])
      announce()
      await release
    })
    await held
    const impatient = createResilientSql(() => postgres(databaseUrl!, poolOptions(1)),
      { queryTimeoutMs: 150, transactionTimeoutMs: 500, log: () => {} })
    try {
      await expect(createPaidQiGrant(impatient)(value)).rejects.toMatchObject({ code: 'DB_STALL' })
    } finally {
      unlock()
      await blocker
      await impatient.end({ timeout: 0 })
    }
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(await facts(value.anonId, value.ref)).toEqual({ qi: 0, wallets: 0, ledger: 0, bonuses: 0, claims: 0 })
    await grant(value)
    expect(await facts(value.anonId, value.ref)).toEqual({ qi: 130, wallets: 1, ledger: 1, bonuses: 1, claims: 1 })
  })
})
