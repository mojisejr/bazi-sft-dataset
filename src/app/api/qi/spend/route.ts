import { z, ZodError } from "zod";

import { levelOfXp } from "@/lib/bazi/manifest/ledger";
import { spendQi, QiError } from "@/lib/bazi/qi/engine";

export const runtime = "nodejs";

/**
 * /api/qi/spend — ใช้แต้มแลกสิทธิ์ (spend/redeem).
 *   POST { anonId, code, ref? } → หัก Qi + มอบสิทธิ์จริง; แต้มไม่พอ → 409; grant ล้ม → refund + 500
 */

const PostSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  code: z.string().trim().min(1).max(64),
  ref: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());
    const result = await spendQi(body.anonId, body.code, body.ref ?? null);
    return Response.json(
      {
        anonId: body.anonId,
        code: result.code,
        spentQi: result.qi,
        grant: result.grant,
        ...result.balance,
        ...levelOfXp(result.balance.xp),
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid qi spend payload.", details: error.issues }, { status: 400 });
    }
    if (error instanceof QiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown qi spend error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
