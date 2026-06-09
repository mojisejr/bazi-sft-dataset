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
  createDbDoctrineDraftRepository,
  type DoctrineDraftRepository,
  type DoctrineDraftRow,
  type DoctrineDraftSurface,
} from "@/lib/bazi/doctrine-draft-repository";
import {
  appendDoctrineAuditSafe,
  type DoctrineAuditEntry,
} from "@/lib/bazi/doctrine-audit-repository";

export type PublishDeps = {
  draftRepo?: DoctrineDraftRepository;
  topicRepo?: ReadingDoctrineRepository;
  configRepo?: DoctrineConfigRepository;
  appendAudit?: (entry: DoctrineAuditEntry) => Promise<void>;
  onInvalidate?: (surface: DoctrineDraftSurface) => void;
};

type PublishOutcome = { ok: true } | { ok: false; message: string };

/** เผยแพร่ draft row หนึ่ง → เขียน live + audit + ลบ draft */
async function publishRow(row: DoctrineDraftRow, actor: string, deps: PublishDeps): Promise<PublishOutcome> {
  const appendAudit = deps.appendAudit ?? appendDoctrineAuditSafe;
  const invalidate = deps.onInvalidate;

  if (row.surface === "topic") {
    const override = parseReadingDoctrineOverride(row.value);
    if (!override) {
      return { ok: false, message: `ร่าง topic ผิดรูป: ${row.entityKey}` };
    }
    const repo = deps.topicRepo ?? createDbReadingDoctrineRepository();
    await repo.upsertOverride(row.entityKey, override, actor);
    await (deps.draftRepo ?? createDbDoctrineDraftRepository()).remove("topic", row.entityKey);
    (invalidate ?? (() => invalidateReadingDoctrineCache()))("topic");
    await appendAudit({
      surface: "topic",
      entityKey: row.entityKey,
      action: "upsert",
      value: override,
      actor: `${actor} (publish)`,
    });
    return { ok: true };
  }

  if (row.surface === "config") {
    const [scopeRaw, key] = row.entityKey.split(":");
    if (!key || !(DOCTRINE_CONFIG_SCOPES as readonly string[]).includes(scopeRaw)) {
      return { ok: false, message: `entityKey ของ config ไม่ถูกต้อง: ${row.entityKey}` };
    }
    const scope = scopeRaw as DoctrineConfigScope;
    const value = parseDoctrineConfigValue(scope, row.value);
    if (!value) {
      return { ok: false, message: `ร่าง config ผิดรูป: ${row.entityKey}` };
    }
    const repo = deps.configRepo ?? createDbDoctrineConfigRepository();
    await repo.upsert(scope, key, value, actor);
    await (deps.draftRepo ?? createDbDoctrineDraftRepository()).remove("config", row.entityKey);
    (invalidate ?? (() => invalidateDoctrineConfigCache()))("config");
    await appendAudit({
      surface: "config",
      entityKey: row.entityKey,
      action: "upsert",
      value: value as Record<string, unknown>,
      actor: `${actor} (publish)`,
    });
    return { ok: true };
  }

  return { ok: false, message: `surface ไม่รองรับ: ${row.surface}` };
}

/** เผยแพร่ draft รายคีย์ */
export async function publishDraft(
  surface: DoctrineDraftSurface,
  entityKey: string,
  actor: string,
  deps: PublishDeps = {},
): Promise<PublishOutcome> {
  const draftRepo = deps.draftRepo ?? createDbDoctrineDraftRepository();
  const row = await draftRepo.get(surface, entityKey);
  if (!row) {
    return { ok: false, message: "ไม่พบฉบับร่างที่ระบุ" };
  }
  return publishRow(row, actor, { ...deps, draftRepo });
}

/** เผยแพร่ draft ทั้งหมด */
export async function publishAllDrafts(
  actor: string,
  deps: PublishDeps = {},
): Promise<{ ok: true; published: number } | { ok: false; message: string }> {
  const draftRepo = deps.draftRepo ?? createDbDoctrineDraftRepository();
  const rows = await draftRepo.listRaw();
  let published = 0;
  for (const row of rows) {
    const result = await publishRow(row, actor, { ...deps, draftRepo });
    if (!result.ok) {
      return result;
    }
    published += 1;
  }
  return { ok: true, published };
}
