-- โหมดเซียน: ที่เก็บรูปไพ่จิตวิญญาณแดนสวรรค์ (สร้างล่วงหน้าด้วย Imagen, base64)
-- additive + idempotent: CREATE TABLE ใช้ IF NOT EXISTS
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_divine_card_image" (
  "card_no" integer PRIMARY KEY,
  "prompt" text NOT NULL,
  "image_base64" text NOT NULL,
  "mime" text NOT NULL DEFAULT 'image/png',
  "model" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
