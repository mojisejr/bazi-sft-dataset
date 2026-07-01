/**
 * คลังดวงลูกค้าที่บันทึกไว้ (Man Vs Day / ดวงกับวัน).
 * เก็บ birth input (RawInputValue) เพื่อเรียกกลับมาดูปฏิทินส่วนตัว/สั่ง PDF ซ้ำ
 * โดยไม่ต้องป้อนวันเกิดใหม่. มิเรอร์แพตเทิร์น newdata-reading-repository.
 */
import { desc, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziSavedChart, type SelectBaziSavedChart } from "@/db/schema";
import type { RawInputValue } from "@/lib/bazi/schema-types";

export type SavedChartRow = SelectBaziSavedChart;

/** รายการย่อ (ไม่รวม rawInput เต็ม) สำหรับ dropdown. */
export type SavedChartSummary = Pick<
  SavedChartRow,
  "id" | "label" | "dayMaster" | "updatedAt"
>;

export type SaveChartInput = {
  id?: string;
  label: string;
  rawInput: RawInputValue;
  dayMaster?: string | null;
};

export type SavedChartRepository = {
  list: () => Promise<SavedChartSummary[]>;
  get: (id: string) => Promise<SavedChartRow | null>;
  save: (input: SaveChartInput) => Promise<SavedChartRow>;
  remove: (id: string) => Promise<void>;
};

export function createDbSavedChartRepository(db = createDbClient()): SavedChartRepository {
  return {
    async list() {
      return db
        .select({
          id: baziSavedChart.id,
          label: baziSavedChart.label,
          dayMaster: baziSavedChart.dayMaster,
          updatedAt: baziSavedChart.updatedAt,
        })
        .from(baziSavedChart)
        .orderBy(desc(baziSavedChart.updatedAt))
        .limit(200);
    },

    async get(id) {
      const rows = await db
        .select()
        .from(baziSavedChart)
        .where(eq(baziSavedChart.id, id))
        .limit(1);
      return rows[0] ?? null;
    },

    async save(input) {
      const values = {
        label: input.label,
        rawInput: input.rawInput,
        dayMaster: input.dayMaster ?? null,
      };
      if (input.id) {
        const rows = await db
          .update(baziSavedChart)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(baziSavedChart.id, input.id))
          .returning();
        if (rows[0]) return rows[0];
      }
      const inserted = await db.insert(baziSavedChart).values(values).returning();
      return inserted[0];
    },

    async remove(id) {
      await db.delete(baziSavedChart).where(eq(baziSavedChart.id, id));
    },
  };
}
