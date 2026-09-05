/**
 * Sacred Map — data access (drizzle บนตาราง bazi_sacred_map_location).
 * แอดมิน: create/update/setStatus/remove/listAll. สาธารณะ: listVerified/getById/submit/checkin.
 */
import { desc, eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import {
  baziSacredMapLocation,
  type InsertBaziSacredMapLocation,
  type SelectBaziSacredMapLocation,
} from "@/db/schema";

import type { SacredLocationInput, SacredStatus } from "./constants";

export type SacredLocationRow = SelectBaziSacredMapLocation;

function normalize(input: SacredLocationInput): Omit<InsertBaziSacredMapLocation, "id"> {
  const clean = (v: string | null | undefined) => {
    const s = (v ?? "").trim();
    return s.length ? s : null;
  };
  return {
    name: input.name.trim(),
    deity: clean(input.deity),
    description: clean(input.description),
    province: clean(input.province),
    address: clean(input.address),
    lat: input.lat,
    lng: input.lng,
    direction: clean(input.direction),
    rasiUpper: clean(input.rasiUpper),
    rasiLower: clean(input.rasiLower),
    element: clean(input.element),
    needs: (input.needs ?? []).map((n) => n.trim()).filter(Boolean),
    worshipGuide: clean(input.worshipGuide),
    imageUrl: clean(input.imageUrl),
    googleMapUrl: clean(input.googleMapUrl),
  };
}

export type ListFilter = { element?: string | null; need?: string | null };

/** client-safe: ตัด base64 (ใหญ่) ออกจาก payload list, เพิ่ม hasImage (มีรูปใน DB ให้เสิร์ฟไหม) */
export type SacredLocationPublic = Omit<SacredLocationRow, "imageBase64" | "imageMime"> & {
  hasImage: boolean;
};

function toPublic(row: SacredLocationRow): SacredLocationPublic {
  const { imageBase64, imageMime, ...rest } = row;
  void imageMime;
  return { ...rest, hasImage: !!imageBase64 };
}

/** สถานที่ที่ verified แล้ว (สาธารณะ) — กรองธาตุ/ความต้องการ, เรียงตามยอดเช็คอิน */
export async function listVerified(filter: ListFilter = {}): Promise<SacredLocationPublic[]> {
  const db = createDbClient();
  const rows = await db
    .select()
    .from(baziSacredMapLocation)
    .where(eq(baziSacredMapLocation.status, "verified"))
    .orderBy(desc(baziSacredMapLocation.checkinCount));

  return rows
    .filter((row) => {
      if (filter.element && row.element !== filter.element) return false;
      if (filter.need && !(row.needs ?? []).includes(filter.need)) return false;
      return true;
    })
    .map(toPublic);
}

/** ทุกสถานที่ทุกสถานะ (แอดมิน) */
export async function listAll(): Promise<SacredLocationRow[]> {
  const db = createDbClient();
  return db
    .select()
    .from(baziSacredMapLocation)
    .orderBy(desc(baziSacredMapLocation.createdAt));
}

export async function getById(id: string): Promise<SacredLocationRow | null> {
  const db = createDbClient();
  const [row] = await db
    .select()
    .from(baziSacredMapLocation)
    .where(eq(baziSacredMapLocation.id, id))
    .limit(1);
  return row ?? null;
}

export async function createLocation(
  input: SacredLocationInput,
  opts: { status?: SacredStatus; source?: string; submitterContact?: string | null } = {},
): Promise<SacredLocationRow | null> {
  const db = createDbClient();
  const [row] = await db
    .insert(baziSacredMapLocation)
    .values({
      ...normalize(input),
      status: opts.status ?? "verified",
      source: opts.source ?? "admin",
      submitterContact: opts.submitterContact ?? null,
    })
    .returning();
  return row ?? null;
}

/** ผู้ใช้ทั่วไปเสนอสถานที่ → เข้าคิว pending */
export async function submitLocation(
  input: SacredLocationInput,
  submitterContact?: string | null,
): Promise<SacredLocationRow | null> {
  return createLocation(input, { status: "pending", source: "user", submitterContact });
}

export async function updateLocation(
  id: string,
  input: SacredLocationInput,
): Promise<SacredLocationRow | null> {
  const db = createDbClient();
  const [row] = await db
    .update(baziSacredMapLocation)
    .set(normalize(input))
    .where(eq(baziSacredMapLocation.id, id))
    .returning();
  return row ?? null;
}

export async function setStatus(id: string, status: SacredStatus): Promise<SacredLocationRow | null> {
  const db = createDbClient();
  const [row] = await db
    .update(baziSacredMapLocation)
    .set({ status })
    .where(eq(baziSacredMapLocation.id, id))
    .returning();
  return row ?? null;
}

export async function deleteLocation(id: string): Promise<boolean> {
  const db = createDbClient();
  const rows = await db
    .delete(baziSacredMapLocation)
    .where(eq(baziSacredMapLocation.id, id))
    .returning({ id: baziSacredMapLocation.id });
  return rows.length > 0;
}

/** เช็คอินนิรนาม — เพิ่มยอด 1 (เฉพาะสถานที่ verified) คืนยอดใหม่ */
export async function incrementCheckin(id: string): Promise<number | null> {
  const db = createDbClient();
  const [row] = await db
    .update(baziSacredMapLocation)
    .set({ checkinCount: sql`${baziSacredMapLocation.checkinCount} + 1` })
    .where(eq(baziSacredMapLocation.id, id))
    .returning({ checkinCount: baziSacredMapLocation.checkinCount });
  return row?.checkinCount ?? null;
}
