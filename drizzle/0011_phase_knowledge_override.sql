-- Phase 2: knowledge override — ที่เก็บ "องค์ความรู้ที่ซินแสแก้ออนไลน์" (live)
-- draft/audit ใช้ตาราง doctrine เดิมร่วม (surface = "knowledge")
-- additive + idempotent: CREATE TABLE/INDEX ใช้ IF NOT EXISTS
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_knowledge_override" (
  "kind" text NOT NULL,
  "group_key" text NOT NULL,
  "item_key" text NOT NULL,
  "value" jsonb NOT NULL,
  "updated_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "bazi_knowledge_override_pk" PRIMARY KEY ("kind", "group_key", "item_key")
);
