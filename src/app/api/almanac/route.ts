/**
 * API ปฏิทินโหราศาสตร์ (ManvsDay almanac) — รองรับทุกปี + แก้ไขออนไลน์ (override)
 *
 *   GET  /api/almanac?yearBE=2569&month=1              -> JSON ปฏิทิน 1 เดือน (ใส่ override แล้ว)
 *   GET  /api/almanac?yearBE=2569&format=xlsx          -> ดาวน์โหลด Excel ทั้งปี
 *   GET  /api/almanac?checkDate=2026-06-16&checkHour=15-> ตรวจคุณภาพยามเดียว (黃道)
 *   GET  /api/almanac?meta=rules                       -> ตาราง/กฎ (day-stars, special-days) สำหรับตัวแก้
 *   PUT  /api/almanac    body {kind,groupKey,itemKey,text}     -> บันทึก override
 *   DELETE /api/almanac?kind=&groupKey=&itemKey=               -> ลบ override
 *
 * override reuse ตาราง bazi_knowledge_override (kind = almanac-day | almanac-rule)
 */
import { buildAlmanacMonth, checkHour } from "@/lib/bazi/almanac/almanac-engine";
import { buildAlmanacWorkbook } from "@/lib/bazi/almanac/almanac-xlsx";
import {
  createDbAlmanacOverrideRepository,
  EMPTY_ALMANAC_OVERRIDES,
  ALMANAC_KIND_DAY,
  ALMANAC_KIND_RULE,
  type AlmanacOverrides,
} from "@/lib/bazi/almanac/almanac-override-repository";

export const runtime = "nodejs";

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

function authorized(req: Request): boolean {
  const expected = process.env.ADMIN_DOCTRINE_TOKEN?.trim();
  if (!expected) return true; // ไม่ตั้ง token = อนุญาต (dev)
  return req.headers.get("x-admin-token")?.trim() === expected;
}

/** โหลด override จาก DB — ถ้า DB ใช้ไม่ได้ คืนกฎฐาน (ปฏิทินยังทำงาน) */
async function loadOverrides(): Promise<AlmanacOverrides> {
  try {
    return await createDbAlmanacOverrideRepository().load();
  } catch {
    return EMPTY_ALMANAC_OVERRIDES;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // ตรวจยามเดียว
  const checkDate = url.searchParams.get("checkDate");
  if (checkDate) {
    const [y, m, d] = checkDate.split("-").map(Number);
    const hour = Number(url.searchParams.get("checkHour") ?? "0");
    if (![y, m, d].every(Number.isInteger) || !Number.isInteger(hour) || hour < 0 || hour > 23) {
      return badRequest("รูปแบบ checkDate=YYYY-MM-DD และ checkHour=0–23");
    }
    return Response.json(checkHour(y, m, d, hour));
  }

  // ตาราง/กฎ สำหรับตัวแก้
  if (url.searchParams.get("meta") === "rules") {
    const ov = await loadOverrides();
    return Response.json({ dayStars: ov.dayStars, specialDays: ov.specialDays });
  }

  const yearBE = Number(url.searchParams.get("yearBE"));
  if (!Number.isInteger(yearBE) || yearBE < 2400 || yearBE > 2700) {
    return badRequest("ระบุปี พ.ศ. ระหว่าง 2400–2700");
  }

  const overrides = await loadOverrides();

  if (url.searchParams.get("format") === "xlsx") {
    const buffer = await buildAlmanacWorkbook(yearBE, overrides);
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
  const data = buildAlmanacMonth(yearBE - 543, month, overrides);
  return Response.json(data);
}

const ALLOWED_KINDS = new Set([ALMANAC_KIND_DAY, ALMANAC_KIND_RULE]);

export async function PUT(req: Request) {
  if (!authorized(req)) return badRequest("ไม่ได้รับอนุญาต", 401);
  let body: { kind?: string; groupKey?: string; itemKey?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("body ต้องเป็น JSON");
  }
  const { kind, groupKey, itemKey, text } = body;
  if (!kind || !ALLOWED_KINDS.has(kind) || !groupKey || !itemKey || typeof text !== "string") {
    return badRequest("ต้องมี kind (almanac-day|almanac-rule), groupKey, itemKey, text");
  }
  try {
    await createDbAlmanacOverrideRepository().upsert(kind, groupKey, itemKey, text);
  } catch (err) {
    return badRequest(`บันทึกไม่สำเร็จ: ${err instanceof Error ? err.message : "DB error"}`, 500);
  }
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!authorized(req)) return badRequest("ไม่ได้รับอนุญาต", 401);
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const groupKey = url.searchParams.get("groupKey");
  const itemKey = url.searchParams.get("itemKey");
  if (!kind || !ALLOWED_KINDS.has(kind) || !groupKey || !itemKey) {
    return badRequest("ต้องมี kind, groupKey, itemKey");
  }
  try {
    await createDbAlmanacOverrideRepository().remove(kind, groupKey, itemKey);
  } catch (err) {
    return badRequest(`ลบไม่สำเร็จ: ${err instanceof Error ? err.message : "DB error"}`, 500);
  }
  return Response.json({ ok: true });
}
