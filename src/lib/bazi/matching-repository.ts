/**
 * Repository ของคำทำนาย Matching (จับคู่/สมพงษ์) — อ่าน/เขียนตาราง bazi_matching
 * มิเรอร์ newdata-repository.ts (factory + DI ทดสอบได้)
 */
import { and, asc, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziMatching, type MatchingValue, type SelectBaziMatching } from "@/db/schema";

export type MatchingRow = SelectBaziMatching;

/** map สำหรับ overlay: group_key → item_key → value */
export type MatchingMap = Record<string, Record<string, MatchingValue>>;

export function rowsToMatchingMap(rows: MatchingRow[]): MatchingMap {
  const map: MatchingMap = {};
  for (const row of rows) {
    (map[row.groupKey] ??= {})[row.itemKey] = row.value;
  }
  return map;
}

export type MatchingRepository = {
  /** ทุกแถว เรียงตาม group แล้ว ordinal (ใช้ในหน้าแอดมิน) */
  listRaw: () => Promise<MatchingRow[]>;
  /** map สำหรับ overlay engine */
  load: () => Promise<MatchingMap>;
  upsert: (
    groupKey: string,
    itemKey: string,
    value: MatchingValue,
    ordinal: number,
    actor?: string,
  ) => Promise<void>;
  remove: (groupKey: string, itemKey: string) => Promise<void>;
};

export function createDbMatchingRepository(db = createDbClient()): MatchingRepository {
  return {
    async listRaw() {
      return db
        .select()
        .from(baziMatching)
        .orderBy(asc(baziMatching.groupKey), asc(baziMatching.ordinal), asc(baziMatching.itemKey));
    },

    async load() {
      const rows = await db.select().from(baziMatching);
      return rowsToMatchingMap(rows);
    },

    async upsert(groupKey, itemKey, value, ordinal, actor) {
      await db
        .insert(baziMatching)
        .values({ groupKey, itemKey, value, ordinal, updatedBy: actor ?? null })
        .onConflictDoUpdate({
          target: [baziMatching.groupKey, baziMatching.itemKey],
          set: { value, ordinal, updatedBy: actor ?? null },
        });
    },

    async remove(groupKey, itemKey) {
      await db
        .delete(baziMatching)
        .where(and(eq(baziMatching.groupKey, groupKey), eq(baziMatching.itemKey, itemKey)));
    },
  };
}
