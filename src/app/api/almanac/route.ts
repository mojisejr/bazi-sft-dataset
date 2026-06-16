/**
 * API ปฏิทินโหราศาสตร์ (ManvsDay almanac) — รองรับทุกปี (อดีต/อนาคต)
 *
 *   GET /api/almanac?yearBE=2569&month=1                 -> JSON ปฏิทิน 1 เดือน
 *   GET /api/almanac?yearBE=2569&format=xlsx             -> ดาวน์โหลดไฟล์ Excel ทั้งปี
 *   GET /api/almanac?checkDate=2026-06-16&checkHour=15   -> ตรวจคุณภาพยามเดียว (黃道)
 */
import { buildAlmanacMonth, checkHour } from "@/lib/bazi/almanac/almanac-engine";
import { buildAlmanacWorkbook } from "@/lib/bazi/almanac/almanac-xlsx";

export const runtime = "nodejs";

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // ตรวจยามเดียว: checkDate=YYYY-MM-DD (ค.ศ.) & checkHour=0..23
  const checkDate = url.searchParams.get("checkDate");
  if (checkDate) {
    const [y, m, d] = checkDate.split("-").map(Number);
    const hour = Number(url.searchParams.get("checkHour") ?? "0");
    if (![y, m, d].every(Number.isInteger) || !Number.isInteger(hour) || hour < 0 || hour > 23) {
      return badRequest("รูปแบบ checkDate=YYYY-MM-DD และ checkHour=0–23");
    }
    return Response.json(checkHour(y, m, d, hour));
  }

  const yearBE = Number(url.searchParams.get("yearBE"));
  if (!Number.isInteger(yearBE) || yearBE < 2400 || yearBE > 2700) {
    return badRequest("ระบุปี พ.ศ. ระหว่าง 2400–2700");
  }

  if (url.searchParams.get("format") === "xlsx") {
    const buffer = await buildAlmanacWorkbook(yearBE);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="almanac-${yearBE}.xlsx"`,
      },
    });
  }

  const month = Number(url.searchParams.get("month") ?? "1");
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return badRequest("ระบุเดือน 1–12");
  }
  const data = buildAlmanacMonth(yearBE - 543, month);
  return Response.json(data);
}
