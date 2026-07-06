/**
 * Sacred Map — admin API (แอดมินจัดการสถานที่ + verify)
 *   GET            → ทุกสถานที่ทุกสถานะ
 *   POST           → สร้างสถานที่ (verified/admin โดยดีฟอลต์)
 *   PUT   { id, ...input }   → แก้ไขสถานที่
 *   PATCH { id, status }     → เปลี่ยนสถานะ (verified/pending/rejected)
 *   DELETE ?id=              → ลบ
 * auth: x-admin-token = ADMIN_DOCTRINE_TOKEN (ถ้าไม่ตั้ง env → เปิดให้ทุกคน เหมือน matching)
 */
import { SACRED_STATUSES, SacredLocationInputSchema } from "@/lib/bazi/sacred-map/constants";
import type { SacredStatus } from "@/lib/bazi/sacred-map/constants";
import {
  createLocation,
  deleteLocation,
  listAll,
  setStatus,
  updateLocation,
} from "@/lib/bazi/sacred-map/repository";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const expected = process.env.ADMIN_DOCTRINE_TOKEN?.trim();
  if (!expected) return true;
  return req.headers.get("x-admin-token")?.trim() === expected;
}

function unauthorized() {
  return Response.json({ error: { message: "unauthorized" } }, { status: 401 });
}

export async function GET(req: Request) {
  if (!authorized(req)) return unauthorized();
  try {
    const locations = await listAll();
    return Response.json({ ok: true, locations });
  } catch (error) {
    return Response.json({ ok: true, locations: [], unavailable: true, message: String(error) });
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) return unauthorized();
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: { message: "invalid json" } }, { status: 400 });
  }
  const parsed = SacredLocationInputSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: { message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" } }, { status: 400 });
  }
  try {
    const location = await createLocation(parsed.data, { status: "verified", source: "admin" });
    return Response.json({ ok: true, location });
  } catch (error) {
    return Response.json({ error: { message: (error as Error).message ?? "save failed" } }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!authorized(req)) return unauthorized();
  let payload: { id?: unknown };
  try {
    payload = (await req.json()) as { id?: unknown };
  } catch {
    return Response.json({ error: { message: "invalid json" } }, { status: 400 });
  }
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!id) return Response.json({ error: { message: "ต้องระบุ id" } }, { status: 400 });

  const parsed = SacredLocationInputSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: { message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" } }, { status: 400 });
  }
  try {
    const location = await updateLocation(id, parsed.data);
    if (!location) return Response.json({ error: { message: "ไม่พบสถานที่นี้" } }, { status: 404 });
    return Response.json({ ok: true, location });
  } catch (error) {
    return Response.json({ error: { message: (error as Error).message ?? "update failed" } }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!authorized(req)) return unauthorized();
  let payload: { id?: unknown; status?: unknown };
  try {
    payload = (await req.json()) as { id?: unknown; status?: unknown };
  } catch {
    return Response.json({ error: { message: "invalid json" } }, { status: 400 });
  }
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  const status = payload.status as SacredStatus;
  if (!id || !SACRED_STATUSES.includes(status)) {
    return Response.json({ error: { message: "ต้องระบุ id และ status ที่ถูกต้อง" } }, { status: 400 });
  }
  try {
    const location = await setStatus(id, status);
    if (!location) return Response.json({ error: { message: "ไม่พบสถานที่นี้" } }, { status: 404 });
    return Response.json({ ok: true, location });
  } catch (error) {
    return Response.json({ error: { message: (error as Error).message ?? "update failed" } }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!authorized(req)) return unauthorized();
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return Response.json({ error: { message: "ต้องระบุ id" } }, { status: 400 });
  try {
    const ok = await deleteLocation(id);
    if (!ok) return Response.json({ error: { message: "ไม่พบสถานที่นี้" } }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: { message: (error as Error).message ?? "delete failed" } }, { status: 500 });
  }
}
