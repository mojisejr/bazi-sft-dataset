// src/lib/bazi/qi/coupon.ts — คูปองกิจกรรม (#2 Phase 2 · ซินแสนุ้ย 2026-09-14).
// admin สร้าง/พัก (จาก /ops) + user แลกโค้ดรับรางวัล (QI/เครดิตแชท·เปิดไพ่/tier). กันรับซ้ำ 1 คูปอง/บัญชี
// (UNIQUE coupon_id+anon_id) + เพดานรวม (used_count conditional). รางวัลใช้ primitive เดิม (applyLedger/grantEntitlement).
import { randomUUID } from "node:crypto";

import { and, desc, eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { activityCoupon, activityCouponRedemption } from "@/db/schema";
import { applyLedger } from "@/lib/bazi/manifest/ledger";
import { grantEntitlement } from "@/lib/bazi/qi/entitlements";

export type CouponRewardKind = "qi" | "chat" | "card" | "matching" | "tier";

export type OpsCoupon = {
  id: string;
  code: string;
  rewardKind: CouponRewardKind;
  rewardQi: number;
  creditCount: number;
  tierSku: string | null;
  tierDays: number;
  startsAt: string | null;
  endsAt: string | null;
  maxUseTotal: number | null;
  maxUsePerUser: number | null;
  usedCount: number;
  status: string;
  createdAt: string;
};

const iso = (d: unknown): string | null => (d ? new Date(d as string).toISOString() : null);

function shape(r: typeof activityCoupon.$inferSelect): OpsCoupon {
  return {
    id: r.id,
    code: r.code,
    rewardKind: r.rewardKind as CouponRewardKind,
    rewardQi: r.rewardQi,
    creditCount: r.creditCount,
    tierSku: r.tierSku ?? null,
    tierDays: r.tierDays,
    startsAt: iso(r.startsAt),
    endsAt: iso(r.endsAt),
    maxUseTotal: r.maxUseTotal ?? null,
    maxUsePerUser: r.maxUsePerUser ?? null,
    usedCount: r.usedCount,
    status: r.status,
    createdAt: iso(r.createdAt) ?? "",
  };
}

export async function listCoupons(): Promise<OpsCoupon[]> {
  const db = createDbClient();
  const rows = await db.select().from(activityCoupon).orderBy(desc(activityCoupon.createdAt)).limit(300);
  return rows.map(shape);
}

// ── admin: สร้าง ───────────────────────────────────────────────────────────────
export type CreateCouponInput = Record<string, unknown>;
export type ValidatedCoupon = {
  code: string;
  rewardKind: CouponRewardKind;
  rewardQi: number;
  creditCount: number;
  tierSku: string | null;
  tierDays: number;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUseTotal: number | null;
  maxUsePerUser: number | null;
};

function parseDate(v: unknown): Date | null | "invalid" {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return "invalid";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

export function validateCreate(input: CreateCouponInput): { ok: true; value: ValidatedCoupon } | { ok: false; reason: string } {
  const code = typeof input.code === "string" ? input.code.trim() : "";
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(code)) return { ok: false, reason: "โค้ดต้องเป็น a-z 0-9 _ - ยาว 2-40 ตัว" };
  const rewardKind = input.rewardKind as CouponRewardKind;
  if (!["qi", "chat", "card", "matching", "tier"].includes(rewardKind)) return { ok: false, reason: "reward ต้องเป็น qi|chat|card|matching|tier" };

  let rewardQi = 0;
  let creditCount = 0;
  let tierSku: string | null = null;
  let tierDays = 0;
  const amount = Math.round(Number(input.amount));
  if (rewardKind === "qi") {
    if (!Number.isFinite(amount) || amount < 1) return { ok: false, reason: "จำนวน QI ต้อง ≥ 1" };
    rewardQi = amount;
  } else if (rewardKind === "chat" || rewardKind === "card" || rewardKind === "matching") {
    if (!Number.isFinite(amount) || amount < 1) return { ok: false, reason: "จำนวนเครดิตต้อง ≥ 1" };
    creditCount = amount;
  } else {
    tierSku = input.tierSku === "pro" ? "pro" : input.tierSku === "plus" ? "plus" : null;
    if (!tierSku) return { ok: false, reason: "tier ต้องเป็น plus หรือ pro" };
    if (!Number.isFinite(amount) || amount < 1) return { ok: false, reason: "จำนวนวัน tier ต้อง ≥ 1" };
    tierDays = amount;
  }

  const startsAt = parseDate(input.startsAt);
  const endsAt = parseDate(input.endsAt);
  if (startsAt === "invalid" || endsAt === "invalid") return { ok: false, reason: "วันที่ไม่ถูกต้อง หรือเว้นว่าง" };
  if (startsAt && endsAt && startsAt.getTime() >= endsAt.getTime()) return { ok: false, reason: "วันเริ่มต้องก่อนวันหมดอายุ" };
  let maxUseTotal: number | null = null;
  if (input.maxUseTotal != null && input.maxUseTotal !== "") {
    const n = Number(input.maxUseTotal);
    if (!Number.isFinite(n) || n < 1) return { ok: false, reason: "จำนวนใช้รวมต้อง ≥ 1 หรือเว้นว่าง" };
    maxUseTotal = Math.round(n);
  }
  let maxUsePerUser: number | null = null;
  if (input.maxUsePerUser != null && input.maxUsePerUser !== "") {
    const n = Number(input.maxUsePerUser);
    if (!Number.isFinite(n) || n < 1) return { ok: false, reason: "จำนวนต่อคนต้อง ≥ 1 หรือเว้นว่าง (=1)" };
    maxUsePerUser = Math.round(n);
  }

  return { ok: true, value: { code, rewardKind, rewardQi, creditCount, tierSku, tierDays, startsAt: startsAt || null, endsAt: endsAt || null, maxUseTotal, maxUsePerUser } };
}

export async function isCodeTaken(code: string): Promise<boolean> {
  const db = createDbClient();
  const r = await db.execute(sql`SELECT 1 FROM activity_coupon WHERE lower(code) = lower(${code}) LIMIT 1`);
  const arr = (Array.isArray(r) ? r : (r as { rows?: unknown[] }).rows ?? []) as unknown[];
  return arr.length > 0;
}

export async function createCoupon(v: ValidatedCoupon): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  if (await isCodeTaken(v.code)) return { ok: false, reason: "มีโค้ดนี้อยู่แล้ว" };
  const db = createDbClient();
  const saved = await db
    .insert(activityCoupon)
    .values({
      code: v.code,
      rewardKind: v.rewardKind,
      rewardQi: v.rewardQi,
      creditCount: v.creditCount,
      tierSku: v.tierSku,
      tierDays: v.tierDays,
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      maxUseTotal: v.maxUseTotal,
      maxUsePerUser: v.maxUsePerUser,
      status: "ACTIVE",
    })
    .returning({ id: activityCoupon.id });
  return { ok: true, id: saved[0]?.id ?? "" };
}

