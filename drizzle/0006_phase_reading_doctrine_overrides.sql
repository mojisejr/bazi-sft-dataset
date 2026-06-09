-- Phase: online doctrine editing — override "วิธีการอ่านรายบท" ที่ซินแสปรับออนไลน์
-- additive + idempotent (ไม่กระทบข้อมูลเดิม)
CREATE TABLE IF NOT EXISTS "bazi_reading_doctrine_overrides" (
  "topic_id" text PRIMARY KEY,
  "override" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_by" text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
