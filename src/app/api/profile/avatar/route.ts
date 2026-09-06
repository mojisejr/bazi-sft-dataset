import sharp from "sharp";
import { eq } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziUserProfile } from "@/db/schema";

export const runtime = "nodejs";

/**
 * /api/profile/avatar — รูปโปรไฟล์ (edit-personal-info "เปลี่ยนรูปโปรไฟล์")
 *   GET ?anonId=            → bytes รูป (image/jpeg) | 404 ถ้ายังไม่มี
 *   POST {anonId, imageBase64, mime?} → ย่อ 256×256 (sharp, jpeg) → เก็บ base64 ใน DB
 *
 * เก็บใน DB (avatar_base64) แทน Supabase Storage — เลี่ยง dependency ภายนอกในบางสภาพแวดล้อม.
 * รูปเล็ก (~256px) จึงเหมาะกับ base64 ใน column.
 */

const AVATAR_SIZE = 256;
const AVATAR_QUALITY = 82;
/** จำกัด payload ก่อนย่อ ~8MB base64 (~6MB ไฟล์) กัน DoS */
const MAX_BASE64_LEN = 8 * 1024 * 1024;

const PostSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  imageBase64: z.string().min(1).max(MAX_BASE64_LEN),
  mime: z.string().trim().max(64).optional(),
});

export async function GET(request: Request) {
  const anonId = new URL(request.url).searchParams.get("anonId")?.trim();
  if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });
  const db = createDbClient();
  const [row] = await db
    .select({ avatarBase64: baziUserProfile.avatarBase64, avatarMime: baziUserProfile.avatarMime })
    .from(baziUserProfile)
    .where(eq(baziUserProfile.anonId, anonId))
    .limit(1);
  if (!row?.avatarBase64) return Response.json({ error: "ยังไม่มีรูปโปรไฟล์" }, { status: 404 });
  const buf = Buffer.from(row.avatarBase64, "base64");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": row.avatarMime || "image/jpeg",
      // ผู้ใช้เปลี่ยนรูปแล้วต้องเห็นทันที → ไม่แคชนาน (FE cache-bust ด้วย ?t=updatedAt อีกชั้น)
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());
    const db = createDbClient();

    const [existing] = await db
      .select({ anonId: baziUserProfile.anonId })
      .from(baziUserProfile)
      .where(eq(baziUserProfile.anonId, body.anonId))
      .limit(1);
    if (!existing) {
      return Response.json({ error: "ยังไม่มีโปรไฟล์ — ตั้ง @name ก่อน (หน้าสมัคร)" }, { status: 409 });
    }

    // strip prefix "data:image/...;base64," ถ้ามี
    const raw = body.imageBase64.replace(/^data:[^;]+;base64,/, "");
    let out: Buffer;
    try {
      out = await sharp(Buffer.from(raw, "base64"))
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" })
        .jpeg({ quality: AVATAR_QUALITY, mozjpeg: true })
        .toBuffer();
    } catch {
      return Response.json({ error: "ไฟล์รูปไม่ถูกต้อง" }, { status: 400 });
    }

    const now = new Date();
    await db
      .update(baziUserProfile)
      .set({ avatarBase64: out.toString("base64"), avatarMime: "image/jpeg", avatarUpdatedAt: now, updatedAt: now })
      .where(eq(baziUserProfile.anonId, body.anonId));

    return Response.json({ ok: true, avatarUpdatedAt: now.toISOString(), bytes: out.length }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid avatar payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown avatar error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
