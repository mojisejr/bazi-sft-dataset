import { and, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziDoctrineDraft, type SelectBaziDoctrineDraft } from "@/db/schema";
import {
  parseReadingDoctrineOverride,
  type ReadingDoctrineOverride,
} from "@/lib/bazi/reading-doctrine-override";
import {
  DOCTRINE_CONFIG_SCOPES,
  parseDoctrineConfigValue,
  type DoctrineConfigScope,
  type DoctrineConfigV2,
  type RoleConfig,
  type RoleKey,
  type StarConfig,
  type StarKey,
  type StepConfig,
  type StepKey,
} from "@/lib/bazi/doctrine-config";
import { type KnowledgeOverlay } from "@/lib/bazi/knowledge/knowledge-overlay";

export type DoctrineDraftSurface = "topic" | "config" | "knowledge";

/** ฉบับร่างที่ parse แล้ว แยกตาม surface (พร้อม layer บน published สำหรับ preview) */
export type ParsedDrafts = {
  topicOverrides: Record<string, ReadingDoctrineOverride>;
  config: DoctrineConfigV2;
  knowledge: KnowledgeOverlay;
};

/** entityKey ของ surface "knowledge" = `${kind}|${group}|${item}` (kind=table|append) */
export function encodeKnowledgeEntityKey(kind: string, group: string, item: string): string {
  return `${kind}|${group}|${item}`;
}

export function decodeKnowledgeEntityKey(
  entityKey: string,
): { kind: string; group: string; item: string } | null {
  const [kind, group, ...rest] = entityKey.split("|");
  if (!kind || !group || rest.length === 0) return null;
  return { kind, group, item: rest.join("|") };
}

export type DoctrineDraftRow = SelectBaziDoctrineDraft;

export type DoctrineDraftRepository = {
  /** raw ทุกแถว (ให้ admin แสดงว่า key ไหนมีร่าง) */
  listRaw(): Promise<DoctrineDraftRow[]>;
  /** parse แล้วแยก surface (สำหรับ preview) */
  loadParsed(): Promise<ParsedDrafts>;
  upsert(surface: DoctrineDraftSurface, entityKey: string, value: Record<string, unknown>, actor?: string): Promise<void>;
  remove(surface: DoctrineDraftSurface, entityKey: string): Promise<void>;
  get(surface: DoctrineDraftSurface, entityKey: string): Promise<DoctrineDraftRow | null>;
};

function isScope(value: string): value is DoctrineConfigScope {
  return (DOCTRINE_CONFIG_SCOPES as readonly string[]).includes(value);
}

export function createDbDoctrineDraftRepository(db = createDbClient()): DoctrineDraftRepository {
  return {
    async listRaw() {
      return db.select().from(baziDoctrineDraft);
    },

    async loadParsed() {
      const rows = await db.select().from(baziDoctrineDraft);
      const parsed: ParsedDrafts = {
        topicOverrides: {},
        config: { steps: {}, roles: {}, stars: {} },
        knowledge: { tables: {}, appends: {}, registry: {} },
      };
      // append draft: เก็บเป็น bucket ก่อน แล้วเรียงตามลำดับ item ตอนจบ
      const appendBuckets: Record<string, Array<{ order: number; text: string }>> = {};

      for (const row of rows) {
        if (row.surface === "topic") {
          const override = parseReadingDoctrineOverride(row.value);
          if (override) parsed.topicOverrides[row.entityKey] = override;
          continue;
        }
        if (row.surface === "config") {
          const [scopeRaw, key] = row.entityKey.split(":");
          if (!key || !isScope(scopeRaw)) continue;
          const value = parseDoctrineConfigValue(scopeRaw, row.value);
          if (!value) continue;
          if (scopeRaw === "step") parsed.config.steps[key as StepKey] = value as StepConfig;
          else if (scopeRaw === "role") parsed.config.roles[key as RoleKey] = value as RoleConfig;
          else parsed.config.stars[key as StarKey] = value as StarConfig;
          continue;
        }
        if (row.surface === "knowledge") {
          const decoded = decodeKnowledgeEntityKey(row.entityKey);
          if (!decoded) continue;
          const text = (row.value as { text?: string })?.text ?? "";
          if (decoded.kind === "table") {
            (parsed.knowledge.tables[decoded.group] ??= {})[decoded.item] = text;
          } else if (decoded.kind === "append") {
            (appendBuckets[decoded.group] ??= []).push({ order: Number(decoded.item) || 0, text });
          } else if (decoded.kind === "logic" || decoded.kind === "sourcefocus") {
            const ordinal = Number(decoded.item) || 0;
            if (ordinal > 0) {
              const entry = (parsed.knowledge.registry[decoded.group] ??= {});
              const field = decoded.kind === "logic" ? "logicRules" : "sourceFocus";
              (entry[field] ??= {})[ordinal] = text;
            }
          }
        }
      }

      for (const [topicId, items] of Object.entries(appendBuckets)) {
        parsed.knowledge.appends[topicId] = items
          .sort((a, b) => a.order - b.order)
          .map((item) => item.text)
          .filter((value) => value.trim().length > 0);
      }
      return parsed;
    },

    async upsert(surface, entityKey, value, actor) {
      await db
        .insert(baziDoctrineDraft)
        .values({ surface, entityKey, value, actor: actor ?? null })
        .onConflictDoUpdate({
          target: [baziDoctrineDraft.surface, baziDoctrineDraft.entityKey],
          set: { value, actor: actor ?? null },
        });
    },

    async remove(surface, entityKey) {
      await db
        .delete(baziDoctrineDraft)
        .where(and(eq(baziDoctrineDraft.surface, surface), eq(baziDoctrineDraft.entityKey, entityKey)));
    },

    async get(surface, entityKey) {
      const rows = await db
        .select()
        .from(baziDoctrineDraft)
        .where(and(eq(baziDoctrineDraft.surface, surface), eq(baziDoctrineDraft.entityKey, entityKey)))
        .limit(1);
      return rows[0] ?? null;
    },
  };
}
