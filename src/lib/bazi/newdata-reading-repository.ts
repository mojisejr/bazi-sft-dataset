/**
 * Repository ของ "ดวงที่บันทึกไว้" (tab อ่าน 15 บท NewData) — bazi_newdata_reading
 */
import { desc, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import {
  baziNewdataReading,
  type NewdataReadingEdits,
  type SelectBaziNewdataReading,
} from "@/db/schema";
import { recordNewdataReadingRevision } from "@/lib/bazi/newdata-reading-revisions";

export type NewdataReadingRow = SelectBaziNewdataReading;

export type SaveNewdataReadingInput = {
  id?: string;
  clientName?: string | null;
  birthDate: string;
  birthTime: string;
  gender: string;
  province?: string | null;
  edits: NewdataReadingEdits;
};

export type NewdataReadingRepository = {
  list: () => Promise<
    Array<Pick<NewdataReadingRow, "id" | "clientName" | "birthDate" | "birthTime" | "gender" | "updatedAt">>
  >;
  get: (id: string) => Promise<NewdataReadingRow | null>;
  save: (input: SaveNewdataReadingInput) => Promise<NewdataReadingRow>;
  remove: (id: string) => Promise<void>;
};

export function createDbNewdataReadingRepository(db = createDbClient()): NewdataReadingRepository {
  return {
    async list() {
      return db
        .select({
          id: baziNewdataReading.id,
          clientName: baziNewdataReading.clientName,
          birthDate: baziNewdataReading.birthDate,
          birthTime: baziNewdataReading.birthTime,
          gender: baziNewdataReading.gender,
          updatedAt: baziNewdataReading.updatedAt,
        })
        .from(baziNewdataReading)
        .orderBy(desc(baziNewdataReading.updatedAt))
        .limit(200);
    },

    async get(id) {
      const rows = await db.select().from(baziNewdataReading).where(eq(baziNewdataReading.id, id)).limit(1);
      return rows[0] ?? null;
    },

    async save(input) {
      const values = {
        clientName: input.clientName ?? null,
        birthDate: input.birthDate,
        birthTime: input.birthTime,
        gender: input.gender,
        province: input.province ?? null,
        edits: input.edits,
      };
      let saved: NewdataReadingRow | undefined;
      if (input.id) {
        const rows = await db
          .update(baziNewdataReading)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(baziNewdataReading.id, input.id))
          .returning();
        saved = rows[0];
      }
      if (!saved) {
        const inserted = await db.insert(baziNewdataReading).values(values).returning();
        saved = inserted[0];
      }

      // เก็บ "ประวัติการบันทึก" หนึ่งสแน็ปช็อตทุกครั้งที่บันทึก (insert-only, เก็บ 30 ล่าสุด/ดวง)
      // best-effort: ถ้า revision ล้มเหลวไม่ทำให้การบันทึกหลักพัง
      try {
        await recordNewdataReadingRevision({
          readingId: saved.id,
          clientName: saved.clientName,
          birthDate: saved.birthDate,
          birthTime: saved.birthTime,
          gender: saved.gender,
          province: saved.province,
          edits: saved.edits,
        });
      } catch {
        /* บันทึกประวัติไม่สำเร็จ — ข้ามได้ */
      }

      return saved;
    },

    async remove(id) {
      await db.delete(baziNewdataReading).where(eq(baziNewdataReading.id, id));
    },
  };
}
