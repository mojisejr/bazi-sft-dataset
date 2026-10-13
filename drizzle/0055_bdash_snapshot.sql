-- ภาพรวมธุรกิจ (bdash) — mumate-business-metrics-001, 2026-10-13
-- ตัวเลขที่ /api/cron/bdash-snapshot คำนวณไว้ทุกคืน (ตี 3 ไทย) · หน้า /bdash อ่านแถวล่าสุดแถวเดียว
-- เพิ่มตารางใหม่อย่างเดียว ไม่แตะตารางเดิม · route ลบแถวที่เก่ากว่า 90 วันเอง
CREATE TABLE IF NOT EXISTS bdash_snapshot (
  as_of       date        PRIMARY KEY,
  computed_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer     NOT NULL,
  payload     jsonb       NOT NULL
);
