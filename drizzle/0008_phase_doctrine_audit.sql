-- Phase 3: audit log (append-only) ของการแก้ doctrine ออนไลน์ — ประวัติ + rollback
-- additive + idempotent
CREATE TABLE IF NOT EXISTS "bazi_doctrine_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "surface" text NOT NULL,
  "entity_key" text NOT NULL,
  "action" text NOT NULL,
  "value" jsonb,
  "actor" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "bazi_doctrine_audit_lookup_idx"
  ON "bazi_doctrine_audit" ("surface", "entity_key", "created_at" DESC);
