# Coins → Qi Unification (retire `coins`, fold into `qi`)

Scope: engine repo `bazi-sft-dataset`. Product decision — every per-user balance becomes **Qi**.
Mission (and other) rewards must credit the **qi** balance/ledger instead of `coins`; existing
`coins` balances migrate into `qi`; `coins` is retired.

This doc is the concrete change plan. All line references verified against current code.

---

## 1. Data model (verified)

The wallet is **column-based** (a cache); the ledger is the append-only truth. `qi` is **not** a
separate ledger table — it shares `bazi_ledger_txn` with `coins`/`xp`, distinguished by a nonzero
`qi_delta` and a `qi:*` reason prefix.

`src/db/schema.ts:978` — `bazi_wallet` (one row per `anonId`, cache of balances):
```ts
export const baziWallet = pgTable("bazi_wallet", {
  anonId: text("anon_id").primaryKey(),
  coins: integer("coins").notNull().default(0),
  xp: integer("xp").notNull().default(0),
  qi: integer("qi").notNull().default(0),   // added in 0038
  updatedAt: ...
});
```

`src/db/schema.ts:990` — `bazi_ledger_txn` (append-only truth):
```ts
export const baziLedgerTxn = pgTable("bazi_ledger_txn", {
  id, anonId,
  coinDelta: integer("coin_delta").notNull().default(0),
  xpDelta:   integer("xp_delta").notNull().default(0),
  qiDelta:   integer("qi_delta").notNull().default(0),   // added in 0038
  reason: text("reason").notNull(),   // e.g. mission:<id>, qi:earn:<code>
  ref:    text("ref"),
  createdAt, ...
});
```

Migration history: `drizzle/0033_manifest_ledger.sql` created `bazi_wallet(coins,xp)` +
`bazi_ledger_txn(coin_delta,xp_delta)`. `drizzle/0038_qi_point_system.sql` added
`bazi_wallet.qi` + `bazi_ledger_txn.qi_delta` (both `NOT NULL DEFAULT 0`, additive/idempotent).

So: **`coins`, `xp`, `qi` are each a wallet column + a ledger delta.** None is a distinct table.

Central ops in `src/lib/bazi/manifest/ledger.ts`:
- `applyLedger({anonId, coinDelta?, xpDelta?, qiDelta?, reason, ref?})` — one conditional UPDATE
  that bumps all three balances and rejects if any would go negative, then inserts one ledger row.
  Returns `{coins, xp, qi}` or `null` (insufficient).
- `getWallet(anonId)` → `{coins, xp, qi}`.
- `WalletBalance = { coins; xp; qi }`.

## 2. Where `coins` is written / read (verified via grep)

**Writers — all go through `applyLedger({ coinDelta })`:**

| Route / lib | Line | coinDelta | reason |
|---|---|---|---|
| `src/app/api/missions/route.ts` | 98–104 | `def.rewardCoins` | `mission:<id>` |
| `src/app/api/achievements/route.ts` | 66–71 | `badge.rewardCoins` | `badge:<id>` |
| `src/app/api/referral/route.ts` | 154–167 | `250` inviter / `100` referee | `referral:inviter` / `referral:referee` |
| `src/app/api/manifest/entry/route.ts` | 43–50 | `10` | `daily_journal` |
| `src/app/api/wallet/route.ts` (POST) | 49–61 | arbitrary from client body | client-supplied `reason` |

Reward magnitudes live in code:
- `src/lib/bazi/manifest/missions.ts` — `MissionDef.rewardCoins` (50/120/30/500) + `rewardXp`.
- `src/lib/bazi/manifest/achievements.ts` — `BADGE_DEFS[].rewardCoins`.
- `src/app/api/referral/route.ts:20-21` — `REWARD_REFERRER.coins=250`, `REWARD_REFEREE.coins=100`.
- `src/app/api/manifest/entry/route.ts:18` — `DAILY_REWARD.coins=10`.

