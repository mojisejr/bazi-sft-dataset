-- Phase: newdata reading — บันทึก "ดวงที่อ่านแล้ว" ของ tab อ่าน 15 บท (NewData)
-- เก็บ birth input + ชื่อ + edits (กล่องที่ซินแสแก้ override ต่อบท) ให้เปิดดวงเก่ามาแก้/ปรินซ้ำได้ ข้ามเครื่อง
-- additive + idempotent: apply script ตัดทีละ statement; CREATE ... IF NOT EXISTS
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_newdata_reading" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_name" text,
  "birth_date" text NOT NULL,
  "birth_time" text NOT NULL,
  "gender" text NOT NULL,
  "province" text,
  "edits" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_newdata_reading_updated_at_idx"
  ON "bazi_newdata_reading" ("updated_at" DESC);
