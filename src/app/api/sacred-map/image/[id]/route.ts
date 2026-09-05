/**
 * Sacred Map — เสิร์ฟรูปสถานที่ (bytes) จาก DB (image_base64) เอง ไม่พึ่ง Supabase
 *   GET /api/sacred-map/image/<id> → image bytes | 302 ไป imageUrl (ถ้ามีแต่ไม่มี base64) | 404
 */
import { getById } from "@/lib/bazi/sacred-map/repository";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getById(id).catch(() => null);
  if (!row) return Response.json({ error: "ไม่พบสถานที่" }, { status: 404 });
  if (row.imageBase64) {
    const buf = Buffer.from(row.imageBase64, "base64");
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": row.imageMime || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }
  // ยังไม่มี base64 แต่มี URL เดิม (Supabase) → redirect (prod ที่ resolve ได้จะโหลดได้)
  if (row.imageUrl) return Response.redirect(row.imageUrl, 302);
  return Response.json({ error: "ยังไม่มีรูป" }, { status: 404 });
}
