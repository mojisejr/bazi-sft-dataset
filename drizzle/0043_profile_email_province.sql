-- 0043 — เพิ่ม email + จังหวัดที่เกิด ให้ bazi_user_profile (เฟรม edit-personal-info / edit-birth-data)
-- อีเมล: ใช้ส่งใบเสร็จ/ไฟล์ข้อมูลส่วนตัว · birth_province: ใช้คำนวณเวลาสุริยคติให้แม่นขึ้น
-- ทั้งคู่ nullable — โปรไฟล์เดิมไม่กระทบ; การแก้จังหวัดไม่ผูกโควตาแก้วันเกิด (คนละฟิลด์)
ALTER TABLE "bazi_user_profile" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "bazi_user_profile" ADD COLUMN IF NOT EXISTS "birth_province" text;
