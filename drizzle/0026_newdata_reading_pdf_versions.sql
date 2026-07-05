-- Phase: newdata reading — ตาราง "เวอร์ชัน PDF" (สแน็ปช็อต edits ที่กดบันทึกเวอร์ชันเอง)
-- แยกจาก working edits + revisions (autosave) → ทีม PDF บันทึก/ย้อน/กู้เวอร์ชันที่จัดหน้าเสร็จได้
-- additive + idempotent: CREATE TABLE IF NOT EXISTS
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_newdata_reading_pdf_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reading_id" uuid NOT NULL REFERENCES "bazi_newdata_reading"("id") ON DELETE CASCADE,
  "client_name" text,
  "birth_date" text NOT NULL,
  "birth_time" text NOT NULL,
  "gender" text NOT NULL,
  "province" text,
  "version_note" text,
  "edits" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_newdata_reading_pdf_versions_reading_idx"
  ON "bazi_newdata_reading_pdf_versions" ("reading_id", "created_at" DESC);
