-- ดวงลูกค้าที่บันทึกไว้ (Man Vs Day / ดวงกับวัน): เก็บ birth input เพื่อเรียกกลับ/สั่ง PDF ซ้ำ
-- additive + idempotent
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_saved_chart" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "label" text NOT NULL,
  "raw_input" jsonb NOT NULL,
  "day_master" text,
  "owner_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_saved_chart_updated_at_idx"
  ON "bazi_saved_chart" ("updated_at" DESC);
