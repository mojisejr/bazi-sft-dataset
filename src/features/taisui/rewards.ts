// ปีชง 2570 — the red-packet gift and the wish-lantern count (plan revision 0.8 of
// mumate-taisui-2570-001). Both use the existing bazi_qi_claim table, so no migration is needed:
//   code "taisui_packet",  period_key = the sender's anon id  → once per receiver per sender
//   code "taisui_lantern", period_key = "2570"                 → one lantern per member
import { randomInt } from "node:crypto";

import { and, count, eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziQiClaim, baziReferralCode } from "@/db/schema";
import { applyLedger } from "@/lib/bazi/manifest/ledger";

export const PACKET_CODE = "taisui_packet";
export const LANTERN_CODE = "taisui_lantern";
export const LANTERN_PERIOD = "2570";

/** Owner, revision 0.8: "จำนวนชี่ ต้อง vary ไม่เกิน 5 - 10". */
export const PACKET_QI_MIN = 5;
export const PACKET_QI_MAX = 10;
/** Caps against pumping (the agent's numbers, revision 0.7 asked for limits). */
export const PACKET_MAX_PER_RECEIVER_PER_DAY = 3;
export const PACKET_MAX_PER_SENDER_PER_DAY = 20;

export type PacketResult =
  | { paid: true; qi: number }
  | { paid: false; reason: "unknown_code" | "own_packet" | "already_opened" | "receiver_daily_cap" | "sender_daily_cap" };

type Db = ReturnType<typeof createDbClient>;

// Claims made since 00:00 Thai time today.
const sinceThaiMidnight = sql`${baziQiClaim.createdAt} >= (date_trunc('day', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok')`;

export function drawPacketQi(draw: (min: number, maxExclusive: number) => number = randomInt): number {
  return draw(PACKET_QI_MIN, PACKET_QI_MAX + 1);
}

export async function openPacket(receiverAnonId: string, senderCode: string, db: Db = createDbClient()): Promise<PacketResult> {
  const sender = await db
    .select({ anonId: baziReferralCode.anonId })
    .from(baziReferralCode)
    .where(eq(baziReferralCode.code, senderCode))
    .limit(1);
  const senderAnonId = sender[0]?.anonId;
  if (!senderAnonId) return { paid: false, reason: "unknown_code" };
  if (senderAnonId === receiverAnonId) return { paid: false, reason: "own_packet" };

  const [mine] = await db
    .select({ n: count() })
    .from(baziQiClaim)
    .where(and(eq(baziQiClaim.anonId, receiverAnonId), eq(baziQiClaim.code, PACKET_CODE), sinceThaiMidnight));
  if ((mine?.n ?? 0) >= PACKET_MAX_PER_RECEIVER_PER_DAY) return { paid: false, reason: "receiver_daily_cap" };

  const [theirs] = await db
    .select({ n: count() })
    .from(baziQiClaim)
    .where(and(eq(baziQiClaim.periodKey, senderAnonId), eq(baziQiClaim.code, PACKET_CODE), sinceThaiMidnight));
  if ((theirs?.n ?? 0) >= PACKET_MAX_PER_SENDER_PER_DAY) return { paid: false, reason: "sender_daily_cap" };

  // The claim row is the once-per-pair lock: a second open of the same sender's packet inserts nothing.
  const claimed = await db
    .insert(baziQiClaim)
    .values({ anonId: receiverAnonId, code: PACKET_CODE, periodKey: senderAnonId })
    .onConflictDoNothing()
    .returning({ code: baziQiClaim.code });
  if (!claimed.length) return { paid: false, reason: "already_opened" };

  const qi = drawPacketQi();
  const balance = await applyLedger({ anonId: receiverAnonId, qiDelta: qi, reason: `qi:earn:${PACKET_CODE}`, ref: senderAnonId });
  if (!balance) {
    // Give the pair its chance back rather than leave a claim with no payment.
    await db
      .delete(baziQiClaim)
      .where(and(eq(baziQiClaim.anonId, receiverAnonId), eq(baziQiClaim.code, PACKET_CODE), eq(baziQiClaim.periodKey, senderAnonId)));
    throw new Error("ledger_write_failed");
  }
  return { paid: true, qi };
}

export async function lanternCount(db: Db = createDbClient()): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(baziQiClaim)
    .where(and(eq(baziQiClaim.code, LANTERN_CODE), eq(baziQiClaim.periodKey, LANTERN_PERIOD)));
  return row?.n ?? 0;
}

export async function releaseLantern(anonId: string, db: Db = createDbClient()): Promise<{ released: boolean; count: number }> {
  const inserted = await db
    .insert(baziQiClaim)
    .values({ anonId, code: LANTERN_CODE, periodKey: LANTERN_PERIOD })
    .onConflictDoNothing()
    .returning({ code: baziQiClaim.code });
  return { released: inserted.length > 0, count: await lanternCount(db) };
}
