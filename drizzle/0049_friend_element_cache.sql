-- 0049 — cache "ธาตุประจำวัน (day-master element) ต่อ birth-signature" แบบทน cold start / ข้าม instance.
-- เหตุผล: GET /api/missions คำนวณ chart เต็ม "ต่อเพื่อน 1 คน" เพื่อหา day-master element (สะสม 5 ธาตุ).
--   เดิมมีแค่ module-level Map (friendElementMemo) ที่หายทุก cold start และไม่ share ข้าม Vercel serverless
--   instance → ผู้ใช้ที่ชวนหลายคนยังเจอ ~8-10s บ่อย (N+1 คำนวณสด). ธาตุประจำวันเป็น birth-deterministic
--   (ไม่เปลี่ยนตามเวลา) → เก็บลง DB คืนทันที ทุก instance hit ร่วมกัน.
-- sig = birthDate|birthTime|gender|province (คีย์เดียวกับที่ป้อน engine) — หลายเพื่อนที่เกิดเหมือนกัน = แถวเดียว.
-- element = ชื่อธาตุไทย (STEM_TO_ELEMENT). เก็บเฉพาะผลที่คำนวณสำเร็จ (ไม่ cache ค่าล้มเหลวถาวร).
-- ADDITIVE/idempotent — ไม่กระทบตารางอื่น. route อ่าน/เขียนแบบ best-effort: ยังไม่ migrate → คำนวณสด.
CREATE TABLE IF NOT EXISTS "bazi_friend_element_cache" (
  "sig"        text PRIMARY KEY,
  "element"    text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
