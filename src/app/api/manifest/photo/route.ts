/**
 * POST /api/manifest/photo — เก็บรูปที่ผู้ใช้แนบกับ manifest ลง "ฐานข้อมูลเดียวกับการ์ด" (Neon,
 * ตาราง bazi_manifest_photo) ไม่ใช่ Supabase Storage. คืน { id } ให้เอาไปประกอบเป็น URL เสิร์ฟรูป
 * (/api/manifest/photo/<id>) แล้วเก็บลง goal.imageUrl.
 * Body: { anonId, imageBase64 (data URL หรือ base64 ล้วน), mime? }
 * resize/ย่อขนาดทำฝั่ง client ก่อนส่งมา (~1080px JPEG) จึงเก็บเป็น base64 ในคอลัมน์ text ได้.
 */
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziManifestPhoto } from "@/db/schema";

export const runtime = "nodejs";

const Schema = z.object({
  anonId: z.string().trim().min(1).max(128),
  imageBase64: z.string().min(1),
  mime: z.string().trim().max(100).default("image/jpeg"),
});

// กันรูปใหญ่เกิน (ควรย่อฝั่ง client แล้ว) — 6MB หลัง decode
const MAX_BYTES = 6 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const body = Schema.parse(await request.json());
    const b64 = body.imageBase64.replace(/^data:[^;]+;base64,/, "");
    const buf = Buffer.from(b64, "base64");
    if (buf.length === 0) return Response.json({ error: "รูปว่างเปล่า" }, { status: 400 });
    if (buf.length > MAX_BYTES) return Response.json({ error: "รูปใหญ่เกินไป (ย่อขนาดก่อนอัปโหลด)" }, { status: 413 });

    const db = createDbClient();
    const [row] = await db
      .insert(baziManifestPhoto)
      .values({ anonId: body.anonId, imageBase64: b64, mime: body.mime })
      .returning({ id: baziManifestPhoto.id });

    // คืนทั้ง id และ path เสิร์ฟ (BFF ฝั่ง FE จะ map เป็น URL ที่เบราว์เซอร์โหลดได้อีกที)
    return Response.json({ id: row.id, url: `/api/manifest/photo/${row.id}` }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid photo payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown photo error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
