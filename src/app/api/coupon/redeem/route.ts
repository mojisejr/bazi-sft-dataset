// /api/coupon/redeem (#2 คูปอง Phase 2) — user แลกโค้ดคูปองกิจกรรม → รับรางวัล (QI/เครดิต/tier).
//   POST { anonId, code } → { ok, reward, qi? } | { ok:false, reason }
// public เหมือน /api/qi/earn (ไม่มี secret) — กันรับซ้ำอยู่ที่ตาราง (1 คูปอง/บัญชี). FE BFF ส่ง anonId จาก cookie.
import { z, ZodError } from "zod";

import { redeemCoupon } from "@/lib/bazi/qi/coupon";

export const runtime = "nodejs";

const PostSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  code: z.string().trim().min(1).max(64),
});

const REASON_MSG: Record<string, string> = {
  NOT_FOUND: "ไม่พบโค้ดนี้",
  INACTIVE: "โค้ดนี้ถูกปิดใช้งาน",
  WINDOW: "โค้ดนี้ยังไม่เริ่ม หรือหมดอายุแล้ว",
  ALREADY: "คุณใช้โค้ดนี้ไปแล้ว",
  CAPPED: "โค้ดนี้ถูกใช้ครบจำนวนแล้ว",
  GRANT_FAILED: "มอบรางวัลไม่สำเร็จ ลองใหม่อีกครั้ง",
};

export async function POST(request: Request) {
  let body: z.infer<typeof PostSchema>;
  try {
    body = PostSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid payload." }, { status: 400 });
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }
  try {
    const result = await redeemCoupon(body.anonId, body.code);
    if (!result.ok) {
      return Response.json({ ok: false, reason: result.reason, message: REASON_MSG[result.reason] ?? "ใช้โค้ดไม่สำเร็จ" }, { status: 200 });
    }
    return Response.json({ ok: true, reward: result.reward, ...(typeof result.qi === "number" ? { qi: result.qi } : {}) }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "coupon redeem error" }, { status: 500 });
  }
}
