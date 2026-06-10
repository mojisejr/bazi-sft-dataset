-- Phase: reading history — บันทึก/แก้ต่อ/ปริ้นซ้ำ การดูดวง (แยกจาก bazi_dataset_records ของ SFT)
-- additive + idempotent: apply script ตัดไฟล์ทีละ statement แล้วยิงทีละอัน (neon-http ไม่รับหลาย statement/DO-block)
-- CREATE TABLE/INDEX ใช้ IF NOT EXISTS; ส่วน CREATE TYPE ที่ซ้ำจะได้ error duplicate_object 42710 ซึ่ง apply script กลืนทิ้ง
--> statement-breakpoint
CREATE TYPE "reading_session_status" AS ENUM ('in_progress', 'done');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_reading_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "label" text,
  "birth_date" text NOT NULL,
  "birth_time" text NOT NULL,
  "gender" text NOT NULL,
  "day_master" text,
  "provider" text NOT NULL DEFAULT 'gemini',
  "status" "reading_session_status" NOT NULL DEFAULT 'in_progress',
  "raw_input" jsonb NOT NULL,
  "calculated_state" jsonb,
  "session_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "owner_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_reading_sessions_updated_at_idx"
  ON "bazi_reading_sessions" ("updated_at" DESC);
