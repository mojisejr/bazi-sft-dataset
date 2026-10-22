-- 0057 · คลังคำถามที่ผู้ใช้ถาม AI (เสี่ยวมู่/เสี่ยวมี่) เพื่อคัดกรองไปเทรน — เก็บเฉพาะคนที่ยินยอม (bazi_consent kind='ai_training')
-- เก็บแต่คำถาม ไม่เก็บคำตอบ (เอ็ม 2026-10-22) · ตัดข้อมูลระบุตัวตน (เบอร์/อีเมล/เลขยาว/ลิงก์) ก่อนบันทึก
-- subject = HMAC-SHA256(anon_id) — ย้อนหาตัวคนไม่ได้ แต่ลบทั้งหมดของคนที่ถอนความยินยอมได้
-- อายุเก็บ 2 ปี (ลบด้วย purge ใน /api/ops/ai-questions)
CREATE TABLE IF NOT EXISTS ai_question_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     text NOT NULL,
  question    text NOT NULL,
  source      text NOT NULL DEFAULT 'chat',
  persona     text,
  topic_id    text,
  label       text CHECK (label IN ('good','bad')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_question_log_subject_idx ON ai_question_log (subject);
CREATE INDEX IF NOT EXISTS ai_question_log_created_idx ON ai_question_log (created_at DESC);
