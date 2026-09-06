/**
 * Qi Point System — โควตาการใช้งานฟีเจอร์ (ฟรีรายวัน + credit ที่ซื้อ)
 * ลำดับการตัด: ใช้โควตาฟรีของวันก่อน (reset โดย period_key = วันไทย) → หมดแล้วค่อยตัด credit ที่แลกมา.
 * freeLimit ขึ้นกับ tier (PLUS/PRO ได้มากกว่า free → ทำให้ tier มีประโยชน์จริง).
 */

import { and, eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziFeatureQuota } from "@/db/schema";
import { todayBangkok } from "@/lib/bazi/manifest/dates";
import { applyLedger, getWallet } from "@/lib/bazi/manifest/ledger";
import { QI_SPEND_BY_CODE } from "@/lib/bazi/qi/catalog";
import { consumeCredit, getCredits, getTier, type CreditKind, type Tier } from "@/lib/bazi/qi/entitlements";

export type QuotaFeature = "card" | "chat";

/** feature → credit kind ที่ใช้เติมเมื่อโควตาฟรีหมด (= code ในตาราง spend ด้วย) */
const CREDIT_KIND: Record<QuotaFeature, CreditKind> = {
  card: "card_use",
  chat: "chat_question",
};

/** ราคา QI ต่อการใช้ 1 ครั้งเมื่อโควตาฟรีหมด — อ่านจาก catalog (แก้ที่เดียว) */
export function qiCostOf(feature: QuotaFeature): number {
  return QI_SPEND_BY_CODE.get(CREDIT_KIND[feature])?.qi ?? 0;
}

/** โควตาฟรีต่อวันตาม tier */
const FREE_LIMIT: Record<QuotaFeature, Record<Tier, number>> = {
  card: { free: 1, plus: 5, pro: 20 },
  chat: { free: 3, plus: 30, pro: 100 },
};

export function freeLimitOf(feature: QuotaFeature, tier: Tier): number {
  return FREE_LIMIT[feature][tier];
}