export async function setStatus(id: string, status: "ACTIVE" | "PAUSED" | "EXPIRED"): Promise<boolean> {
  const db = createDbClient();
  const res = await db.update(activityCoupon).set({ status }).where(eq(activityCoupon.id, id)).returning({ id: activityCoupon.id });
  return res.length > 0;
}

/** ลบคูปอง — เฉพาะที่ "ยังไม่ถูกใช้" (used_count = 0) กันลบทิ้งประวัติการแลกของคนที่ใช้ไปแล้ว. */
/** ลบคูปองรางวัล — ลบประวัติการแลก (redemption) ด้วย (cascade) เพื่อให้ลบได้แม้ถูกใช้ไปแล้ว
 *  (คูปองรางวัลเป็นการแจก ไม่ผูกใบเสร็จเงินเหมือน discount — ลบทิ้งได้ตามที่แอดมินสั่ง). */
export async function deleteCoupon(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = createDbClient();
  const exists = await db.select({ id: activityCoupon.id }).from(activityCoupon).where(eq(activityCoupon.id, id)).limit(1);
  if (!exists.length) return { ok: false, reason: "ไม่พบคูปอง" };
  await db.delete(activityCouponRedemption).where(eq(activityCouponRedemption.couponId, id));
  await db.delete(activityCoupon).where(eq(activityCoupon.id, id));
  return { ok: true };
}

// คูปอง tier: มิเรอร์ลง member_subscription (แหล่งความจริง tier ฝั่ง mootech-fe) เพื่อให้ badge/gating/
// วันหมดอายุ โชว์ PRO/PLUS เหมือนซื้อจริง. FE (`/api/user` → resolveMembershipFromRows) อ่าน tier จากตารางนี้
// เท่านั้น ไม่เคยอ่าน bazi_entitlement — ถ้า grant ลง bazi_entitlement อย่างเดียว FE จะโชว์ Free (บั๊ก 2026-09-22).
// เขียนเป็นแถว ACTIVE, amount 0, package "COUPON:<code>", start=วันนี้(กทม.) expire=+tierDays (คอลัมน์ date กทม.
// ให้ตรงกับ reader ที่เทียบ expire_at >= today(Asia/Bangkok)). ไม่แตะ payment_id/v2_payment_id (คูปองไม่มีใบเสร็จ).
async function mirrorTierToMemberSubscription(
  anonId: string,
  sku: "plus" | "pro",
  days: number,
  couponCode: string,
): Promise<void> {
  const db = createDbClient();
  await db.execute(sql`
    insert into member_subscription
      (id, user_id, tier_code, package_code, amount_satang, start_at, expire_at, status, created_at)
    values (
      ${randomUUID()},
      ${anonId},
      ${sku.toUpperCase()},
      ${`COUPON:${couponCode}`},
      0,
      (now() at time zone 'Asia/Bangkok')::date,
      ((now() at time zone 'Asia/Bangkok')::date + ${`${days} days`}::interval)::date,
      'ACTIVE',
      now()
    )
  `);
}

