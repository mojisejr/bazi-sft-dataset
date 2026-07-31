-- mascot v2 (ชุดตัวละคร UI v2): เพิ่มคอลัมน์ image_url_v2 (nullable) ลง bazi_mascot_image
-- additive + idempotent: ไม่แตะ image_url เดิม, ไม่แก้แถวเดิมสักแถว
--   ⇒ v1 + PDF ของ bazi อ่าน image_url เหมือนเดิมเป๊ะ
--   ⇒ v2 อ่านเฉพาะ image_url_v2 (ไม่มี = ซ่อนการ์ด, ไม่ fallback รูปเก่า)
-- ย้อนกลับ: DROP COLUMN image_url_v2 = กลับสภาพเดิมทันที
--> statement-breakpoint
ALTER TABLE "bazi_mascot_image" ADD COLUMN IF NOT EXISTS "image_url_v2" text;
