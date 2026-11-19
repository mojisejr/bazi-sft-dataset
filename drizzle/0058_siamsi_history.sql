-- 0058 · ประวัติเซียมซีโป๊ยเซียน (เก็บล่าสุด 20 ใบ/คน) + รีวิว 👍/👎 + ข้อความ → ได้ 3-5 QI ต่อรีวิว, รวมไม่เกิน 100 QI/เดือน (วันไทย)
-- engine สร้างตารางเองตอนใช้ครั้งแรกด้วย (CREATE IF NOT EXISTS) — รันไฟล์นี้ซ้ำได้ไม่พัง
CREATE TABLE IF NOT EXISTS siamsi_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id      text NOT NULL,
  deck         text NOT NULL DEFAULT 'poysian',
  card_no      integer NOT NULL,
  question     text,
  rating       smallint CHECK (rating IN (-1, 1)),
  review       text,
  reward_qi    integer NOT NULL DEFAULT 0,
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS siamsi_history_anon_idx ON siamsi_history (anon_id, created_at DESC);
