import { and, desc, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziDoctrineAudit, type SelectBaziDoctrineAudit } from "@/db/schema";

export type DoctrineAuditSurface = "topic" | "config";
export type DoctrineAuditAction = "upsert" | "delete";

export type DoctrineAuditEntry = {
  surface: DoctrineAuditSurface;
  entityKey: string;
  action: DoctrineAuditAction;
  value: Record<string, unknown> | null;
  actor?: string | null;
};

export type DoctrineAuditRow = SelectBaziDoctrineAudit;

export type DoctrineAuditRepository = {
  append(entry: DoctrineAuditEntry): Promise<void>;
  list(filter?: { surface?: DoctrineAuditSurface; entityKey?: string; limit?: number }): Promise<DoctrineAuditRow[]>;
  getById(id: string): Promise<DoctrineAuditRow | null>;
};

export function createDbDoctrineAuditRepository(db = createDbClient()): DoctrineAuditRepository {
  return {
    async append(entry) {
      await db.insert(baziDoctrineAudit).values({
        surface: entry.surface,
        entityKey: entry.entityKey,
        action: entry.action,
        value: entry.value ?? null,
        actor: entry.actor ?? null,
      });
    },

    async list(filter = {}) {
      const conditions = [];
      if (filter.surface) conditions.push(eq(baziDoctrineAudit.surface, filter.surface));
      if (filter.entityKey) conditions.push(eq(baziDoctrineAudit.entityKey, filter.entityKey));

      const base = db
        .select()
        .from(baziDoctrineAudit)
        .orderBy(desc(baziDoctrineAudit.createdAt))
        .limit(Math.min(filter.limit ?? 100, 500));

      const rows = conditions.length > 0 ? await base.where(and(...conditions)) : await base;
      return rows;
    },

    async getById(id) {
      const rows = await db
        .select()
        .from(baziDoctrineAudit)
        .where(eq(baziDoctrineAudit.id, id))
        .limit(1);
      return rows[0] ?? null;
    },
  };
}

/**
 * บันทึก audit แบบ "best-effort" — ไม่ให้การบันทึกประวัติพังการแก้ config หลัก
 * (ถ้าตาราง audit ยังไม่ถูกสร้าง/DB ล่ม จะกลืน error เงียบ ๆ)
 */
export async function appendDoctrineAuditSafe(entry: DoctrineAuditEntry): Promise<void> {
  try {
    await createDbDoctrineAuditRepository().append(entry);
  } catch {
    // ignore — audit ไม่ใช่ critical path
  }
}
