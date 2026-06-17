-- Phase: reading PDF versions — snapshot เวอร์ชัน PDF ที่บันทึก (insert-only, หลายเวอร์ชันต่อ 1 ดวง)
-- additive + idempotent: apply script ตัดไฟล์ทีละ statement แล้วยิงทีละอัน (neon-http ไม่รับหลาย statement/DO-block)
-- ใช้ enum "reading_session_status" เดิม (สร้างแล้วใน 0007) — ที่นี่ไม่สร้าง type ซ้ำ
-- CREATE TABLE/INDEX ใช้ IF NOT EXISTS; ถ้าตารางมีอยู่แล้วจะได้ error 42P07 ซึ่ง apply script กลืนทิ้ง
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_reading_pdf_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid,
  "label" text,
  "version_note" text,
  "birth_date" text NOT NULL,
  "birth_time" text NOT NULL,
  "gender" text NOT NULL,
  "day_master" text,
  "provider" text NOT NULL DEFAULT 'gemini',
  "status" "reading_session_status" NOT NULL DEFAULT 'in_progress',
  "raw_input" jsonb NOT NULL,
  "calculated_state" jsonb,
  "session_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "owner_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_reading_pdf_versions_session_id_idx"
  ON "bazi_reading_pdf_versions" ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_reading_pdf_versions_created_at_idx"
  ON "bazi_reading_pdf_versions" ("created_at" DESC);
