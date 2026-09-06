-- 0045 — เพิ่มรูปโปรไฟล์ (avatar) ให้ bazi_user_profile (เฟรม edit-personal-info "เปลี่ยนรูปโปรไฟล์")
-- เก็บเป็น base64 ใน DB (รูปเล็ก ~256px jpeg) เพื่อเลี่ยง dependency Supabase Storage ในบางสภาพแวดล้อม
-- ทั้งหมด nullable — โปรไฟล์เดิมไม่กระทบ (fallback = ตัวย่อชื่อตามธาตุเหมือนเดิม)
ALTER TABLE "bazi_user_profile" ADD COLUMN IF NOT EXISTS "avatar_base64" text;
ALTER TABLE "bazi_user_profile" ADD COLUMN IF NOT EXISTS "avatar_mime" text;
ALTER TABLE "bazi_user_profile" ADD COLUMN IF NOT EXISTS "avatar_updated_at" timestamptz;
