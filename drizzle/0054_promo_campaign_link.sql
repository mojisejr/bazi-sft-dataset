-- แคมเปญลิงก์ broadcast (บันทึก/แก้ไขได้จาก /ops) — เอ็ม 2026-09-28
-- เก็บค่าที่ใช้ประกอบลิงก์ checkout (แพ็ก + โค้ดส่วนลด + โดเมน + LIFF) ต่อ 1 กิจกรรม เพื่อกลับมาก็อป/แก้ทีหลัง
CREATE TABLE IF NOT EXISTS promo_campaign_link (
  id           text        PRIMARY KEY,
  name         text        NOT NULL,
  package_code text        NOT NULL,
  code         text,
  host         text        NOT NULL,
  liff_id      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
