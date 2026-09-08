/**
 * POST /api/manifest/photo — อัปโหลดรูปที่ผู้ใช้แนบกับ manifest ขึ้น Supabase (public) แล้วคืน URL
 * Body: { anonId, imageBase64 (data URL หรือ base64 ล้วน), mime? }
 * → { url } (public URL เก็บลง goal.imageUrl). resize/ย่อขนาดทำฝั่ง client ก่อนส่งมา.
 */
import crypto from "node:crypto";
import { z, ZodError } from "zod";

import { ensureManifestBucket, isSupabaseConfigured, uploadManifestImage } from "@/lib/supabase/storage";

export const runtime = "nodejs";

const Schema = z.object({
  anonId: z.string().trim().min(1).max(128),
  imageBase64: z.string().min(1),
  mime: z.string().trim().max(100).default("image/jpeg"),
});

// กันรูปใหญ่เกิน (ควรย่อฝั่ง client แล้ว) — 6MB หลัง decode
const MAX_BYTES = 6 * 1024 * 1024;
// anonId ต้อง path-safe (กัน traversal ใน object key)
const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return Response.json({ error: "Supabase ยังไม่ได้ตั้งค่า (SUPABASE_URL/SERVICE_ROLE_KEY)" }, { status: 503 });
    }
    const body = Schema.parse(await request.json());
    if (!SAFE_ID.test(body.anonId)) {
      return Response.json({ error: "anonId ไม่ถูกต้อง" }, { status: 400 });
    }
    const b64 = body.imageBase64.replace(/^data:[^;]+;base64,/, "");
    const buf = Buffer.from(b64, "base64");
    if (buf.length === 0) return Response.json({ error: "รูปว่างเปล่า" }, { status: 400 });
    if (buf.length > MAX_BYTES) return Response.json({ error: "รูปใหญ่เกินไป (ย่อขนาดก่อนอัปโหลด)" }, { status: 413 });

    await ensureManifestBucket();
    const objectKey = `${body.anonId}/${crypto.randomUUID()}`;
    const url = await uploadManifestImage(objectKey, buf, body.mime);
    return Response.json({ url }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid photo payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown photo error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
