/**
 * GET    /api/reading/newdata-reading/pdf-versions/[id] — โหลดเวอร์ชัน PDF (edits ครบ) เพื่อกู้คืน
 * DELETE /api/reading/newdata-reading/pdf-versions/[id] — ลบเวอร์ชัน
 */
import {
  getNewdataPdfVersion,
  removeNewdataPdfVersion,
} from "@/lib/bazi/newdata-reading-pdf-versions";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const version = await getNewdataPdfVersion(id);
    if (!version) return Response.json({ error: "ไม่พบเวอร์ชันนี้" }, { status: 404 });
    return Response.json({ version });
  } catch (error) {
    return Response.json({ error: (error as Error).message ?? "โหลดไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await removeNewdataPdfVersion(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message ?? "ลบไม่สำเร็จ" }, { status: 500 });
  }
}
