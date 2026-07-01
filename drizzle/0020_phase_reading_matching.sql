-- Matching (จับคู่/สมพงษ์): คลังคำทำนายที่ซินแสแก้ได้ (overlay reference.json + sising.json)
-- additive + idempotent
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_matching" (
  "group_key" text NOT NULL,
  "item_key" text NOT NULL,
  "ordinal" integer NOT NULL DEFAULT 0,
  "value" jsonb NOT NULL,
  "source_file" text,
  "updated_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "bazi_matching_pk" PRIMARY KEY ("group_key", "item_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_matching_group_key_idx"
  ON "bazi_matching" ("group_key", "ordinal");
