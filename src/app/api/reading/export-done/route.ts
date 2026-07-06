import { createExportDoneReadingsHandler } from "@/lib/bazi/reading-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/reading/export-done — ดาวน์โหลด dataset ของดวงที่ mark "เสร็จสิ้น" ทั้งหมด (ไปเทรน)
export const GET = createExportDoneReadingsHandler({});
