/**
 * "เวอร์ชัน PDF" ของ tab อ่าน 15 บท (NewData) — สแน็ปช็อต edits ที่กด "บันทึกเวอร์ชัน PDF" เอง
 * แยกจาก working edits (bazi_newdata_reading.edits) และ revisions (autosave) → ทีม PDF บันทึก/ย้อน/กู้
 * เวอร์ชันที่จัดหน้าเสร็จได้ · insert-only · มี versionNote
 *
 * resilient: ถ้ายังไม่ได้รัน migration 0026 (ตารางยังไม่มี) → list คืน [] แทนพัง (แอปยังใช้ได้)
 */
import { desc, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziNewdataReadingPdfVersions, type NewdataReadingEdits } from "@/db/schema";

export type SaveNewdataPdfVersionInput = {
  readingId: string;
  clientName: string | null;
  birthDate: string;
  birthTime: string;
  gender: string;
  province: string | null;
  versionNote: string | null;
  edits: NewdataReadingEdits;
};

export type NewdataPdfVersionListItem = {
  id: string;
  readingId: string;
  clientName: string | null;
  birthDate: string;
  birthTime: string;
  gender: string;
  province: string | null;
  versionNote: string | null;
  createdAt: string;
};

export type NewdataPdfVersionDetail = NewdataPdfVersionListItem & { edits: NewdataReadingEdits };

const T = baziNewdataReadingPdfVersions;

export async function saveNewdataPdfVersion(input: SaveNewdataPdfVersionInput): Promise<{ id: string }> {
  const db = createDbClient();
  const [row] = await db
    .insert(T)
    .values({
      readingId: input.readingId,
      clientName: input.clientName,
      birthDate: input.birthDate,
      birthTime: input.birthTime,
      gender: input.gender,
      province: input.province,
      versionNote: input.versionNote,
      edits: input.edits,
    })
    .returning({ id: T.id });
  return { id: row.id };
}

/** รายการเวอร์ชันของดวงหนึ่ง — resilient (ตารางยังไม่มี → []) */
export async function listNewdataPdfVersions(readingId: string): Promise<NewdataPdfVersionListItem[]> {
  try {
    const db = createDbClient();
    const rows = await db
      .select({
        id: T.id,
        readingId: T.readingId,
        clientName: T.clientName,
        birthDate: T.birthDate,
        birthTime: T.birthTime,
        gender: T.gender,
        province: T.province,
        versionNote: T.versionNote,
        createdAt: T.createdAt,
      })
      .from(T)
      .where(eq(T.readingId, readingId))
      .orderBy(desc(T.createdAt))
      .limit(100);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  } catch {
    return [];
  }
}

export async function getNewdataPdfVersion(id: string): Promise<NewdataPdfVersionDetail | null> {
  const db = createDbClient();
  const [r] = await db.select().from(T).where(eq(T.id, id)).limit(1);
  if (!r) return null;
  return {
    id: r.id,
    readingId: r.readingId,
    clientName: r.clientName,
    birthDate: r.birthDate,
    birthTime: r.birthTime,
    gender: r.gender,
    province: r.province,
    versionNote: r.versionNote,
    edits: r.edits,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function removeNewdataPdfVersion(id: string): Promise<void> {
  const db = createDbClient();
  await db.delete(T).where(eq(T.id, id));
}
