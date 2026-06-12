/**
 * Repository ของ knowledge override (เฟส 2) — อ่าน/เขียนตาราง bazi_knowledge_override
 * แปลงแถวเป็น KnowledgeOverlay ที่ builders ใช้ได้ทันที
 *
 * มิเรอร์รูปแบบ substitution-rules-repository.ts (factory + DI ทดสอบได้)
 */
import { and, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziKnowledgeOverride, type SelectBaziKnowledgeOverride } from "@/db/schema";
import {
  EMPTY_OVERLAY,
  type KnowledgeOverlay,
} from "@/lib/bazi/knowledge/knowledge-overlay";

export type KnowledgeOverrideKind = "table" | "append" | "logic" | "sourcefocus";

export type KnowledgeOverrideRow = SelectBaziKnowledgeOverride;

/** แปลงรายการแถว → KnowledgeOverlay (append เรียงตาม item_key เชิงเลข) */
export function rowsToOverlay(rows: KnowledgeOverrideRow[]): KnowledgeOverlay {
  const overlay: KnowledgeOverlay = { tables: {}, appends: {}, registry: {} };
  const appendBuckets: Record<string, Array<{ order: number; text: string }>> = {};

  for (const row of rows) {
    const text = row.value?.text ?? "";
    if (row.kind === "table") {
      (overlay.tables[row.groupKey] ??= {})[row.itemKey] = text;
    } else if (row.kind === "append") {
      (appendBuckets[row.groupKey] ??= []).push({ order: Number(row.itemKey) || 0, text });
    } else if (row.kind === "logic" || row.kind === "sourcefocus") {
      const ordinal = Number(row.itemKey) || 0;
      if (ordinal > 0) {
        const entry = (overlay.registry[row.groupKey] ??= {});
        const field = row.kind === "logic" ? "logicRules" : "sourceFocus";
        (entry[field] ??= {})[ordinal] = text;
      }
    }
  }

  for (const [topicId, items] of Object.entries(appendBuckets)) {
    overlay.appends[topicId] = items
      .sort((a, b) => a.order - b.order)
      .map((item) => item.text)
      .filter((value) => value.trim().length > 0);
  }
  return overlay;
}

export type KnowledgeOverrideRepository = {
  load: () => Promise<KnowledgeOverlay>;
  listRaw: () => Promise<KnowledgeOverrideRow[]>;
  upsert: (
    kind: KnowledgeOverrideKind,
    groupKey: string,
    itemKey: string,
    text: string,
    actor?: string,
  ) => Promise<void>;
  remove: (kind: KnowledgeOverrideKind, groupKey: string, itemKey: string) => Promise<void>;
};

export function createDbKnowledgeOverrideRepository(
  db = createDbClient(),
): KnowledgeOverrideRepository {
  return {
    async load() {
      const rows = await db.select().from(baziKnowledgeOverride);
      return rowsToOverlay(rows);
    },

    async listRaw() {
      return db.select().from(baziKnowledgeOverride);
    },

    async upsert(kind, groupKey, itemKey, text, actor) {
      await db
        .insert(baziKnowledgeOverride)
        .values({ kind, groupKey, itemKey, value: { text }, updatedBy: actor ?? null })
        .onConflictDoUpdate({
          target: [
            baziKnowledgeOverride.kind,
            baziKnowledgeOverride.groupKey,
            baziKnowledgeOverride.itemKey,
          ],
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

export { EMPTY_OVERLAY };
