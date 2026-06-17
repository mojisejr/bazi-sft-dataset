/**
 * Override ของปฏิทินโหราศาสตร์ — reuse ตาราง bazi_knowledge_override (ไม่ต้อง migration ใหม่)
 *
 * 2 ชนิด (kind):
 *  - "almanac-day"  : แก้รายวัน  groupKey=YYYY-MM-DD  itemKey=field (note|officer|specialAdd)  value.text=ข้อความ
 *  - "almanac-rule" : แก้ตาราง/กฎ groupKey=table (day-stars|special-days)  itemKey=entryId  value.text=JSON
 *                     (value.text === "__deleted__" = ลบ entry ฐาน)
 *
 * mergeOverrides รวมกฎฐาน (day-stars.json/special-days.json) กับ override → ตารางผลลัพธ์
 */
import { and, eq, inArray } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziKnowledgeOverride, type SelectBaziKnowledgeOverride } from "@/db/schema";

import dayStarsBase from "@/lib/bazi/data/almanac/day-stars.json";
import specialDaysBase from "@/lib/bazi/data/almanac/special-days.json";

export type DayStarRow = {
  id: string;
  name: string;
  polarity: "good" | "bad";
  activity: string | null;
  triggers: Record<string, string[]>;
  note?: string | null;
};

export type SpecialEntry = {
  id: string;
  name: string;
  category: string;
  rule: Record<string, unknown>;
};

/** patch รายวันแบบ generic: ฟิลด์ใดของ AlmanacDay ก็ได้ → ค่าใหม่ (เก็บเป็น JSON) */
export type DayPatch = Record<string, unknown>;

export type AlmanacOverrides = {
  dayStars: DayStarRow[];
  specialDays: SpecialEntry[];
  dayPatches: Record<string, DayPatch>;
};

export const ALMANAC_KIND_DAY = "almanac-day";
export const ALMANAC_KIND_RULE = "almanac-rule";
const DELETED = "__deleted__";

const BASE_DAY_STARS = dayStarsBase as unknown as DayStarRow[];
const BASE_SPECIAL_DAYS = specialDaysBase as unknown as SpecialEntry[];

/** รวม base + override rows → ตารางผลลัพธ์ที่ engine ใช้ได้ทันที */
export function mergeOverrides(rows: SelectBaziKnowledgeOverride[]): AlmanacOverrides {
  const dayStarOv = new Map<string, DayStarRow | typeof DELETED>();
  const specialOv = new Map<string, SpecialEntry | typeof DELETED>();
  const dayPatches: Record<string, DayPatch> = {};

  for (const row of rows) {
    const text = row.value?.text ?? "";
    if (row.kind === ALMANAC_KIND_RULE) {
      const target = row.groupKey === "day-stars" ? dayStarOv : row.groupKey === "special-days" ? specialOv : null;
      if (!target) continue;
      if (text === DELETED) {
        target.set(row.itemKey, DELETED);
      } else {
        try {
          target.set(row.itemKey, JSON.parse(text));
        } catch {
          /* ข้าม JSON เสีย */
        }
      }
    } else if (row.kind === ALMANAC_KIND_DAY) {
      // generic: itemKey = ชื่อฟิลด์ของ AlmanacDay, value.text = JSON (เผื่อ scalar เก่าเป็น string ดิบ)
      const patch = (dayPatches[row.groupKey] ??= {});
      try {
        patch[row.itemKey] = JSON.parse(text);
      } catch {
        patch[row.itemKey] = text;
      }
    }
  }

  const mergeList = <T extends { id: string }>(base: T[], ov: Map<string, T | typeof DELETED>): T[] => {
    const out: T[] = [];
    const seen = new Set<string>();
    for (const item of base) {
      seen.add(item.id);
      const o = ov.get(item.id);
      if (o === DELETED) continue;
      out.push((o as T) ?? item);
    }
    for (const [id, o] of ov) {
      if (o !== DELETED && !seen.has(id)) out.push(o as T);
    }
    return out;
  };

  return {
    dayStars: mergeList(BASE_DAY_STARS, dayStarOv),
    specialDays: mergeList(BASE_SPECIAL_DAYS, specialOv),
    dayPatches,
  };
}

export type AlmanacOverrideRepository = {
  load: () => Promise<AlmanacOverrides>;
  listRaw: () => Promise<SelectBaziKnowledgeOverride[]>;
  upsert: (kind: string, groupKey: string, itemKey: string, text: string, actor?: string) => Promise<void>;
  remove: (kind: string, groupKey: string, itemKey: string) => Promise<void>;
};

export function createDbAlmanacOverrideRepository(db = createDbClient()): AlmanacOverrideRepository {
  const kinds = [ALMANAC_KIND_DAY, ALMANAC_KIND_RULE];
  return {
    async load() {
      const rows = await db
        .select()
        .from(baziKnowledgeOverride)
        .where(inArray(baziKnowledgeOverride.kind, kinds));
      return mergeOverrides(rows);
    },
    async listRaw() {
      return db.select().from(baziKnowledgeOverride).where(inArray(baziKnowledgeOverride.kind, kinds));
    },
    async upsert(kind, groupKey, itemKey, text, actor) {
      await db
        .insert(baziKnowledgeOverride)
        .values({ kind, groupKey, itemKey, value: { text }, updatedBy: actor ?? null })
        .onConflictDoUpdate({
          target: [baziKnowledgeOverride.kind, baziKnowledgeOverride.groupKey, baziKnowledgeOverride.itemKey],
          set: { value: { text }, updatedBy: actor ?? null },
        });
    },
    async remove(kind, groupKey, itemKey) {
      await db
        .delete(baziKnowledgeOverride)
        .where(
          and(
            eq(baziKnowledgeOverride.kind, kind),
            eq(baziKnowledgeOverride.groupKey, groupKey),
            eq(baziKnowledgeOverride.itemKey, itemKey),
          ),
        );
    },
  };
}

/** ค่าว่าง (ใช้เมื่อ DB ใช้ไม่ได้ — ปฏิทินยังทำงานบนกฎฐาน) */
export const EMPTY_ALMANAC_OVERRIDES: AlmanacOverrides = {
  dayStars: BASE_DAY_STARS,
  specialDays: BASE_SPECIAL_DAYS,
  dayPatches: {},
};
