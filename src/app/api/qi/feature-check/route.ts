import { z, ZodError } from "zod";

import { peekUse, type QuotaFeature } from "@/lib/bazi/qi/quota";

export const runtime = "nodejs";

/**
 * /api/qi/feature-check — เช็คว่าจะใช้ฟีเจอร์ครั้งถัดไปได้ไหม โดย "ไม่หัก".
 *   POST { anonId, feature } → { affordable, nextSource, cost, freeRemaining }
 * ใช้กับ lane ที่หักหลังทำสำเร็จ (แชท) — เช็คก่อนสตรีม, หักจริงด้วย /api/qi/feature-consume.
 */

const PostSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  feature: z.enum(["card", "chat"]),
});

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());
    const result = await peekUse(body.anonId, body.feature as QuotaFeature);
    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid feature-check payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown feature-check error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
