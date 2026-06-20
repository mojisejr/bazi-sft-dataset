-- Phase: reading NewData — "ข้อมูลหลักแบบใหม่" คำอ่านชุดใหม่ที่ซินแสส่งเข้ามา (knownlage/NewData)
-- เก็บเป็น dictionary ของ "ก้อนความรู้พื้นฐาน (primitive)" ที่ engine คำนวณออกมาแล้วหยิบไป lookup
--   group_key = ชนิดก้อนความรู้ (เช่น "shengxiang", "clash", "phua", "edu_level"…) — 1 group ต่อ 1 ไฟล์
--   item_key  = คีย์ภายในก้อน (เช่น "กวงตั่ว", "子-午", "甲午") — ตรงกับค่าที่ engine คำนวณได้
-- value = { text, label?, category?, branches?, combos? } — ช่องที่ซินแสแก้/เพิ่มได้ในอนาคต
-- additive + idempotent: apply script ตัดไฟล์ทีละ statement แล้วยิงทีละอัน (neon-http ไม่รับหลาย statement/DO-block)
-- CREATE TABLE/INDEX ใช้ IF NOT EXISTS; ถ้ามีอยู่แล้วได้ error 42P07 ซึ่ง apply script กลืนทิ้ง
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_newdata" (
  "group_key" text NOT NULL,
  "item_key" text NOT NULL,
  "ordinal" integer NOT NULL DEFAULT 0,
  "value" jsonb NOT NULL,
  "source_file" text,
  "updated_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "bazi_newdata_pk" PRIMARY KEY ("group_key", "item_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_newdata_group_key_idx"
  ON "bazi_newdata" ("group_key", "ordinal");
