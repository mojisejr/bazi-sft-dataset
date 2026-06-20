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
      if (input.id) {
        const rows = await db
          .update(baziNewdataReading)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(baziNewdataReading.id, input.id))
          .returning();
        if (rows[0]) return rows[0];
      }
      const inserted = await db.insert(baziNewdataReading).values(values).returning();
      return inserted[0];
    },

    async remove(id) {
      await db.delete(baziNewdataReading).where(eq(baziNewdataReading.id, id));
    },
  };
}
