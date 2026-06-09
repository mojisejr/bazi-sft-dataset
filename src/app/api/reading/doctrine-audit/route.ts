import { z } from "zod";

import {
  createDbDoctrineAuditRepository,
  type DoctrineAuditSurface,
} from "@/lib/bazi/doctrine-audit-repository";
import { restoreDoctrineAudit } from "@/lib/bazi/doctrine-audit.service";

export const runtime = "nodejs";

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

function authorized(req: Request): boolean {
  const expected = process.env.ADMIN_DOCTRINE_TOKEN?.trim();
  if (!expected) {
    return true;
  }
  return req.headers.get("x-admin-token")?.trim() === expected;
}

/** GET — ประวัติการแก้ (ล่าสุดก่อน) ?surface=&key=&limit= */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return badRequest("unauthorized", 401);
  }
  const url = new URL(req.url);
  const surfaceRaw = url.searchParams.get("surface")?.trim();
  const surface =
    surfaceRaw === "topic" || surfaceRaw === "config" ? (surfaceRaw as DoctrineAuditSurface) : undefined;
  const entityKey = url.searchParams.get("key")?.trim() || undefined;
  const limit = Number(url.searchParams.get("limit") ?? "100");

  try {
    const rows = await createDbDoctrineAuditRepository().list({
      surface,
      entityKey,
      limit: Number.isFinite(limit) ? limit : 100,
    });
    return Response.json({ rows });
  } catch {
    // ตาราง audit ยังไม่ถูกสร้าง/DB ล่ม → คืนว่าง (ไม่ให้ UI พัง)
    return Response.json({ rows: [] });
  }
}

const RestoreSchema = z.object({
  id: z.string().trim().min(1),
  actor: z.string().trim().min(1).max(120).optional(),
});

/** POST — restore: นำค่าตามประวัติ id หนึ่งกลับมาใช้ */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return badRequest("unauthorized", 401);
  }
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }
  const parsed = RestoreSchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload.");
  }
  try {
    const repo = createDbDoctrineAuditRepository();
    const row = await repo.getById(parsed.data.id);
    if (!row) {
      return badRequest("ไม่พบรายการประวัติที่ระบุ", 404);
    }
    const result = await restoreDoctrineAudit(row, parsed.data.actor ?? "ซินแส (online)");
    if (!result.ok) {
      return badRequest(result.message);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "restore ไม่สำเร็จ", 500);
  }
}
