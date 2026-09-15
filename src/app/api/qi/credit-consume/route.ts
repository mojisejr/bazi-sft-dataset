import { z, ZodError } from "zod";

import { consumeCredit } from "@/lib/bazi/qi/entitlements";

export const runtime = "nodejs";

/**
 * /api/qi/credit-consume — หัก credit 1 หน่วยตาม kind (credit-only, ไม่แตะ QI/ฟรี).
 * ใช้กับ lane ที่ FE คุมเอง (เช่น ดูเบอร์/รังผึ้ง: เช็ค credit ก่อนหัก QI) — เรียกหลังทำสำเร็จ, best-effort.
 *   POST { anonId, kind } → { ok, remaining }  · ok:false (402) = ไม่มี credit เหลือ
 */
const KINDS = ["card_use", "chat_question", "matching_slot", "phone_reading", "honeycomb_reading"] as const;
const PostSchema = z.object({ anonId: z.string().trim().min(1).max(128), kind: z.enum(KINDS) });

export async function POST(request: Request) {
  try {
    const { anonId, kind } = PostSchema.parse(await request.json());
    const remaining = await consumeCredit(anonId, kind);
    return Response.json({ ok: remaining !== null, remaining: remaining ?? 0 }, { status: remaining !== null ? 200 : 402 });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid payload.", details: error.issues }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "credit-consume error" }, { status: 500 });
  }
}