/** สมาชิกจ่ายเงิน (plus/pro) แชทได้ไม่จำกัด — ไม่หัก QI, ไม่ตัดโควตา (นโยบายเฉพาะ chat) */
export function isUnlimited(feature: QuotaFeature, tier: Tier): boolean {
  return feature === "chat" && (tier === "plus" || tier === "pro");
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

export type PeekResult = {
  /** ใช้ได้ไหมในครั้งถัดไป (ฟรีเหลือ / มี credit / QI พอ) */
  affordable: boolean;
  /** ที่มาที่จะถูกใช้ครั้งถัดไป (ไม่หักตอนนี้) */
  nextSource: "free" | "credit" | "qi" | null;
  /** ราคา QI ถ้าต้องหัก (0 เมื่อ free/credit) */
  cost: number;
  /** โควตาฟรีที่เหลือวันนี้ */
  freeRemaining: number;
};

/**
 * เช็คว่าจะใช้ฟีเจอร์ครั้งถัดไปได้ไหม โดย "ไม่หัก" — สำหรับ lane ที่ต้องหักหลังทำสำเร็จ (เช่นแชท).
 * ลำดับเหมือน consumeUse: ฟรีวันนี้ → credit → QI.
 */
export async function peekUse(anonId: string, feature: QuotaFeature): Promise<PeekResult> {
  const tier = await getTier(anonId);
  // สมาชิกจ่ายเงิน: แชทไม่จำกัด → ใช้ได้เสมอ ไม่หัก
  if (isUnlimited(feature, tier)) return { affordable: true, nextSource: "free", cost: 0, freeRemaining: -1 };
  const limit = freeLimitOf(feature, tier);
  const cost = qiCostOf(feature);
  const used = (await usageToday(anonId))[feature];
  if (used < limit) return { affordable: true, nextSource: "free", cost: 0, freeRemaining: limit - used };
  const credits = await getCredits(anonId, CREDIT_KIND[feature]);
  if (credits > 0) return { affordable: true, nextSource: "credit", cost: 0, freeRemaining: 0 };
  const { qi } = await getWallet(anonId);
  if (qi >= cost) return { affordable: true, nextSource: "qi", cost, freeRemaining: 0 };
  return { affordable: false, nextSource: null, cost, freeRemaining: 0 };
}

export type ConsumeResult =
  | { ok: true; source: "free" | "credit" | "qi"; cost: number; freeRemaining: number; creditRemaining: number }
  | { ok: false; cost: number; freeRemaining: 0; creditRemaining: number };

/**
 * ตัดสิทธิ์ใช้ฟีเจอร์ 1 ครั้ง. ลำดับ: โควตาฟรีวันนี้ → credit ที่ซื้อไว้ → หัก QI ตรง ๆ (สกุลเงินหลัก).
 * คืน ok:false เฉพาะเมื่อทั้งฟรี+credit หมด และ QI ไม่พอ.
 * race: อัปเดต used/ยอด แบบมีเงื่อนไขใน statement เดียว.
 */
export async function consumeUse(anonId: string, feature: QuotaFeature): Promise<ConsumeResult> {
  const db = createDbClient();
  const tier = await getTier(anonId);
  // สมาชิกจ่ายเงิน: แชทไม่จำกัด → ผ่านเลย ไม่ตัดโควตา/ไม่หัก QI
  if (isUnlimited(feature, tier)) {
    return { ok: true, source: "free", cost: 0, freeRemaining: -1, creditRemaining: -1 };
  }
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

  const cost = qiCostOf(feature);

  if (bumped.length) {
    return {
      ok: true,
      source: "free",
      cost: 0, // ใช้ฟรี — ไม่หัก QI
      freeRemaining: Math.max(0, limit - bumped[0].used),
      creditRemaining: -1, // ไม่แตะ credit — ไม่ต้องอ่าน
    };
  }

  // โควตาฟรีหมด → ตัด credit ที่แลกมาก่อน (ผู้ที่เคยซื้อไว้ใช้ก่อน)
  const remaining = await consumeCredit(anonId, CREDIT_KIND[feature]);
  if (remaining !== null) {
    return { ok: true, source: "credit", cost: 0, freeRemaining: 0, creditRemaining: remaining };
  }

  // ฟรี+credit หมด → หัก QI ตรง ๆ (QI = สกุลเงินหลัก) + ลง ledger (โผล่ในประวัติ "ใช้ไป")
  // applyLedger กันติดลบในตัว → คืน null = QI ไม่พอ
  const balance = await applyLedger({
    anonId,
    qiDelta: -cost,
    reason: `qi:spend:${CREDIT_KIND[feature]}`,
  });
  if (balance) {
    return { ok: true, source: "qi", cost, freeRemaining: 0, creditRemaining: 0 };
  }
  return { ok: false, cost, freeRemaining: 0, creditRemaining: 0 };
}

/** ผล gate: blocked=Response(402) ถ้าใช้ไม่ได้ · result=ผลการตัดสิทธิ์ (source/cost) ถ้าผ่าน */
export type GateResult = { blocked: Response | null; result: ConsumeResult | null };

function quotaBlockResponse(feature: QuotaFeature, cost: number): Response {
  return Response.json(
    {
      error: {
        message:
          feature === "card"
            ? `ชี่ไม่พอเปิดการ์ด (ใช้ ${cost} ชี่ต่อครั้งเมื่อโควตาฟรีหมด) — เติมชี่เพื่อเปิดเพิ่ม`
            : `ชี่ไม่พอถาม AI (ใช้ ${cost} ชี่ต่อคำถามเมื่อโควตาฟรีหมด) — เติมชี่เพื่อถามเพิ่ม`,
        code: "qi_quota_exhausted",
        feature,
      },
    },
    { status: 402 },
  );
}

/**
 * Gate ที่คืนที่มาของการตัดสิทธิ์ (free/credit/qi) ให้ route เอาไปโชว์ป้ายตามจริง.
 * ไม่ส่ง anonId → ปล่อยผ่าน (backward-compat) result=null.
 */
export async function gateFeature(anonId: string | undefined | null, feature: QuotaFeature): Promise<GateResult> {
  const id = anonId?.trim();
  if (!id) return { blocked: null, result: null };
  const result = await consumeUse(id, feature);
  if (!result.ok) return { blocked: quotaBlockResponse(feature, result.cost), result };
  return { blocked: null, result };
}

/**
 * Gate สำหรับ route ฟีเจอร์ — ถ้าส่ง anonId มา จะตัดสิทธิ์ 1 ครั้ง (ฟรี→credit→หัก QI); ชี่ไม่พอ → 402.
 * ถ้าไม่ส่ง anonId (ผู้เรียกเดิม/ไม่ผูกระบบแต้ม) → คืน null (ปล่อยผ่าน, backward-compat).
 * คืน null = ผ่าน · คืน Response = บล็อก (return ออกไปเลย). ต้องการที่มา (source) ใช้ gateFeature แทน.
 */
export async function qiGate(anonId: string | undefined | null, feature: QuotaFeature): Promise<Response | null> {
  return (await gateFeature(anonId, feature)).blocked;
}
