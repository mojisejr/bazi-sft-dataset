-- Phase 2: online doctrine config — นิยาม 7 ขั้น / ป้าย-ความหมาย role / ดาวพิเศษ (copy)
-- additive + idempotent
CREATE TABLE IF NOT EXISTS "bazi_doctrine_config" (
  "scope" text NOT NULL,
  "config_key" text NOT NULL,
  "value" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_by" text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "bazi_doctrine_config_pkey" PRIMARY KEY ("scope", "config_key")
);
