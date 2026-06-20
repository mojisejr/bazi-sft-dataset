/**
 * Repository ของ NewData (ข้อมูลหลักแบบใหม่) — อ่าน/เขียนตาราง bazi_newdata
 * มิเรอร์รูปแบบ knowledge-override-repository.ts (factory + DI ทดสอบได้)
 */
import { and, asc, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziNewdata, type NewdataValue, type SelectBaziNewdata } from "@/db/schema";

export type NewdataRow = SelectBaziNewdata;

/** map สำหรับ engine lookup: group_key → item_key → value */
export type NewdataMap = Record<string, Record<string, NewdataValue>>;

export function rowsToMap(rows: NewdataRow[]): NewdataMap {
  const map: NewdataMap = {};
  for (const row of rows) {
    (map[row.groupKey] ??= {})[row.itemKey] = row.value;
  }
  return map;
}

export type NewdataRepository = {
  /** ทุกแถว เรียงตาม group แล้ว ordinal (ใช้ในหน้าแอดมิน) */
  listRaw: () => Promise<NewdataRow[]>;
  /** map สำหรับ engine lookup */
  load: () => Promise<NewdataMap>;
  upsert: (
    groupKey: string,
    itemKey: string,
    value: NewdataValue,
    ordinal: number,
    actor?: string,
  ) => Promise<void>;
  remove: (groupKey: string, itemKey: string) => Promise<void>;
};

export function createDbNewdataRepository(db = createDbClient()): NewdataRepository {
  return {
    async listRaw() {
      return db
        .select()
        .from(baziNewdata)
        .orderBy(asc(baziNewdata.groupKey), asc(baziNewdata.ordinal), asc(baziNewdata.itemKey));
    },

    async load() {
      const rows = await db.select().from(baziNewdata);
      return rowsToMap(rows);
    },

    async upsert(groupKey, itemKey, value, ordinal, actor) {
      await db
        .insert(baziNewdata)
        .values({ groupKey, itemKey, value, ordinal, updatedBy: actor ?? null })
        .onConflictDoUpdate({
          target: [baziNewdata.groupKey, baziNewdata.itemKey],
          set: { value, ordinal, updatedBy: actor ?? null },
        });
    },

    async remove(groupKey, itemKey) {
      await db
        .delete(baziNewdata)
        .where(and(eq(baziNewdata.groupKey, groupKey), eq(baziNewdata.itemKey, itemKey)));
    },
  };
}
