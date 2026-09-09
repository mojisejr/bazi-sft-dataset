-- 0047 — metadata แชท Mate AI (เสี่ยวมู่/เสี่ยวมี่) สำหรับ analytics /ops. เก็บ "ไม่มีเนื้อหาข้อความ"
-- (PDPA-safe): แค่ persona/หัวข้อ/ช่วงเวลา/เวลา — 1 แถวต่อ 1 คำตอบจริง. ADDITIVE/idempotent.
CREATE TABLE IF NOT EXISTS "mate_ai_chat_meta" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "anon_id"    text NOT NULL,
  "persona"    text,
  "topic_id"   text,
  "timeframe"  text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mate_ai_chat_meta_user_idx" ON "mate_ai_chat_meta" ("anon_id", "created_at");
