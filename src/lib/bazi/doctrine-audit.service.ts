import { parseReadingDoctrineOverride } from "@/lib/bazi/reading-doctrine-override";
import {
  createDbReadingDoctrineRepository,
  type ReadingDoctrineRepository,
} from "@/lib/bazi/reading-doctrine-repository";
import { invalidateReadingDoctrineCache } from "@/lib/bazi/reading-doctrine.server";
import {
  DOCTRINE_CONFIG_SCOPES,
  parseDoctrineConfigValue,
  type DoctrineConfigScope,
} from "@/lib/bazi/doctrine-config";
import {
  createDbDoctrineConfigRepository,
  type DoctrineConfigRepository,
} from "@/lib/bazi/doctrine-config-repository";
import { invalidateDoctrineConfigCache } from "@/lib/bazi/doctrine-config.server";
import {
  appendDoctrineAuditSafe,
  type DoctrineAuditEntry,
  type DoctrineAuditRow,
} from "@/lib/bazi/doctrine-audit-repository";

export type RestoreDoctrineDeps = {
  topicRepo?: ReadingDoctrineRepository;
  configRepo?: DoctrineConfigRepository;
  appendAudit?: (entry: DoctrineAuditEntry) => Promise<void>;
  onInvalidate?: () => void;
};

/**
 * Restore: นำ "ค่าตามประวัติ" ของ audit row หนึ่งกลับมาใช้กับ config ปัจจุบัน
 * - reproduce สถานะ ณ จุดนั้น: ถ้า audit เป็น delete → ลบ override; ถ้าเป็น upsert → upsert ค่านั้น
 * - แล้วบันทึก audit ใหม่ (action mirror) เป็นร่องรอยของการ restore
 * deps ฉีดได้สำหรับเทส (default = repository จริง + cache invalidators)
 */
export async function restoreDoctrineAudit(
  row: DoctrineAuditRow,
  actor?: string,
  deps: RestoreDoctrineDeps = {},
): Promise<{ ok: true } | { ok: false; message: string }> {
  const appendAudit = deps.appendAudit ?? appendDoctrineAuditSafe;
  const willDelete = row.action === "delete" || row.value === null || row.value === undefined;

  if (row.surface === "topic") {
    const topicId = row.entityKey;
    const repo = deps.topicRepo ?? createDbReadingDoctrineRepository();
    if (willDelete) {
      await repo.deleteOverride(topicId);
    } else {
      const override = parseReadingDoctrineOverride(row.value);
      if (!override) {
        return { ok: false, message: "ค่าในประวัติผิดรูป (topic override)" };
      }
      await repo.upsertOverride(topicId, override, actor);
    }
    (deps.onInvalidate ?? invalidateReadingDoctrineCache)();
    await appendAudit({
      surface: "topic",
      entityKey: topicId,
      action: willDelete ? "delete" : "upsert",
      value: willDelete ? null : (row.value as Record<string, unknown>),
      actor: actor ? `${actor} (restore)` : "restore",
    });
    return { ok: true };
  }

  if (row.surface === "config") {
    const [scopeRaw, key] = row.entityKey.split(":");
    if (!key || !(DOCTRINE_CONFIG_SCOPES as readonly string[]).includes(scopeRaw)) {
      return { ok: false, message: "entityKey ของ config ไม่ถูกต้อง" };
    }
    const scope = scopeRaw as DoctrineConfigScope;
    const repo = deps.configRepo ?? createDbDoctrineConfigRepository();
    if (willDelete) {
      await repo.remove(scope, key);
    } else {
      const value = parseDoctrineConfigValue(scope, row.value);
      if (!value) {
        return { ok: false, message: "ค่าในประวัติผิดรูป (config)" };
      }
      await repo.upsert(scope, key, value, actor);
    }
    (deps.onInvalidate ?? invalidateDoctrineConfigCache)();
    await appendAudit({
      surface: "config",
      entityKey: row.entityKey,
      action: willDelete ? "delete" : "upsert",
      value: willDelete ? null : (row.value as Record<string, unknown>),
      actor: actor ? `${actor} (restore)` : "restore",
    });
    return { ok: true };
  }

  return { ok: false, message: `surface ไม่รองรับ: ${row.surface}` };
}
