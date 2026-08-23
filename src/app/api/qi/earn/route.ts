import { z, ZodError } from "zod";

import { earnQi, QiError } from "@/lib/bazi/qi/engine";
import { levelOfXp } from "@/lib/bazi/manifest/ledger";

export const runtime = "nodejs";

/**
 * /api/qi/earn — จ่ายแต้มเส้นได้แต้ม (earn).
 *   POST { anonId, code, ref? } → { code, awarded, qi, capped, qi:ยอดใหม่, ... }
 * จ่ายซ้ำในรอบเดิมไม่ได้ (capped=true). ref จำเป็นเฉพาะเส้น per_referral (id ผู้ถูกชวน).
 */

const PostSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  code: z.string().trim().min(1).max(64),
  ref: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());
    const result = await earnQi(body.anonId, body.code, body.ref ?? null);
    return Response.json(
      {
        anonId: body.anonId,
        code: result.code,
        awarded: result.awarded,
        capped: result.capped,
        earnedQi: result.qi,
        ...result.balance,
        ...levelOfXp(result.balance.xp),
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid qi earn payload.", details: error.issues }, { status: 400 });
    }
    if (error instanceof QiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown qi earn error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
