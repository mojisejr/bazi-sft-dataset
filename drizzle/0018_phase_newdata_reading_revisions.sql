-- Phase: newdata reading revisions — "ประวัติการบันทึก" ของ tab อ่าน 15 บท (NewData), insert-only หลายเวอร์ชันต่อ 1 ดวง
-- มิเรอร์แนวคิดจาก bazi_reading_session_revisions แต่เก็บ edits (boxes+titles) ของ NewData
-- สร้างอัตโนมัติทุกครั้งที่กด "บันทึกดวงนี้" → ย้อนเปิดดู/กู้คืนสภาพงานแต่ละครั้งได้ (เก็บ ~30 ล่าสุด/ดวง)
-- ผูก FK ON DELETE CASCADE กับ bazi_newdata_reading → ลบดวงแล้วประวัติหายตาม
-- additive + idempotent: apply script ตัดไฟล์ทีละ statement (neon-http ไม่รับหลาย statement/DO-block)
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_newdata_reading_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reading_id" uuid NOT NULL REFERENCES "bazi_newdata_reading" ("id") ON DELETE CASCADE,
  "client_name" text,
  "birth_date" text NOT NULL,
  "birth_time" text NOT NULL,
  "gender" text NOT NULL,
  "province" text,
  "edits" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_newdata_reading_revisions_reading_id_idx"
  ON "bazi_newdata_reading_revisions" ("reading_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_newdata_reading_revisions_created_at_idx"
  ON "bazi_newdata_reading_revisions" ("created_at" DESC);
