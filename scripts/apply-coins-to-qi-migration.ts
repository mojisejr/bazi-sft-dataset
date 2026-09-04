/**
 * Data migration: fold every user's `coins` balance into `qi` (unify coins→qi ทั้งแอป).
 *   1) แถวชดเชยใน ledger ต่อ user ที่มี coins>0  (qi_delta=+coins, coin_delta=-coins, reason='coins:migrate:qi')
 *   2) อัปเดต cache: qi += coins, coins = 0
 * idempotent + crash-safe: statement 1 มี NOT EXISTS กันแถวชดเชยซ้ำ; รันซ้ำหลังสำเร็จ = no-op (coins=0 หมด).
 * ⚠️ รันครั้งเดียวหลัง deploy โค้ดที่หยุดจ่าย coins (mission/badge/journal เป็น qi แล้ว). referral ยังจ่าย coins
 *    อยู่จนกว่างาน referral-parity จะแก้เป็น 50/30 QI — อย่ารันซ้ำหลังจากนั้นถ้ายังมี coins ใหม่เข้ามา.
 * Usage: node --env-file=.env --import tsx scripts/apply-coins-to-qi-migration.ts
 */
import { createDbSqlClient } from "../src/db/client";

async function rows<T = Record<string, unknown>>(result: unknown): Promise<T[]> {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as T[];
}

async function main() {
  const sql = createDbSqlClient();

  const before = await rows<{ n: number; total: number | null }>(
    await sql.unsafe("select count(*)::int as n, coalesce(sum(coins),0)::int as total from bazi_wallet where coins > 0;"),
  );
  console.log(`BEFORE: ${before[0]?.n ?? 0} wallets with coins>0, total ${before[0]?.total ?? 0} coins`);

  // 1) แถวชดเชย (อ่าน coins ก่อน zero) — NOT EXISTS กันซ้ำเวลารันซ้ำ/crash
  await sql.unsafe(`
    insert into bazi_ledger_txn (anon_id, coin_delta, xp_delta, qi_delta, reason)
    select w.anon_id, -w.coins, 0, w.coins, 'coins:migrate:qi'
    from bazi_wallet w
    where w.coins > 0
      and not exists (
        select 1 from bazi_ledger_txn t
        where t.anon_id = w.anon_id and t.reason = 'coins:migrate:qi'
      );
  `);

  // 2) พับยอดเข้าสู่ qi แล้ว zero coins (cache)
  await sql.unsafe("update bazi_wallet set qi = qi + coins, coins = 0, updated_at = now() where coins > 0;");

  const after = await rows<{ n: number }>(
    await sql.unsafe("select count(*)::int as n from bazi_wallet where coins > 0;"),
  );
  const migrated = await rows<{ n: number }>(
    await sql.unsafe("select count(*)::int as n from bazi_ledger_txn where reason = 'coins:migrate:qi';"),
  );
  console.log(`AFTER: ${after[0]?.n ?? 0} wallets still with coins>0 (expect 0), ${migrated[0]?.n ?? 0} compensating ledger rows`);
  if ((after[0]?.n ?? 0) !== 0) throw new Error("coins not fully migrated — investigate");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION FAILED:", e);
    process.exit(1);
  });
