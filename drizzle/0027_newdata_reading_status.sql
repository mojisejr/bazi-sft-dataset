-- Phase: newdata reading — เพิ่มคอลัมน์ "สถานะ" (status: in_progress / done)
-- ให้ mark ดวงว่าคำอ่านเสร็จสิ้นแล้ว (เหมือน reading_sessions) — โชว์ปุ่ม ✓ เสร็จสิ้น ในหน้าประวัติ
-- additive + idempotent: ADD COLUMN IF NOT EXISTS
--> statement-breakpoint
ALTER TABLE "bazi_newdata_reading" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'in_progress';
