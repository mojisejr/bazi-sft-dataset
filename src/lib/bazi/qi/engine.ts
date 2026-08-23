/**
 * Qi Point System — engine (earn/spend)
 * earn: เช็คเพดานผ่าน bazi_qi_claim (กันซ้ำต่อรอบ) → applyLedger(+qi)
 * spend: applyLedger(-qi) → grant สิทธิ์ → ถ้า grant ล้ม refund คืนแต้ม (auto-refund ตาม doc)
 */

import { createDbClient } from "@/db/client";
import { baziQiClaim } from "@/db/schema";
import { todayBangkok } from "@/lib/bazi/manifest/dates";
import { applyLedger, getWallet, type WalletBalance } from "@/lib/bazi/manifest/ledger";
import {
  QI_EARN_BY_CODE,
  QI_SPEND_BY_CODE,
  type EntitlementGrant,
  type QiEarnLine,
} from "@/lib/bazi/qi/catalog";
import { grantEntitlement } from "@/lib/bazi/qi/entitlements";

export class QiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "QiError";
  }
}

function periodKeyOf(line: QiEarnLine, ref?: string | null): string {
  switch (line.limit) {
    case "once":
      return "all";
    case "daily":
      return todayBangkok();
    case "per_referral":
      if (!ref) throw new QiError("เส้นชวนเพื่อนต้องระบุ ref (id ผู้ถูกชวน)", 400);
      return ref;
    case "none":
      return "all";
  }
}

export type EarnResult = {
  code: string;
  awarded: boolean;
  qi: number;
  capped: boolean;
  balance: WalletBalance;
};

/** จ่ายแต้มเส้น earn — จ่ายซ้ำในรอบเดิมไม่ได้ (capped) */
export async function earnQi(anonId: string, code: string, ref?: string | null): Promise<EarnResult> {
  const line = QI_EARN_BY_CODE.get(code);
  if (!line) throw new QiError(`ไม่รู้จักเส้นได้แต้ม: ${code}`, 404);

  const db = createDbClient();

  // "none" = ไม่จำกัด (ระบบภายในเรียก) → ข้ามการจอง claim
  if (line.limit !== "none") {
    const periodKey = periodKeyOf(line, ref);
    const claimed = await db
      .insert(baziQiClaim)
      .values({ anonId, code, periodKey })
      .onConflictDoNothing()
      .returning({ code: baziQiClaim.code });
    if (!claimed.length) {
      return { code, awarded: false, qi: 0, capped: true, balance: await getWallet(anonId) };
    }
  }

  const balance = await applyLedger({ anonId, qiDelta: line.qi, reason: `qi:earn:${code}`, ref: ref ?? null });
  // qiDelta บวกไม่มีทางติดลบ — null แปลว่าเขียนไม่สำเร็จจริง ๆ
  if (!balance) throw new QiError("บันทึกแต้มไม่สำเร็จ", 500);
  return { code, awarded: true, qi: line.qi, capped: false, balance };
}

export type SpendResult = {
  code: string;
  qi: number;
  balance: WalletBalance;
  grant: EntitlementGrant;
};

/** ใช้แต้มเส้น spend — หัก + มอบสิทธิ์; grant ล้ม → refund */
export async function spendQi(anonId: string, code: string, ref?: string | null): Promise<SpendResult> {
  const line = QI_SPEND_BY_CODE.get(code);
  if (!line) throw new QiError(`ไม่รู้จักเส้นใช้แต้ม: ${code}`, 404);

  const balance = await applyLedger({
    anonId,
    qiDelta: -line.qi,
    reason: `qi:spend:${code}`,
    ref: ref ?? null,
  });
  if (!balance) throw new QiError("แต้ม Qi ไม่พอ", 409);

  try {
    await grantEntitlement(anonId, line.grant);
  } catch (error) {
    // มอบสิทธิ์ล้ม → คืนแต้ม (auto-refund)
    await applyLedger({ anonId, qiDelta: line.qi, reason: `qi:refund:${code}`, ref: ref ?? null });
    throw new QiError(
      `มอบสิทธิ์ไม่สำเร็จ คืนแต้มแล้ว: ${error instanceof Error ? error.message : "unknown"}`,
      500,
    );
  }

  return { code, qi: line.qi, balance, grant: line.grant };
}
