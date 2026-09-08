/**
 * GET /api/manifest/photo/<id>?anonId=... — เสิร์ฟรูป manifest จากฐานข้อมูล (bazi_manifest_photo).
 * decode base64 → คืนไบต์รูปพร้อม content-type. สโคปด้วย anonId (รูปเป็นของเจ้าของเท่านั้น) เมื่อส่งมา.
 */
import { and, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziManifestPhoto } from "@/db/schema";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return Response.json({ error: "id ไม่ถูกต้อง" }, { status: 400 });

    const anonId = new URL(request.url).searchParams.get("anonId")?.trim() || "";
    const db = createDbClient();
    const where = anonId
      ? and(eq(baziManifestPhoto.id, id), eq(baziManifestPhoto.anonId, anonId))
      : eq(baziManifestPhoto.id, id);
    const [row] = await db
      .select({ imageBase64: baziManifestPhoto.imageBase64, mime: baziManifestPhoto.mime })
      .from(baziManifestPhoto)
      .where(where)
      .limit(1);

    if (!row) return Response.json({ error: "ไม่พบรูป" }, { status: 404 });

    const buf = Buffer.from(row.imageBase64, "base64");
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": row.mime || "image/jpeg",
        // รูปไม่เปลี่ยน (id ใหม่ทุกครั้งที่อัปโหลด) → cache ยาวได้ และเป็นของส่วนตัวจึง private
        "Cache-Control": "private, max-age=86400, immutable",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown photo error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
