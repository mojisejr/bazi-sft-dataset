import type postgres from "postgres";

import { QI_EARN_BY_CODE } from "@/lib/bazi/qi/catalog";

type Sql = ReturnType<typeof postgres>;
export type PaidQiGrantInput = { anonId: string; qi: number; reason: string; ref: string };
export type PaidQiGrantResult = {
  alreadyGranted: boolean;
  firstBuyBonus: boolean;
  grantedQi: number;
  coins: number;
  xp: number;
  qi: number;
};

export class PaidQiGrantError extends Error {
  constructor(readonly code: string, message: string, readonly status = 409) {
    super(message);
    this.name = "PaidQiGrantError";
  }
}

/**
 * The charge reference is global, not (reason, ref): a changed user/package must
 * not turn a retry into a second purchase. Every paid writer takes the same
 * transaction advisory lock before consulting the existing append-only ledger.
 * No callback or statement is retried here. A lost COMMIT reply is resolved by
 * a later request with the SAME reference and payload, under this same lock.
 */
export function createPaidQiGrant(client: Sql) {
  return async function grant(input: PaidQiGrantInput): Promise<PaidQiGrantResult> {
    if (!input.anonId || input.anonId.length > 128 || !input.ref || input.ref.length > 200 ||
        !Number.isInteger(input.qi) || input.qi < 1 || input.qi > 100_000 ||
        !input.reason.startsWith("qi:buy:") || input.reason.length > 71) {
      throw new PaidQiGrantError("INVALID_GRANT", "Invalid paid QI grant payload.", 400);
    }
    const bonusQi = QI_EARN_BY_CODE.get("first_buy_bonus")?.qi;
    if (!Number.isInteger(bonusQi) || !bonusQi || bonusQi < 0) {
      throw new PaidQiGrantError("INVALID_BONUS_CONFIG", "Paid QI bonus is unavailable.", 500);
    }

    // The history SELECT must see the winner's commit after waiting for its lock.
    // Repeatable-read would keep a snapshot taken before that wait and is unsafe
    // for this advisory-lock fence; do not inherit a database/session default.
    return client.begin("isolation level read committed", async tx => {
      // LOCAL settings stay within this transaction even through a pooler. The
      // client guard also bounds acquisition and silent sockets, which SQL cannot.
      await tx.unsafe("SET LOCAL lock_timeout = '3s'");
      await tx.unsafe("SET LOCAL statement_timeout = '4s'");
      await tx.unsafe(
        "SELECT pg_advisory_xact_lock(hashtextextended('mumate:paid-qi:' || $1, 0))",
        [input.ref],
      );
      const history = await tx.unsafe(
        "SELECT anon_id, qi_delta, coin_delta, xp_delta, reason FROM bazi_ledger_txn WHERE ref = $1 AND reason LIKE 'qi:buy:%'",
        [input.ref],
      );
      if (history.length) {
        const row = history[0];
        if (history.length !== 1 || row.anon_id !== input.anonId || Number(row.qi_delta) !== input.qi ||
            Number(row.coin_delta) !== 0 || Number(row.xp_delta) !== 0 || row.reason !== input.reason) {
          throw new PaidQiGrantError("GRANT_CONFLICT", "Charge reference has conflicting grant history.");
        }
        const wallet = await tx.unsafe("SELECT coins, xp, qi FROM bazi_wallet WHERE anon_id = $1", [input.anonId]);
        if (wallet.length !== 1) {
          throw new PaidQiGrantError("GRANT_HISTORY_INCONSISTENT", "Recorded grant has no wallet; review is required.");
        }
        // Historical grants are evidence, not an invitation to repair/re-credit.
        return { alreadyGranted: true, firstBuyBonus: false, grantedQi: 0,
          coins: Number(wallet[0].coins), xp: Number(wallet[0].xp), qi: Number(wallet[0].qi) };
      }

      await tx.unsafe("INSERT INTO bazi_wallet (anon_id) VALUES ($1) ON CONFLICT (anon_id) DO NOTHING", [input.anonId]);
      // Different charges for the same customer serialize before claiming the
      // once-per-lifetime bonus; ordinary wallet writers use this same row lock.
      await tx.unsafe("SELECT anon_id FROM bazi_wallet WHERE anon_id = $1 FOR UPDATE", [input.anonId]);
      const bonusHistory = await tx.unsafe(
        "SELECT id FROM bazi_ledger_txn WHERE anon_id = $1 AND reason = 'qi:earn:first_buy_bonus' LIMIT 1",
        [input.anonId],
      );
      const claim = await tx.unsafe(
        "INSERT INTO bazi_qi_claim (anon_id, code, period_key) VALUES ($1, 'first_buy_bonus', 'all') ON CONFLICT DO NOTHING RETURNING code",
        [input.anonId],
      );
      // A legacy claim without a ledger or a legacy ledger without a claim is not
      // repaired by paying again. Newly created bonus claim/credit/ledger commit
      // together; the historical ledger also prevents duplicate legacy bonuses.
      const firstBuyBonus = claim.length === 1 && bonusHistory.length === 0;
      const total = input.qi + (firstBuyBonus ? bonusQi : 0);
      const wallet = await tx.unsafe(
        "UPDATE bazi_wallet SET qi = qi + $2, updated_at = now() WHERE anon_id = $1 RETURNING coins, xp, qi",
        [input.anonId, total],
      );
      if (wallet.length !== 1) throw new PaidQiGrantError("WALLET_UNAVAILABLE", "Paid QI wallet is unavailable.", 500);
      await tx.unsafe(
        "INSERT INTO bazi_ledger_txn (anon_id, coin_delta, xp_delta, qi_delta, reason, ref) VALUES ($1, 0, 0, $2, $3, $4)",
        [input.anonId, input.qi, input.reason, input.ref],
      );
      if (firstBuyBonus) {
        await tx.unsafe(
          "INSERT INTO bazi_ledger_txn (anon_id, coin_delta, xp_delta, qi_delta, reason, ref) VALUES ($1, 0, 0, $2, 'qi:earn:first_buy_bonus', NULL)",
          [input.anonId, bonusQi],
        );
      }
      return { alreadyGranted: false, firstBuyBonus, grantedQi: input.qi,
        coins: Number(wallet[0].coins), xp: Number(wallet[0].xp), qi: Number(wallet[0].qi) };
    });
  };
}
