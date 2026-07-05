/**
 * GET  /api/reading/newdata-reading/pdf-versions?readingId= — รายการเวอร์ชัน PDF ของดวง
 * POST /api/reading/newdata-reading/pdf-versions — บันทึกเวอร์ชัน PDF (สแน็ปช็อต edits ปัจจุบัน)
 */
import {
  listNewdataPdfVersions,
  saveNewdataPdfVersion,
} from "@/lib/bazi/newdata-reading-pdf-versions";
import type { NewdataReadingEdits } from "@/db/schema";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const readingId = new URL(request.url).searchParams.get("readingId");
  if (!readingId) return Response.json({ items: [] });
  try {
    return Response.json({ items: await listNewdataPdfVersions(readingId) });
  } catch (error) {
    return Response.json({ error: (error as Error).message ?? "โหลดไม่สำเร็จ" }, { status: 500 });
  }
}

type SaveBody = {
  readingId?: string;
  clientName?: string | null;
  birthDate?: string;
  birthTime?: string;
  gender?: string;
  province?: string | null;
  versionNote?: string | null;
  edits?: NewdataReadingEdits;
};

export async function POST(request: Request) {
  let body: SaveBody;
  try {
    body = (await request.json()) as SaveBody;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.readingId || !body.birthDate || !body.birthTime || !body.gender) {
    return Response.json({ error: "ต้องบันทึกดวงก่อนจึงจะบันทึกเวอร์ชัน PDF ได้" }, { status: 400 });
  }
  try {
    const { id } = await saveNewdataPdfVersion({
      readingId: body.readingId,
      clientName: body.clientName ?? null,
      birthDate: body.birthDate,
      birthTime: body.birthTime,
      gender: body.gender,
      province: body.province ?? null,
      versionNote: body.versionNote ?? null,
      edits: body.edits ?? {},
    });
    return Response.json({ id });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    const friendly = /does not exist|relation .*does not|bazi_newdata_reading_pdf_versions/.test(msg)
      ? "ยังไม่ได้เปิดใช้เวอร์ชัน PDF — รัน: npm run db:apply:newdata-reading-pdf-versions"
      : msg || "บันทึกเวอร์ชันไม่สำเร็จ";
    return Response.json({ error: friendly }, { status: 500 });
  }
}
