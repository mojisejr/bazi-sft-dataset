import { eq } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziReferralRedemption } from "@/db/schema";
import { levelOfXp } from "@/lib/bazi/manifest/ledger";
import { earnQi, QiError } from "@/lib/bazi/qi/engine";
import { createPaidGrantSqlClient } from "@/db/paid-grant-client";
import { createPaidQiGrant, PaidQiGrantError } from "@/lib/bazi/qi/paid-grant";

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
 *   ref (charge_id) เป็น global idempotency key: transaction lock + ตรวจ payload ใน ledger
 *   wallet, purchase ledger, first-buy claim และ bonus ledger commit พร้อมกัน
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

      const result = await createPaidQiGrant(createPaidGrantSqlClient())({
        anonId: body.anonId,
        qi: body.qi,
        reason,
        ref: body.ref,
      });
      return Response.json(
        { anonId: body.anonId, ...result, ...levelOfXp(result.xp) },
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
    if (error instanceof PaidQiGrantError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof QiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    // A connection failure can follow a committed grant. Do not claim rollback,
    // expose SQL/parameters, or replay it here; the same ref can be retried safely.
    return Response.json({ error: "QI grant outcome could not be confirmed.", code: "GRANT_UNCONFIRMED" }, { status: 503 });
  }
}
