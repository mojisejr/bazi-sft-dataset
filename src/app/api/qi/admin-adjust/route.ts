import { z, ZodError } from "zod";

import { applyLedger, getWallet } from "@/lib/bazi/manifest/ledger";

export const runtime = "nodejs";

/**
 * /api/qi/admin-adjust — แอดมิน (/ops) เพิ่ม/ลด QI ของผู้ใช้ด้วยมือ. secret-gated (OPS_ADMIN_SECRET)
 * fail-closed เหมือน /api/qi/grant: ไม่ตั้ง env = endpoint นี้ไม่มีอยู่. ห้ามผู้ใช้เรียกเอง.
 *   POST { secret, anonId, qiDelta (±), note?, ref }
 *     qiDelta > 0 = เติม · < 0 = หัก (applyLedger กันยอดติดลบเอง → คืน 409 ถ้าหักเกินยอด)
 *     ref = ops-op-id (idempotency ควรไม่ซ้ำต่อ 1 การกระทำ; ไม่บังคับ dedup ที่นี่ — /ops คุม)
 */
const PostSchema = z.object({
  secret: z.string().trim().min(1),
  anonId: z.string().trim().min(1).max(128),
  qiDelta: z.number().int().refine((n) => n !== 0, "qiDelta ห้ามเป็น 0").refine((n) => Math.abs(n) <= 100000, "|qiDelta| ต้อง ≤ 100000"),
  note: z.string().trim().max(200).optional(),
  ref: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  let body: z.infer<typeof PostSchema>;
  try {
    body = PostSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid admin-adjust payload.", details: error.issues }, { status: 400 });
    }
    return Response.json({ error: "Invalid admin-adjust payload." }, { status: 400 });
  }

  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || body.secret !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const reason = `qi:ops:adjust${body.note ? `:${body.note}` : ""}`.slice(0, 64);
    const balance = await applyLedger({ anonId: body.anonId, qiDelta: body.qiDelta, reason, ref: body.ref });
    if (!balance) {
      // applyLedger คืน null เมื่อยอดจะติดลบ (หักเกิน) — คืนยอดปัจจุบันให้ /ops โชว์
      const cur = await getWallet(body.anonId);
      return Response.json({ error: "หัก QI เกินยอดคงเหลือ", qi: cur.qi }, { status: 409 });
    }
    return Response.json({ anonId: body.anonId, qiDelta: body.qiDelta, ...balance }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown admin-adjust error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
