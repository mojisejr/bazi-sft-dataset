-- ไพ่ออราเคิลเคี้ยงคุง: ที่เก็บรูปไพ่ (นำเข้าจากไฟล์จริง, JPEG ย่อ, เก็บ URL บน Supabase)
-- additive + idempotent: CREATE TABLE ใช้ IF NOT EXISTS
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_oracle_card_image" (
  "card_no" integer PRIMARY KEY,
  "prompt" text NOT NULL,
  "image_url" text,
  "image_base64" text,
  "mime" text NOT NULL DEFAULT 'image/jpeg',
  "model" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
