import { randomInt } from "node:crypto";

import { eq } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziReferralCode, baziReferralRedemption, baziUserProfile } from "@/db/schema";
import { applyLedger } from "@/lib/bazi/manifest/ledger";
import { earnQi } from "@/lib/bazi/qi/engine";

export const runtime = "nodejs";

/**
 * /api/referral — จอ companion-referral (แนะนำเพื่อน).
 *   GET  ?anonId=...        → โค้ดของเรา (สร้างครั้งแรกอัตโนมัติ) + จำนวนเพื่อนที่ใช้แล้ว
 *   POST { anonId, code }   → คนใหม่กรอกโค้ด: ผู้ชวน +250 เหรียญ, คนใหม่ +100 เหรียญ
 *                             (1 คนใช้โค้ดได้ครั้งเดียวตลอดชีพ, ใช้โค้ดตัวเองไม่ได้)
 */

const REWARD_REFERRER = { coins: 250, xp: 100 };
const REWARD_REFEREE = { coins: 100, xp: 50 };

/** โค้ดรูปแบบ MUMATE + เลข 3 หลัก (ตามจอ MUMATE888) — ชนกันก็สุ่มใหม่ */
function randomCode(): string {
  return `MUMATE${randomInt(100, 1000)}`;
}

async function getOrCreateCode(anonId: string): Promise<string> {
  const db = createDbClient();
  const existing = await db
    .select()
    .from(baziReferralCode)
    .where(eq(baziReferralCode.anonId, anonId))
    .limit(1);
  if (existing[0]) return existing[0].code;

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    try {
      const inserted = await db
        .insert(baziReferralCode)
        .values({ anonId, code })
        .onConflictDoNothing({ target: baziReferralCode.anonId })
        .returning({ code: baziReferralCode.code });
      if (inserted[0]) return inserted[0].code;
      // แถว anonId มีแล้ว (แข่งกับ request อื่น) — อ่านกลับ
      const again = await db
        .select()
        .from(baziReferralCode)
        .where(eq(baziReferralCode.anonId, anonId))
        .limit(1);
      if (again[0]) return again[0].code;
    } catch (error) {
      // โค้ดชน unique(code) — วนสุ่มใหม่
      const code = error && typeof error === "object" ? (error as { code?: string }).code : undefined;
      if (code !== "23505") throw error;
    }
  }
  throw new Error("สร้างโค้ดแนะนำไม่สำเร็จ (ชนซ้ำหลายครั้ง)");
}

const PostSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^MUMATE\d{3}$/, "โค้ดต้องเป็นรูปแบบ MUMATE ตามด้วยเลข 3 หลัก"),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    // invite-landing (จอ "เพื่อนเปิดลิงก์"): GET ?code=MUMATE123 → โค้ดถูกต้องไหม + ชื่อแสดงผู้ชวน (อาจ null).
    // ใช้ก่อนสมัคร — ไม่มีตัวตน, ได้แค่ @name ไม่ใช่ข้อมูลส่วนตัว
    const codeParam = url.searchParams.get("code")?.trim().toUpperCase();
    if (codeParam) {
      if (!/^MUMATE\d{3}$/.test(codeParam)) {
        return Response.json({ error: "โค้ดไม่ถูกต้อง" }, { status: 400 });
      }
      const db = createDbClient();
      const owner = await db
        .select({ anonId: baziReferralCode.anonId })
        .from(baziReferralCode)
        .where(eq(baziReferralCode.code, codeParam))
        .limit(1);
      if (!owner.length) {
        return Response.json({ error: "ไม่พบโค้ดนี้" }, { status: 404 });
      }
      const profile = await db
        .select({ displayName: baziUserProfile.displayName })
        .from(baziUserProfile)
        .where(eq(baziUserProfile.anonId, owner[0].anonId))
        .limit(1);
      return Response.json(
        { code: codeParam, inviterName: profile[0]?.displayName ?? null },
        { status: 200 },
      );
    }

    const anonId = url.searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });

    const code = await getOrCreateCode(anonId);
    const db = createDbClient();
    const redemptions = await db
      .select({ refereeAnonId: baziReferralRedemption.refereeAnonId })
      .from(baziReferralRedemption)
      .where(eq(baziReferralRedemption.referrerAnonId, anonId));

    return Response.json(
      {
        anonId,
        code,
        inviteUrl: `mumate.com/invite/${code}`,
        invitedCount: redemptions.length,
        rewardPerInvite: REWARD_REFERRER.coins,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown referral error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());
    const db = createDbClient();

    const owner = await db
      .select()
      .from(baziReferralCode)
      .where(eq(baziReferralCode.code, body.code))
      .limit(1);
    if (!owner[0]) return Response.json({ error: "ไม่พบโค้ดนี้" }, { status: 404 });
    if (owner[0].anonId === body.anonId) {
      return Response.json({ error: "ใช้โค้ดของตัวเองไม่ได้" }, { status: 409 });
    }

    // unique(referee) กันใช้ซ้ำตลอดชีพ
    const inserted = await db
      .insert(baziReferralRedemption)
      .values({ code: body.code, referrerAnonId: owner[0].anonId, refereeAnonId: body.anonId })
      .onConflictDoNothing()
      .returning({ id: baziReferralRedemption.id });
    if (!inserted.length) {
      return Response.json({ error: "บัญชีนี้เคยใช้โค้ดแนะนำแล้ว" }, { status: 409 });
    }

    await Promise.all([
      applyLedger({
        anonId: owner[0].anonId,
        coinDelta: REWARD_REFERRER.coins,
        xpDelta: REWARD_REFERRER.xp,
        reason: "referral:inviter",
        ref: body.anonId,
      }),
      applyLedger({
        anonId: body.anonId,
        coinDelta: REWARD_REFEREE.coins,
        xpDelta: REWARD_REFEREE.xp,
        reason: "referral:referee",
        ref: body.code,
      }),
      // แต้ม Qi ตามระบบกิจกรรม: ผู้ชวนได้ referral_free +50 Qi ต่อผู้ถูกชวน 1 คน
      // (ref = anonId ผู้ถูกชวน → per_referral idempotent, สอดคล้อง unique redemption)
      earnQi(owner[0].anonId, "referral_free", body.anonId),
    ]);

    return Response.json(
      { redeemed: body.code, referrerReward: REWARD_REFERRER, refereeReward: REWARD_REFEREE },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid referral payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown referral error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
