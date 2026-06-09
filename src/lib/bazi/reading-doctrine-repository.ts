import { eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziReadingDoctrineOverrides } from "@/db/schema";
import {
  parseReadingDoctrineOverride,
  type ReadingDoctrineOverride,
  type ReadingDoctrineOverrideMap,
} from "@/lib/bazi/reading-doctrine-override";

/**
 * Repository ของ doctrine override (server-only) — เข้าถึง Neon ผ่าน drizzle
 * ทุกฟังก์ชันทนต่อ "ตารางยังไม่ถูกสร้าง / DB ล่ม" โดยโยน error ให้ผู้เรียกจัดการ fallback
 */
export type ReadingDoctrineRepository = {
  listOverrides(): Promise<ReadingDoctrineOverrideMap>;
  upsertOverride(
    topicId: string,
    override: ReadingDoctrineOverride,
    updatedBy?: string,
  ): Promise<void>;
  deleteOverride(topicId: string): Promise<void>;
};

export function createDbReadingDoctrineRepository(
  db = createDbClient(),
): ReadingDoctrineRepository {
  return {
    async listOverrides() {
      const rows = await db
        .select({
          topicId: baziReadingDoctrineOverrides.topicId,
          override: baziReadingDoctrineOverrides.override,
        })
        .from(baziReadingDoctrineOverrides);

      const map: ReadingDoctrineOverrideMap = {};
      for (const row of rows) {
        const parsed = parseReadingDoctrineOverride(row.override);
        // ข้าม override ที่ผิดรูป เพื่อ fallback เป็น default ของบทนั้น
        if (parsed) {
          map[row.topicId] = parsed;
        }
      }
      return map;
    },

    async upsertOverride(topicId, override, updatedBy) {
      await db
        .insert(baziReadingDoctrineOverrides)
        .values({ topicId, override, updatedBy: updatedBy ?? null })
        .onConflictDoUpdate({
          target: baziReadingDoctrineOverrides.topicId,
          set: { override, updatedBy: updatedBy ?? null },
        });
    },

    async deleteOverride(topicId) {
      await db
        .delete(baziReadingDoctrineOverrides)
        .where(eq(baziReadingDoctrineOverrides.topicId, topicId));
    },
  };
}
