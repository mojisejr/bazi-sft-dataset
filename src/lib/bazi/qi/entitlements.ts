/**
 * Qi Point System — Entitlement store (สิทธิ์ที่ user แลก/ได้รับ)
 * 1 ตารางกลาง (bazi_entitlement) รองรับ 2 ทรง:
 *   credit-based (card_use/chat_question/matching_slot) — นับจำนวนคงเหลือใน `credits`
 *   owned/expiry (course/book/tier)                      — มีแถว = เป็นเจ้าของ; tier มี expiresAt
 * consume ใช้ conditional UPDATE (race-safe เหมือน applyLedger).
 */

import { and, eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziEntitlement } from "@/db/schema";
import type { EntitlementGrant } from "@/lib/bazi/qi/catalog";

export type CreditKind = "card_use" | "chat_question" | "matching_slot";
export type Tier = "free" | "plus" | "pro";

/** มอบสิทธิ์ตาม grant. throw ถ้าล้ม (ให้ engine จับไป refund) */
export async function grantEntitlement(anonId: string, grant: EntitlementGrant): Promise<void> {
  const db = createDbClient();

  const target = [baziEntitlement.anonId, baziEntitlement.kind, baziEntitlement.sku];

  if (grant.type === "credit") {
    // upsert + บวก credits (sku = '' สำหรับ kind แบบ credit)
    await db
      .insert(baziEntitlement)
      .values({ anonId, kind: grant.kind, sku: "", credits: grant.credits })
      .onConflictDoUpdate({
        target,
        set: {
          credits: sql`${baziEntitlement.credits} + ${grant.credits}`,
          updatedAt: sql`now()`,
        },
      });
    return;
  }

  if (grant.type === "owned") {
    // เป็นเจ้าของถาวร — มีอยู่แล้วก็ไม่ต้องทำอะไร
    await db
      .insert(baziEntitlement)
      .values({ anonId, kind: grant.kind, sku: grant.sku, credits: 0 })
      .onConflictDoUpdate({ target, set: { updatedAt: sql`now()` } });
    return;
  }

  // tier — ต่ออายุจากวันหมดอายุเดิม (ถ้ายังไม่หมด) มิฉะนั้นเริ่มนับจากตอนนี้
  await db
    .insert(baziEntitlement)
    .values({
      anonId,
      kind: "tier",
      sku: grant.sku,
      credits: 0,
      expiresAt: sql`now() + ${`${grant.durationDays} days`}::interval`,
    })
    .onConflictDoUpdate({
      target,
      set: {
        expiresAt: sql`greatest(coalesce(${baziEntitlement.expiresAt}, now()), now()) + ${`${grant.durationDays} days`}::interval`,
        updatedAt: sql`now()`,
      },
    });
}

/** ตัดสิทธิ์แบบ credit 1 หน่วย — คืนจำนวนคงเหลือ หรือ null ถ้าไม่พอ */
export async function consumeCredit(anonId: string, kind: CreditKind): Promise<number | null> {
  const db = createDbClient();
  const updated = await db
    .update(baziEntitlement)
    .set({ credits: sql`${baziEntitlement.credits} - 1`, updatedAt: sql`now()` })
    .where(
      and(
        eq(baziEntitlement.anonId, anonId),
        eq(baziEntitlement.kind, kind),
        sql`${baziEntitlement.credits} >= 1`,
      ),
    )
    .returning({ credits: baziEntitlement.credits });
  return updated[0]?.credits ?? null;
}

export async function getCredits(anonId: string, kind: CreditKind): Promise<number> {
  const db = createDbClient();
  const rows = await db
    .select({ credits: baziEntitlement.credits })
    .from(baziEntitlement)
    .where(and(eq(baziEntitlement.anonId, anonId), eq(baziEntitlement.kind, kind)))
    .limit(1);
  return rows[0]?.credits ?? 0;
}

export async function hasEntitlement(anonId: string, kind: "course" | "book", sku: string): Promise<boolean> {
  const db = createDbClient();
  const rows = await db
    .select({ id: baziEntitlement.id })
    .from(baziEntitlement)
    .where(
      and(eq(baziEntitlement.anonId, anonId), eq(baziEntitlement.kind, kind), eq(baziEntitlement.sku, sku)),
    )
    .limit(1);
  return rows.length > 0;
}

/** tier ปัจจุบัน — pro ชนะ plus; หมดอายุแล้วนับเป็น free */
export async function getTier(anonId: string): Promise<Tier> {
  const db = createDbClient();
  const rows = await db
    .select({ sku: baziEntitlement.sku, expiresAt: baziEntitlement.expiresAt })
    .from(baziEntitlement)
    .where(
      and(
        eq(baziEntitlement.anonId, anonId),
        eq(baziEntitlement.kind, "tier"),
        sql`(${baziEntitlement.expiresAt} is null or ${baziEntitlement.expiresAt} > now())`,
      ),
    );
  if (rows.some((r) => r.sku === "pro")) return "pro";
  if (rows.some((r) => r.sku === "plus")) return "plus";
  return "free";
}

export type EntitlementSummary = {
  credits: Record<CreditKind, number>;
  owned: Array<{ kind: string; sku: string }>;
  tier: Tier;
};

/** สรุปสิทธิ์ทั้งหมดของ user (สำหรับ GET /api/qi/entitlements) */
export async function getEntitlementSummary(anonId: string): Promise<EntitlementSummary> {
  const db = createDbClient();
  const rows = await db.select().from(baziEntitlement).where(eq(baziEntitlement.anonId, anonId));
  const now = Date.now();

  const credits: Record<CreditKind, number> = { card_use: 0, chat_question: 0, matching_slot: 0 };
  const owned: Array<{ kind: string; sku: string }> = [];
  let tier: Tier = "free";

  for (const r of rows) {
    if (r.kind === "card_use" || r.kind === "chat_question" || r.kind === "matching_slot") {
      credits[r.kind] = r.credits;
    } else if (r.kind === "course" || r.kind === "book") {
      owned.push({ kind: r.kind, sku: r.sku });
    } else if (r.kind === "tier") {
      const active = !r.expiresAt || r.expiresAt.getTime() > now;
      if (active && r.sku === "pro") tier = "pro";
      else if (active && r.sku === "plus" && tier !== "pro") tier = "plus";
    }
  }

  return { credits, owned, tier };
}
