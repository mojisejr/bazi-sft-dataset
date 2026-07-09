/**
 * GET    /api/reading/newdata-reading/sessions/[id] — โหลดดวงที่บันทึก (birth + edits ครบ)
 * PATCH  /api/reading/newdata-reading/sessions/[id] — สลับสถานะ (in_progress ↔ done)
 * DELETE /api/reading/newdata-reading/sessions/[id] — ลบ
 */
import { createDbNewdataReadingRepository } from "@/lib/bazi/newdata-reading-repository";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await createDbNewdataReadingRepository().get(id);
    if (!row) return Response.json({ error: "ไม่พบดวงนี้" }, { status: 404 });
    return Response.json({ reading: row });
  } catch (error) {
    return Response.json({ error: (error as Error).message ?? "โหลดไม่สำเร็จ" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = (await req.json()) as { status?: unknown };
    if (body.status !== "in_progress" && body.status !== "done") {
      return Response.json({ error: "status ต้องเป็น in_progress หรือ done" }, { status: 400 });
    }
    await createDbNewdataReadingRepository().setStatus(id, body.status);
    return Response.json({ ok: true, status: body.status });
  } catch (error) {
    return Response.json({ error: (error as Error).message ?? "อัปเดตไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await createDbNewdataReadingRepository().remove(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message ?? "ลบไม่สำเร็จ" }, { status: 500 });
  }
}
