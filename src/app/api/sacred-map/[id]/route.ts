/**
 * Sacred Map — single place (public, verified only)
 *   GET /api/sacred-map/:id → { ok, location } | 404
 * ใช้โดยหน้าแชร์สาธารณะ /p/[id] (ไม่ต้องล็อกอิน) เพื่อสร้าง rich link preview (LINE/FB)
 */
import { getPublicBySlugOrId } from "@/lib/bazi/sacred-map/repository";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id || !id.trim()) return Response.json({ error: { message: "id is required" } }, { status: 400 });
  try {
    const location = await getPublicBySlugOrId(id.trim());
    if (!location) return Response.json({ error: { message: "ไม่พบสถานที่" } }, { status: 404 });
    return Response.json({ ok: true, location });
  } catch (error) {
    console.error("[sacred-map] GET by id failed:", error);
    return Response.json({ error: { message: "โหลดไม่สำเร็จ" } }, { status: 500 });
  }
}
