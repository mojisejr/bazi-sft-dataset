-- 0041 — profile เต็ม (edit-personal-info / edit-birth-data ก้อน 3): ขยาย bazi_user_profile
-- จาก @name อย่างเดียว ให้เก็บข้อมูลส่วนตัว + วันเกิดได้. ADDITIVE ONLY.
-- birth_date text 'YYYY-MM-DD' · birth_time text 'HH:mm' (time_unknown=true แล้ว birth_time เมิน)
-- ตาม convention rawInput ของ bazi_saved_chart; เขตเวลาไม่เก็บ (วันเกิดเป็นข้อเท็จจริงท้องถิ่น)
ALTER TABLE bazi_user_profile ADD COLUMN IF NOT EXISTS first_name text;
--> statement-breakpoint
ALTER TABLE bazi_user_profile ADD COLUMN IF NOT EXISTS last_name text;
--> statement-breakpoint
ALTER TABLE bazi_user_profile ADD COLUMN IF NOT EXISTS gender text;
--> statement-breakpoint
ALTER TABLE bazi_user_profile ADD COLUMN IF NOT EXISTS birth_date text;
--> statement-breakpoint
ALTER TABLE bazi_user_profile ADD COLUMN IF NOT EXISTS birth_time text;
--> statement-breakpoint
ALTER TABLE bazi_user_profile ADD COLUMN IF NOT EXISTS time_unknown boolean NOT NULL DEFAULT false;
--> statement-breakpoint
-- คำขอพิจารณาแก้วันเกิด (เฟรม edit-birth-data — correction request sheet): ฟรีครั้งเดียว,
-- ครั้งถัดไปใช้ชี่ (catalog spend line birth_edit); คำขอนี้สำหรับเคสพิเศษ/ข้อความถึงทีม
CREATE TABLE IF NOT EXISTS bazi_correction_request (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "anon_id" text NOT NULL,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
