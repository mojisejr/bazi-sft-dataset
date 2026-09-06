import { z, ZodError } from "zod";

import { consumeUse, type QuotaFeature } from "@/lib/bazi/qi/quota";

export const runtime = "nodejs";

/**
 * /api/qi/feature-consume — หักสิทธิ์ใช้ฟีเจอร์ 1 ครั้ง (ฟรีวันนี้ → credit → หัก QI).
 *   POST { anonId, feature } → ConsumeResult (ok/source/cost). ok:false = ชี่ไม่พอ (402).
 * ใช้กับ lane ที่หักหลังทำสำเร็จ (แชท) — เรียกหลังได้คำตอบครบ (best-effort).
 */

const PostSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  feature: z.enum(["card", "chat"]),
});

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());
    const result = await consumeUse(body.anonId, body.feature as QuotaFeature);
    return Response.json(result, { status: result.ok ? 200 : 402 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid feature-consume payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown feature-consume error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
