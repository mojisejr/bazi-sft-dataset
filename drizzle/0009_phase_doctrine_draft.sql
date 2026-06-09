-- Phase 3b: draft overlay — ฉบับร่างที่ยังไม่เผยแพร่ (preview เท่านั้น)
-- additive + idempotent
CREATE TABLE IF NOT EXISTS "bazi_doctrine_draft" (
  "surface" text NOT NULL,
  "entity_key" text NOT NULL,
  "value" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "actor" text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "bazi_doctrine_draft_pkey" PRIMARY KEY ("surface", "entity_key")
);
