-- Phase: newdata reading — เพิ่มคอลัมน์ "ป้ายเครื่อง" (device_label)
-- ให้รู้ว่าดวงนี้สร้าง/แก้จากเครื่องไหน (เช่น "เครื่องซินแส") แยกงานซินแสจากเครื่องอื่น
-- additive + idempotent: ADD COLUMN IF NOT EXISTS
--> statement-breakpoint
ALTER TABLE "bazi_newdata_reading" ADD COLUMN IF NOT EXISTS "device_label" text;
