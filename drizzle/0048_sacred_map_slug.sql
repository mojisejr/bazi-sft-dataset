-- 0048 — slug สำหรับลิงก์แชร์สาธารณะของสถานที่ศักดิ์สิทธิ์ (/p/<slug>)
-- อ่านง่ายกว่า UUID เวลาแชร์เข้า LINE/FB; unique, null ได้จนกว่าจะ gen/backfill
ALTER TABLE "bazi_sacred_map_location" ADD COLUMN IF NOT EXISTS "slug" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bazi_sacred_map_slug_idx" ON "bazi_sacred_map_location" ("slug");
