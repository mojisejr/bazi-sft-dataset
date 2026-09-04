-- User profile display name (@name) — additive, idempotent.
-- team.mp4 2026-09: ตั้ง @name ไม่ซ้ำกันตอนสมัคร (คนเก่าที่ยังไม่ตั้ง = ไม่มีแถว ตั้งได้ฟรี)
-- โชว์คู่ชื่อจริงในระบบเพื่อน/ดวงสมพงษ์ เหมือน LINE; unique แบบไม่สนตัวพิมพ์ (lower)
CREATE TABLE IF NOT EXISTS "bazi_user_profile" (
  "anon_id" text PRIMARY KEY,
  "display_name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bazi_user_profile_display_name_lower_uq" ON "bazi_user_profile" (lower("display_name"));
