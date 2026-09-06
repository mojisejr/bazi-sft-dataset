-- 0046 — เก็บรูปสถานที่ศักดิ์สิทธิ์เป็น base64 ใน DB (เสิร์ฟผ่าน engine เอง ไม่พึ่ง Supabase Storage)
-- เหตุผล: imageUrl เดิมชี้ Supabase ซึ่งบางสภาพแวดล้อม DNS ไม่ถึง → รูปไม่ขึ้น. เก็บ bytes ใน DB
-- แล้วเสิร์ฟที่ GET /api/sacred-map/image/[id] ทำให้รูปขึ้นทั้ง dev + prod (มิเรอร์วิธีหน้าไพ่)
ALTER TABLE "bazi_sacred_map_location" ADD COLUMN IF NOT EXISTS "image_base64" text;
ALTER TABLE "bazi_sacred_map_location" ADD COLUMN IF NOT EXISTS "image_mime" text;
