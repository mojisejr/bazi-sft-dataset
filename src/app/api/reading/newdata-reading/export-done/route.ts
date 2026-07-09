/**
 * GET /api/reading/newdata-reading/export-done
 * ดาวน์โหลด dataset ของดวง NewData (อ่าน 15 บท) ที่ mark "เสร็จสิ้น" — recompute + overlay edits ซินแส
 */
import { collectDoneNewdataReadingsForExport } from "@/lib/bazi/newdata-reading-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await collectDoneNewdataReadingsForExport();
    return new Response(JSON.stringify({ count: items.length, items }, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="done-newdata-readings.json"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export ไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}