**Readers / responders (return a `coins` field):**
- `getWallet` (ledger.ts:76) → spread into responses of `/api/wallet`, `/api/qi/wallet`,
  `/api/karma` (`wallet.coins`), `/api/achievements` (`wallet.coins`).
- `/api/qi/wallet/route.ts:11,37` — returns `{ qi, coins, xp, level, history }`. History is
  **qi-only** (`where qiDelta != 0`), so redirected rewards show up here automatically.
- `/api/wallet/route.ts` GET — returns `coins` + full ledger history (all deltas).
- `src/app/mvp/page.tsx` (engine-internal demo UI) — displays `coins`, `coinDelta`, `rewardCoins`.

**How the reward currency is chosen today:** hard-coded — each writer passes `coinDelta:
<rewardCoins>`. There is no currency switch; missions/badges/referral/journal simply always credit
coins. `qi` is only ever credited by the qi engine (`src/lib/bazi/qi/engine.ts`) and
`/api/qi/grant`.

## 3. The qi ledger contract (how a qi credit is written)

A qi credit is `applyLedger({ anonId, qiDelta: +N, reason, ref })`. Existing reason codes:
- `qi:earn:<code>` — `earnQi()` (`engine.ts:71`), gated by `bazi_qi_claim` per-period.
- `qi:spend:<code>` / `qi:refund:<code>` — `spendQi()` (`engine.ts:89,101`).
- `qi:buy:<reason>` — `/api/qi/grant` (money purchases), idempotent on `(reason, ref=charge_id)`.

**Does a `mission:<id>` qi row exist today? No.** `mission:<id>` rows exist but carry
`coin_delta`, not `qi_delta`. Redirecting missions to qi means emitting
`applyLedger({ qiDelta: reward, reason: 'mission:<id>' })` — same reason string, currency flipped.
Because `/api/qi/wallet` filters `qiDelta != 0`, these rows then appear in the qi history with no
extra work. The FE `Wallet` model already documents `mission:<id>` as a valid qi reason
(`mootech-fe/features/v2-qi/qi-model.ts:7`).

## 4. Migration — fold existing `coins` into `qi` (idempotent)

