-- mascot 60 ดิถี: ที่เก็บ "ลิงก์" รูป mascot ตามเสาวัน (60 กะจื่อ) + ชื่อ
-- รูปจริงอยู่บน Supabase Storage; ตารางนี้เก็บ URL + ชื่อไทย/อังกฤษ
-- additive + idempotent: CREATE TABLE ใช้ IF NOT EXISTS
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_mascot_image" (
  "ganzhi" text PRIMARY KEY,
  "name_th" text NOT NULL,
  "name_en" text NOT NULL,
  "image_url" text,
  "mime" text NOT NULL DEFAULT 'image/png',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