// ── user: แลกโค้ด ───────────────────────────────────────────────────────────────
function rewardSummary(c: typeof activityCoupon.$inferSelect): string {
  if (c.rewardKind === "qi") return `QI +${c.rewardQi}`;
  if (c.rewardKind === "chat") return `แชท +${c.creditCount} ครั้ง`;
  if (c.rewardKind === "card") return `เปิดไพ่ +${c.creditCount} ครั้ง`;
  if (c.rewardKind === "matching") return `แมทช์สมพงศ์ +${c.creditCount} ครั้ง`;
  return `${(c.tierSku ?? "").toUpperCase()} ${c.tierDays} วัน`;
}

export type RedeemResult =
  | { ok: true; reward: string; qi?: number }
  | { ok: false; reason: "NOT_FOUND" | "INACTIVE" | "WINDOW" | "ALREADY" | "CAPPED" | "GRANT_FAILED" };

/** แลกคูปอง: กันซ้ำ 1 คูปอง/บัญชี (UNIQUE) → จองเพดานรวม → มอบรางวัล. */
export async function redeemCoupon(anonId: string, codeInput: string): Promise<RedeemResult> {
  const db = createDbClient();
  const code = codeInput.trim();
  const found = await db.select().from(activityCoupon).where(sql`lower(${activityCoupon.code}) = lower(${code})`).limit(1);
  const c = found[0];
  if (!c) return { ok: false, reason: "NOT_FOUND" };
  if (c.status !== "ACTIVE") return { ok: false, reason: "INACTIVE" };
  const now = Date.now();
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { ok: false, reason: "WINDOW" };
  if (c.endsAt && new Date(c.endsAt).getTime() <= now) return { ok: false, reason: "WINDOW" };

  // 1) จำกัดต่อคน: นับที่คนนี้เคยแลกคูปองนี้ (max_use_per_user; null = 1 = พฤติกรรมเดิม 1/บัญชี)
  //    ไม่มี UNIQUE แล้ว (0053) → นับเอง. race แข่งกันเองสูงสุดเกิน 1 (ยอมรับได้; maxUseTotal กันรวมอีกชั้น)
  const perUserLimit = c.maxUsePerUser ?? 1;
  const mine = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(activityCouponRedemption)
    .where(and(eq(activityCouponRedemption.couponId, c.id), eq(activityCouponRedemption.anonId, anonId)));
  if ((mine[0]?.n ?? 0) >= perUserLimit) return { ok: false, reason: "ALREADY" };

  const claimed = await db
    .insert(activityCouponRedemption)
    .values({ couponId: c.id, anonId, rewardSummary: rewardSummary(c) })
    .returning({ id: activityCouponRedemption.id });
  const redemptionId = claimed[0].id;

  // 2) จองเพดานรวม (conditional) — ถ้าเต็ม/ปิด ย้อน latch
  const reserved = await db
    .update(activityCoupon)
    .set({ usedCount: sql`${activityCoupon.usedCount} + 1` })
    .where(and(eq(activityCoupon.id, c.id), eq(activityCoupon.status, "ACTIVE"), sql`(${activityCoupon.maxUseTotal} IS NULL OR ${activityCoupon.usedCount} < ${activityCoupon.maxUseTotal})`))
    .returning({ id: activityCoupon.id });
  if (!reserved.length) {
    await db.delete(activityCouponRedemption).where(eq(activityCouponRedemption.id, redemptionId));
    return { ok: false, reason: "CAPPED" };
  }

  // 3) มอบรางวัลด้วย primitive เดิม (idempotent-ish); ล้ม → ย้อน latch + used_count
  try {
    let qi: number | undefined;
    if (c.rewardKind === "qi") {
      const bal = await applyLedger({ anonId, qiDelta: c.rewardQi, reason: `qi:coupon:${c.code}`, ref: c.id });
      qi = bal?.qi;
    } else if (c.rewardKind === "chat") {
      await grantEntitlement(anonId, { type: "credit", kind: "chat_question", credits: c.creditCount });
    } else if (c.rewardKind === "card") {
      await grantEntitlement(anonId, { type: "credit", kind: "card_use", credits: c.creditCount });
    } else if (c.rewardKind === "matching") {
      await grantEntitlement(anonId, { type: "credit", kind: "matching_slot", credits: c.creditCount });
    } else {
      const sku = (c.tierSku as "plus" | "pro") ?? "plus";
      await grantEntitlement(anonId, { type: "tier", sku, durationDays: c.tierDays });
      // มิเรอร์ลง member_subscription ให้ FE เห็น tier จริง (badge/gating/วันหมดอายุ) — bazi_entitlement อย่างเดียว FE อ่านไม่เห็น
      await mirrorTierToMemberSubscription(anonId, sku, c.tierDays, c.code);
    }
    return { ok: true, reward: rewardSummary(c), qi };
  } catch {
    await db.delete(activityCouponRedemption).where(eq(activityCouponRedemption.id, redemptionId));
    await db.update(activityCoupon).set({ usedCount: sql`greatest(${activityCoupon.usedCount} - 1, 0)` }).where(eq(activityCoupon.id, c.id));
    return { ok: false, reason: "GRANT_FAILED" };
  }
}
