import { and, eq } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziLedgerTxn, baziReferralRedemption } from "@/db/schema";
import { applyLedger, getWallet, levelOfXp } from "@/lib/bazi/manifest/ledger";
import { earnQi, QiError } from "@/lib/bazi/qi/engine";

export const runtime = "nodejs";

/**
 * /api/qi/grant — เครดิตชี่ที่มาจาก "เงิน" (ซื้อแพ็กชี่ผ่าน Omise ฝั่ง mootech-fe) และ trigger
 * โบนัสผู้ชวนเมื่อผู้ถูกชวนอัปเกรด PLUS/PRO. ป้องกันด้วย secret (fail-closed: ไม่ตั้ง QI_GRANT_SECRET =
 * endpoint นี้ไม่มีอยู่) — เพราะต่างจาก earn/spend ที่ผู้ใช้เรียกเองได้ เส้นนี้ห้ามใครเรียกเอง.
 *   POST { secret, anonId, kind: "qi"|"plus"|"pro", qi?, reason?, ref? }
 *     kind="qi"        → บวก qi เข้า ledger (reason = qi:buy:<reason>, ref = charge_id → idempotent)
 *                        + ครั้งแรกตลอดชีพโบนัส first_buy_bonus +30 (bazi_qi_claim กันซ้ำเอง)
 *     kind="plus"|"pro" → ไม่มีชี่ตรง ๆ; ถ้าผู้ซื้อเคยใช้โค้ดผู้ชวน → ผู้ชวนได้ referral_plus/referral_pro
 *                        (per_referral idempotent ต่อผู้ซื้อ 1 คน ตาม catalog)
 *   ref (charge_id) ทำ idempotency: ถ้า ledger มีแถว reason+ref เดิม → ตอบ alreadyGranted ไม่บวกซ้ำ
 */

const PostSchema = z.object({
  secret: z.string().trim().min(1),
  anonId: z.string().trim().min(1).max(128),
  kind: z.enum(["qi", "plus", "pro"]),
  qi: z.number().int().positive().max(100000).optional(),
  reason: z.string().trim().min(1).max(64).optional(),
  ref: z.string().trim().min(1).max(200).optional(),
});

const REFERRAL_CODE_BY_KIND = { plus: "referral_plus", pro: "referral_pro" } as const;

export async function POST(request: Request) {
  let body: z.infer<typeof PostSchema>;
  try {
    body = PostSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid qi grant payload.", details: error.issues }, { status: 400 });
    }
    return Response.json({ error: "Invalid qi grant payload." }, { status: 400 });
  }

  // 🔴 fail-closed เหมือน CRON_SECRET: ไม่ตั้ง env = ไม่มีทางเครดิตได้เลย
  const secret = process.env.QI_GRANT_SECRET;
  if (!secret || body.secret !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    if (body.kind === "qi") {
      if (!body.qi || body.qi <= 0) {
        return Response.json({ error: "qi is required for kind=qi." }, { status: 400 });
      }
      if (!body.ref) {
        return Response.json({ error: "ref (charge_id) is required for kind=qi." }, { status: 400 });
      }
      const reason = `qi:buy:${body.reason ?? "pack"}`;

      // idempotency ชั้นแรกที่นี่ (ชั้นจริงคือ settleAndProvision ที่ arbiter ด้วย DB แล้ว):
      // webhook ซ้ำที่หลุดผ่าน settle มาอีกรอบ ต้องไม่บวกชี่ซ้ำ
      const db = createDbClient();
      const existing = await db
        .select({ id: baziLedgerTxn.id })
        .from(baziLedgerTxn)
        .where(and(eq(baziLedgerTxn.reason, reason), eq(baziLedgerTxn.ref, body.ref)))
        .limit(1);
      if (existing.length) {
        return Response.json(
          { anonId: body.anonId, alreadyGranted: true, ...levelOfXp((await getWallet(body.anonId)).xp) },
          { status: 200 },
        );
      }

      let balance = await applyLedger({
        anonId: body.anonId,
        qiDelta: body.qi,
        reason,
        ref: body.ref,
      });
      if (!balance) throw new QiError("บันทึกแต้มไม่สำเร็จ", 500);

      // โบนัสซื้อครั้งแรก — earnQi capped เอง ถ้าเคยรับแล้ว (ไม่ throw);
      // ใช้ยอดหลังโบนัสตอบกลับ ไม่ใช่ยอดก่อนโบนัส
      let firstBuyBonus = false;
      try {
        const bonus = await earnQi(body.anonId, "first_buy_bonus");
        firstBuyBonus = bonus.awarded;
        if (bonus.awarded) balance = bonus.balance;
      } catch {
        firstBuyBonus = false;
      }

      return Response.json(
        { anonId: body.anonId, alreadyGranted: false, firstBuyBonus, grantedQi: body.qi, ...balance, ...levelOfXp(balance.xp) },
        { status: 200 },
      );
    }

    // kind = plus | pro — trigger โบนัสผู้ชวนตาม catalog (ref = ผู้ซื้อ, idempotent ต่อผู้ซื้อ 1 คน)
    const db = createDbClient();
    const redemption = await db
      .select({ referrerAnonId: baziReferralRedemption.referrerAnonId })
      .from(baziReferralRedemption)
      .where(eq(baziReferralRedemption.refereeAnonId, body.anonId))
      .limit(1);

    if (!redemption.length) {
      return Response.json({ anonId: body.anonId, referralRewarded: false, referrer: null }, { status: 200 });
    }
    const result = await earnQi(redemption[0].referrerAnonId, REFERRAL_CODE_BY_KIND[body.kind], body.anonId);
    return Response.json(
      { anonId: body.anonId, referralRewarded: result.awarded, referrer: redemption[0].referrerAnonId },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof QiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown qi grant error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