Wallet is a cache, ledger is truth, so the migration must touch **both**: append a compensating
ledger row and zero the wallet `coins` (adding to `qi`). Keep the `coins` **column** for now (zero
it, don't drop) so responses/FE keep working during transition.

New file `drizzle/0043_coins_to_qi.sql` (numbering follows the existing `00NN_phase_*` convention;
next free index in `drizzle/meta/_journal.json` is idx 5 but the repo numbers files by filename, and
0042 is the highest existing file):

```sql
-- Fold each user's coins balance into qi. Idempotent: re-runs are no-ops.
-- 1) one compensating ledger row per user with coins>0 not already migrated
INSERT INTO "bazi_ledger_txn" ("anon_id","qi_delta","coin_delta","reason")
SELECT w."anon_id", w."coins", -w."coins", 'coins:migrate:qi'
FROM "bazi_wallet" w
WHERE w."coins" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "bazi_ledger_txn" t
    WHERE t."anon_id" = w."anon_id" AND t."reason" = 'coins:migrate:qi'
  );
--> statement-breakpoint
-- 2) move the cached balance: qi += coins, coins = 0
UPDATE "bazi_wallet"
SET "qi" = "qi" + "coins", "coins" = 0, "updated_at" = now()
WHERE "coins" > 0;
```

Idempotency: step 1 is guarded by `NOT EXISTS (… 'coins:migrate:qi')`; step 2 filters `coins > 0`
and sets `coins = 0`, so a second run inserts nothing and updates nothing. Ledger stays balanced
(`qi_delta = +coins`, `coin_delta = -coins`) so the append-only history reconciles with the new
wallet totals.

**Apply script** `scripts/apply-coins-to-qi-migration.ts` — copy
`scripts/apply-qi-point-system-migration.ts` verbatim, change `sqlPath` to
`drizzle/0043_coins_to_qi.sql` and drop the column-count verification loop (or verify
`sum(coins)=0`). It splits on `--> statement-breakpoint` and swallows duplicate-object codes; the
guards above make it safe regardless. Add a `db:apply:coins-to-qi` script entry mirroring
`db:apply:qi-point-system`. NOTE: this repo forbids `drizzle-kit push` (`scripts/forbid-db-push.ts`)
and applies migrations via bespoke `apply-*.ts` scripts, so do **not** rely on `drizzle-kit migrate`.

**Ordering vs code deploy:** deploy the code change (writers emit `qiDelta`) **before or with** the
migration. If the migration runs while writers still emit `coinDelta`, coins re-accumulates after
zeroing. Run migration once after the writer switch is live.

## 5. Code changes — redirect writers from coins → qi

Minimal, backward-compatible path (keeps FE contract intact — see §6). Change only the ledger
**currency**, not the public field names, in phase A.

- **`src/app/api/missions/route.ts:98`** — change `coinDelta: def.rewardCoins` →
  `qiDelta: def.rewardCoins`. Reason stays `mission:${def.id}`. (Leaves `MissionDef.rewardCoins`
  field name untouched so the GET response `...def` and FE `MissionsScreen` keep working.)
- **`src/app/api/achievements/route.ts:68`** — `coinDelta: badge.rewardCoins` →
  `qiDelta: badge.rewardCoins`.
- **`src/app/api/referral/route.ts:156,163`** — `coinDelta:` → `qiDelta:` for both inviter/referee.
  (Note: referral inviter **also** already earns `referral_free` +50 qi at line 170 via `earnQi`.
  Decide whether the 250/100 coin reward should survive as qi or be dropped to avoid double qi
  credit for inviters — see Risks.)
- **`src/app/api/manifest/entry/route.ts:45`** — `coinDelta: DAILY_REWARD.coins` →
  `qiDelta: DAILY_REWARD.coins`.
- **`src/app/api/wallet/route.ts` (POST)** — generic client-driven coin earn/spend. Options:
  (a) map `coinDelta` in the request to `qiDelta` internally and keep the endpoint, or
  (b) deprecate it in favour of `/api/qi/earn`+`/api/qi/spend`. Confirm no live FE caller before
  removing (FE proxies only `/api/qi/*` and `/api/missions`/`/api/referral`; `/api/wallet` appears
  to serve the engine `mvp` demo page only). Recommendation: leave GET, and either map or 410 the
  POST.

`applyLedger` and the schema need **no change** — `qiDelta` and the `qi` column already exist and
`applyLedger` already updates all three balances atomically with a non-negative guard.

Optional phase B (cosmetic, coordinated FE+engine): rename `rewardCoins` → `rewardQi` in
`missions.ts` / `achievements.ts` and update FE copy ("เหรียญ" → "ชี่"). Not required for
correctness; do it only with a matched FE change (§6).

## 6. Blast radius on responses / keeping FE working

FE `Wallet` type is `mootech-fe/features/v2-qi/qi-model.ts:16` — `coins?: number` (**optional**).
FE reads it in:
- `features/v2-qi/components/QiScreen.tsx:152` — `เหรียญ {wallet?.coins ?? 0}`
- `features/v2-account/components/AccountScreen.tsx:107` — `{(qiWallet.coins ?? 0)…}`
- `features/v2-qi/components/MissionsScreen.tsx:36` — `+{m.rewardCoins} เหรียญ` (reads the mission
  def's `rewardCoins`, **not** wallet.coins).
- FE tests hard-code `coins: 0` in wallet fixtures (`scripts/qi-checkin-screen.test.tsx`,
  `account-screen-mount.test.tsx`, `edit-birth-screen.test.tsx`) and `rewardCoins` in
  `scripts/missions-screen.test.tsx` (asserts `+500 เหรียญ`).

**Keep-alive strategy during transition:**
- **Do NOT drop the `coins` field** from `getWallet`/responses yet. After migration it is simply
  always `0` (column zeroed, no writer credits it). `coins?` optional + `?? 0` means FE renders
  "เหรียญ 0" harmlessly.
- **Do NOT rename `rewardCoins`** in the mission/badge defs in phase A. The GET `...def` spread keeps
  feeding FE `MissionsScreen` and its test. The label still says "เหรียญ" but the credited balance
  is now qi — an acceptable transient. Fix the label in the coordinated phase B.
- Net: phase-A engine change is **response-shape compatible**; no FE deploy required to avoid
  breakage. FE copy ("เหรียญ" → "ชี่") and eventual `coins` removal are follow-ups.

## 7. Tests that must stay green

Engine:
- `tests/qi-engine.test.ts` — the only engine test touching the qi/ledger path. Mocks `applyLedger`
  to return `{coins:0, xp:0, qi}`; asserts earn caps, spend 409, refund. Unaffected by the writer
  changes (it tests `engine.ts`, which is untouched). Stays green.
- `tests/schema.test.ts` — check it does not assert wallet column shape after any later column drop
  (no drop in this plan, so safe).
- There is **no** engine route test for `/api/missions`, `/api/wallet`, `/api/achievements`,
  `/api/referral`, or `/api/manifest/entry` — the currency flip has no engine test to update.

FE (`mootech-fe`, for the coordinated phase B / to not break now):
- `scripts/missions-screen.test.tsx` — asserts `+500 เหรียญ` from `rewardCoins`. Stays green in
  phase A (field unchanged); update when renaming to `rewardQi` / changing copy.
- `scripts/qi-screen.test.tsx`, `qi-history-screen.test.tsx`, `qi-checkin-screen.test.tsx`,
  `account-screen*.test.tsx`, `edit-birth-screen.test.tsx` — wallet fixtures include `coins`;
  all still pass with `coins: 0`.

## 8. Ordered steps

1. **Code (engine):** flip `coinDelta` → `qiDelta` in the 4 reward routes (§5), decide
   `/api/wallet` POST fate. Keep `rewardCoins` field names and the `coins` response field.
2. **Migration files:** add `drizzle/0043_coins_to_qi.sql` (§4) + `scripts/apply-coins-to-qi-migration.ts`
   + `db:apply:coins-to-qi` package script.
3. **Deploy** step-1 code first (writers stop crediting coins).
4. **Run migration** once (`node --env-file=.env --import tsx scripts/apply-coins-to-qi-migration.ts`).
   Idempotent — safe to re-run.
5. **Verify:** `select coalesce(sum(coins),0) from bazi_wallet` = 0; qi history in `/api/qi/wallet`
   now shows `mission:*` / `badge:*` / `referral:*` / `daily_journal` rows.
6. **Follow-ups (phase B, optional/coordinated):** rename `rewardCoins`→`rewardQi`, FE copy
   "เหรียญ"→"ชี่", then a later migration to `DROP COLUMN coins` / drop `coin_delta` once nothing
   reads them.

## 9. Risks

- **Double-credit (referral):** inviter currently gets both `referral:inviter` (250) coins **and**
  `qi:earn:referral_free` (+50 qi, `engine.ts` via `earnQi`). Flipping the 250 to qi makes the
  inviter net +300 qi per invite. Confirm intended reward before flipping, or drop the 250 line.
- **Re-accumulation:** if the migration runs before the writer switch is deployed, coins refill
  after zeroing. Enforce ordering (step 3 before step 4).
- **Idempotency:** guaranteed by the `NOT EXISTS('coins:migrate:qi')` guard + `coins > 0` filter +
  `coins = 0` write. Do not remove either clause.
- **Non-atomic writes (neon-http):** `applyLedger` already tolerates this (single conditional
  UPDATE + separate insert). The migration's two statements are individually idempotent, so a crash
  between them is recoverable by re-running.
- **`/api/wallet` POST is an open coin faucet:** it accepts arbitrary client `coinDelta`. If left
  writing `coinDelta`, it reintroduces coins post-migration. Must be mapped to qi or disabled.
- **Column not dropped:** intentional (keeps FE optional `coins?` happy). Dropping it is a separate,
  later migration after FE stops reading it — don't fold it into this change.
```
