/**
 * Qi Point System — โควตาการใช้งานฟีเจอร์ (ฟรีรายวัน + credit ที่ซื้อ)
 * ลำดับการตัด: ใช้โควตาฟรีของวันก่อน (reset โดย period_key = วันไทย) → หมดแล้วค่อยตัด credit ที่แลกมา.
 * freeLimit ขึ้นกับ tier (PLUS/PRO ได้มากกว่า free → ทำให้ tier มีประโยชน์จริง).
 */

import { and, eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziFeatureQuota } from "@/db/schema";
import { todayBangkok } from "@/lib/bazi/manifest/dates";
import { consumeCredit, getCredits, getTier, type CreditKind, type Tier } from "@/lib/bazi/qi/entitlements";

export type QuotaFeature = "card" | "chat";

/** feature → credit kind ที่ใช้เติมเมื่อโควตาฟรีหมด */
const CREDIT_KIND: Record<QuotaFeature, CreditKind> = {
  card: "card_use",
  chat: "chat_question",
};

/** โควตาฟรีต่อวันตาม tier */
const FREE_LIMIT: Record<QuotaFeature, Record<Tier, number>> = {
  card: { free: 1, plus: 5, pro: 20 },
  chat: { free: 3, plus: 30, pro: 100 },
};

export function freeLimitOf(feature: QuotaFeature, tier: Tier): number {
  return FREE_LIMIT[feature][tier];
}

/** จำนวนที่ใช้ไปแล้ววันนี้ (เขตไทย) ต่อฟีเจอร์ — สำหรับโชว์ badge "เหลือ N/limit วันนี้" ในหน้าแพ็กเกจ */
export async function usageToday(anonId: string): Promise<Record<QuotaFeature, number>> {
  const db = createDbClient();
  const periodKey = todayBangkok();
  const rows = await db
    .select({ feature: baziFeatureQuota.feature, used: baziFeatureQuota.used })
    .from(baziFeatureQuota)
    .where(and(eq(baziFeatureQuota.anonId, anonId), eq(baziFeatureQuota.periodKey, periodKey)));
  const out: Record<QuotaFeature, number> = { card: 0, chat: 0 };
  for (const r of rows) {
    if (r.feature === "card" || r.feature === "chat") out[r.feature] = r.used;
  }
  return out;
}

/** จำนวนช่องจับคู่พื้นฐานตาม tier (ยังไม่รวม slot ที่แลกด้วย Qi) */
const BASE_MATCHING_SLOTS: Record<Tier, number> = { free: 3, plus: 10, pro: 50 };

/** เพดานช่องจับคู่ทั้งหมด = พื้นฐาน(tier) + matching_slot ที่แลกด้วย Qi */
export async function matchingSlotCap(anonId: string): Promise<number> {
  const [tier, purchased] = await Promise.all([getTier(anonId), getCredits(anonId, "matching_slot")]);
  return BASE_MATCHING_SLOTS[tier] + purchased;
}

export type ConsumeResult =
  | { ok: true; source: "free" | "credit"; freeRemaining: number; creditRemaining: number }
  | { ok: false; freeRemaining: 0; creditRemaining: number };

/**
 * ตัดสิทธิ์ใช้ฟีเจอร์ 1 ครั้ง. คืน ok:false ถ้าทั้งโควตาฟรีและ credit หมด.
 * race: อัปเดต used แบบมีเงื่อนไข (used < limit) ใน statement เดียว.
 */
export async function consumeUse(anonId: string, feature: QuotaFeature): Promise<ConsumeResult> {
  const db = createDbClient();
  const tier = await getTier(anonId);
  const limit = freeLimitOf(feature, tier);
  const periodKey = todayBangkok();

  // แถวโควตาวันนี้ (used เริ่ม 0)
  await db
    .insert(baziFeatureQuota)
    .values({ anonId, feature, periodKey, used: 0 })
    .onConflictDoNothing();

  // ใช้ฟรีก่อน — เพิ่ม used เฉพาะเมื่อยังไม่ถึง limit
  const bumped = await db
    .update(baziFeatureQuota)
    .set({ used: sql`${baziFeatureQuota.used} + 1`, updatedAt: sql`now()` })
    .where(
      and(
        eq(baziFeatureQuota.anonId, anonId),
        eq(baziFeatureQuota.feature, feature),
        eq(baziFeatureQuota.periodKey, periodKey),
        sql`${baziFeatureQuota.used} < ${limit}`,
      ),
    )
    .returning({ used: baziFeatureQuota.used });

  if (bumped.length) {
    return {
      ok: true,
      source: "free",
      freeRemaining: Math.max(0, limit - bumped[0].used),
      creditRemaining: -1, // ไม่แตะ credit — ไม่ต้องอ่าน
    };
  }

  // โควตาฟรีหมด → ตัด credit ที่แลกมา
  const remaining = await consumeCredit(anonId, CREDIT_KIND[feature]);
  if (remaining === null) {
    return { ok: false, freeRemaining: 0, creditRemaining: 0 };
  }
  return { ok: true, source: "credit", freeRemaining: 0, creditRemaining: remaining };
}

/**
 * Gate สำหรับ route ฟีเจอร์ — ถ้าส่ง anonId มา จะตัดโควตา 1 ครั้ง; หมด → คืน Response 402.
 * ถ้าไม่ส่ง anonId (ผู้เรียกเดิม/ไม่ผูกระบบแต้ม) → คืน null (ปล่อยผ่าน, backward-compat).
 * คืน null = ผ่าน (เรียกต่อได้) · คืน Response = บล็อก (return ออกไปเลย).
 */
export async function qiGate(anonId: string | undefined | null, feature: QuotaFeature): Promise<Response | null> {
  const id = anonId?.trim();
  if (!id) return null;
  const result = await consumeUse(id, feature);
  if (!result.ok) {
    return Response.json(
      {
        error: {
          message:
            feature === "card"
              ? "โควตาเปิดการ์ดวันนี้หมดแล้ว — แลก 10 Qi เพื่อเปิดเพิ่ม (/api/qi/spend card_use)"
              : "โควตาถาม AI วันนี้หมดแล้ว — แลก 30 Qi เพื่อถามเพิ่ม (/api/qi/spend chat_question)",
          code: "qi_quota_exhausted",
          feature,
        },
      },
      { status: 402 },
    );
  }
  return null;
}
