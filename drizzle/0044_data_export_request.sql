-- 0044 — คำขอส่งออกข้อมูลส่วนตัวแบบ async (เฟรม privacy-data-export / PDPA)
-- FE กด "ขอไฟล์ข้อมูลของฉัน" → บันทึกคำขอ (status=collecting) → (รอ email provider) ส่งไฟล์ JSON+CSV
-- ทางอีเมลภายใน 30 วัน. ตารางนี้ทำให้สถานะ "กำลังรวบรวม" คงอยู่จริง (ไม่ใช่ state ลอยฝั่ง FE).
CREATE TABLE IF NOT EXISTS "bazi_data_export_request" (
  "id" text PRIMARY KEY,
  "anon_id" text NOT NULL,
  "email" text,
  "format" text NOT NULL DEFAULT 'json+csv',
  "status" text NOT NULL DEFAULT 'collecting', -- collecting | ready | emailed | failed
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "delivered_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "bazi_data_export_request_anon_idx" ON "bazi_data_export_request" ("anon_id");
