import { z, ZodError } from "zod";

import { consumeCredit } from "@/lib/bazi/qi/entitlements";

export const runtime = "nodejs";

/**
 * /api/qi/matching-consume — หัก matching_slot credit 1 หน่วย (สำหรับดวงสมพงศ์เมื่อโควตา tier รายเดือนหมด).
 * เรียกโดย FE (calculate-flow) หลังคำนวณสำเร็จและดึงจาก credit. credit-only (ไม่แตะ QI/ฟรี).
 *   POST { anonId } → { ok, remaining }  · ok:false (402) = ไม่มี credit เหลือ
 */
const PostSchema = z.object({ anonId: z.string().trim().min(1).max(128) });

export async function POST(request: Request) {
  try {
    const { anonId } = PostSchema.parse(await request.json());
    const remaining = await consumeCredit(anonId, "matching_slot");
    return Response.json({ ok: remaining !== null, remaining: remaining ?? 0 }, { status: remaining !== null ? 200 : 402 });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "matching-consume error" }, { status: 500 });
  }
}
