-- โหมดเซียน: ย้ายรูปไป Supabase Storage — เพิ่มคอลัมน์ image_url + ปลด NOT NULL ของ image_base64
-- additive + idempotent
--> statement-breakpoint
ALTER TABLE "bazi_divine_card_image" ADD COLUMN IF NOT EXISTS "image_url" text;
--> statement-breakpoint
ALTER TABLE "bazi_divine_card_image" ALTER COLUMN "image_base64" DROP NOT NULL;
