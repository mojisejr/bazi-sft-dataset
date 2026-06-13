-- Phase: substitution rules — กฎแทนคำของซินแส ย้ายจากไฟล์ JSON (เขียนไม่ได้บน Vercel) มาเก็บใน DB
-- additive + idempotent: apply script ตัดไฟล์ทีละ statement แล้วยิงทีละอัน (neon-http ไม่รับหลาย statement/DO-block)
-- CREATE TABLE/INDEX ใช้ IF NOT EXISTS
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_substitution_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "scope" text NOT NULL DEFAULT 'topic',
  "topic_id" text,
  "match" text NOT NULL,
  "replacement" text NOT NULL DEFAULT '',
  "note" text,
  "source" jsonb NOT NULL DEFAULT '{"kind":"manual"}'::jsonb,
  "hit_count" integer NOT NULL DEFAULT 0,
  "owner_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_substitution_rules_created_at_idx"
  ON "bazi_substitution_rules" ("created_at" DESC);
