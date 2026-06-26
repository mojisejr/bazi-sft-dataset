/**
 * GET  /api/reading/newdata-reading/sessions — รายการดวงที่บันทึก (id, ชื่อ, วันเกิด, แก้ล่าสุด)
 * POST /api/reading/newdata-reading/sessions — บันทึก (สร้างใหม่ หรืออัปเดตถ้าส่ง id)
 */
import { createDbNewdataReadingRepository } from "@/lib/bazi/newdata-reading-repository";
import type { NewdataReadingEdits } from "@/db/schema";

export const runtime = "nodejs";

export async function GET() {
  try {
    const items = await createDbNewdataReadingRepository().list();
    return Response.json({ items });
  } catch (error) {
    return Response.json({ error: (error as Error).message ?? "โหลดไม่สำเร็จ" }, { status: 500 });
  }
}

type SaveBody = {
  id?: string;
  clientName?: string;
  birthDate?: string;
  birthTime?: string;
  gender?: string;
  province?: string;
  edits?: NewdataReadingEdits;
  /** false = บันทึกแบบไม่สร้างจุดประวัติ (autosave). default true (กดบันทึกเอง) */
  createRevision?: boolean;
};

export async function POST(request: Request) {
  let body: SaveBody;
  try {
    body = (await request.json()) as SaveBody;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.birthDate || !body.birthTime || !body.gender) {
    return Response.json({ error: "ต้องมีวันเกิด เวลา เพศ" }, { status: 400 });
  }
  try {
    const row = await createDbNewdataReadingRepository().save({
      id: body.id,
      clientName: body.clientName ?? null,
      birthDate: body.birthDate,
      birthTime: body.birthTime,
      gender: body.gender,
      province: body.province ?? null,
      edits: body.edits ?? {},
      createRevision: body.createRevision,
    });
    return Response.json({ id: row.id, updatedAt: row.updatedAt });
  } catch (error) {
    return Response.json({ error: (error as Error).message ?? "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
