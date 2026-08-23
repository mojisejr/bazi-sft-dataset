/**
 * Coin/XP ledger ops — ใช้ร่วมทุกฟีเจอร์แต้ม (Manifest/Mission/Karma/Referral).
 * wallet = cache ยอด, bazi_ledger_txn = ความจริง append-only.
 * ⚠️ neon-http ไม่มี transaction ข้าม statement — ยอมรับ race เล็กน้อยในเฟสนี้
 *   (กันติดลบด้วย conditional UPDATE ที่เช็คยอดใน statement เดียว).
 */

import { and, eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziLedgerTxn, baziWallet } from "@/db/schema";

/** Level จาก XP สะสม — ตรงจอ Figma (Level 3 · 2340/3000): เลเวลละ 1000 XP */
export function levelOfXp(xp: number): { level: number; nextLevelXp: number; levelStartXp: number } {
  const level = Math.floor(xp / 1000) + 1;
  return { level, nextLevelXp: level * 1000, levelStartXp: (level - 1) * 1000 };
}

export type LedgerApplyInput = {
  anonId: string;
  coinDelta?: number;
  xpDelta?: number;
  /** แต้ม Qi (ระบบกิจกรรม) — บวก=ได้ ลบ=ใช้; กันติดลบเหมือน coins/xp */
  qiDelta?: number;
  reason: string;
  ref?: string | null;
};

export type WalletBalance = { coins: number; xp: number; qi: number };

/**
 * บันทึกธุรกรรมแต้ม + อัปเดตยอด. คืนยอดใหม่ หรือ null ถ้ายอดไม่พอ (กันติดลบ ทั้ง coins/xp/qi).
 */
export async function applyLedger(input: LedgerApplyInput): Promise<WalletBalance | null> {
  const db = createDbClient();
  const coinDelta = input.coinDelta ?? 0;
  const xpDelta = input.xpDelta ?? 0;
  const qiDelta = input.qiDelta ?? 0;

  // มีแถว wallet เสมอ (แถวแรก = 0/0/0)
  await db.insert(baziWallet).values({ anonId: input.anonId }).onConflictDoNothing();

  // อัปเดตแบบมีเงื่อนไขใน statement เดียว — ยอดใหม่ต้องไม่ติดลบ
  const updated = await db
    .update(baziWallet)
    .set({
      coins: sql`${baziWallet.coins} + ${coinDelta}`,
      xp: sql`${baziWallet.xp} + ${xpDelta}`,
      qi: sql`${baziWallet.qi} + ${qiDelta}`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(baziWallet.anonId, input.anonId),
        sql`${baziWallet.coins} + ${coinDelta} >= 0`,
        sql`${baziWallet.xp} + ${xpDelta} >= 0`,
        sql`${baziWallet.qi} + ${qiDelta} >= 0`,
      ),
    )
    .returning({ coins: baziWallet.coins, xp: baziWallet.xp, qi: baziWallet.qi });

  if (!updated.length) return null;

  await db.insert(baziLedgerTxn).values({
    anonId: input.anonId,
    coinDelta,
    xpDelta,
    qiDelta,
    reason: input.reason,
    ref: input.ref ?? null,
  });

  return updated[0];
}

export async function getWallet(anonId: string): Promise<WalletBalance> {
  const db = createDbClient();
  const rows = await db.select().from(baziWallet).where(eq(baziWallet.anonId, anonId)).limit(1);
  return rows[0]
    ? { coins: rows[0].coins, xp: rows[0].xp, qi: rows[0].qi }
    : { coins: 0, xp: 0, qi: 0 };
}
