-- Qi Point System — additive, idempotent.
-- ขยาย wallet/ledger ให้มี "qi" (แต้มกิจกรรม แยกจาก coins/xp) + 3 ตารางใหม่:
--   bazi_entitlement (สิทธิ์ที่แลกได้), bazi_qi_claim (กันจ่ายซ้ำต่อรอบ), bazi_feature_quota (โควตาฟรีรายวัน)
ALTER TABLE "bazi_wallet" ADD COLUMN IF NOT EXISTS "qi" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "bazi_ledger_txn" ADD COLUMN IF NOT EXISTS "qi_delta" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
-- สิทธิ์ที่ user แลก/ได้รับ. สองทรงในตารางเดียว:
--   credit-based (card_use/chat_question/matching_slot): credits = จำนวนคงเหลือ, sku = null
--   owned/expiry (course/book/tier): มีแถว = เป็นเจ้าของ, tier ใช้ expires_at
CREATE TABLE IF NOT EXISTS "bazi_entitlement" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "anon_id" text NOT NULL,
  "kind" text NOT NULL,
  "sku" text NOT NULL DEFAULT '',
  "credits" integer NOT NULL DEFAULT 0,
  "expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- 1 สิทธิ์ต่อ (anonId, kind, sku) — kind แบบ credit/no-sku ใช้ sku = '' (NOT NULL) ให้ unique ทำงาน
CREATE UNIQUE INDEX IF NOT EXISTS "bazi_entitlement_owner_uq" ON "bazi_entitlement" ("anon_id", "kind", "sku");
--> statement-breakpoint
-- กันจ่ายแต้ม earn ซ้ำต่อรอบ. period_key: "all" (once) / "YYYY-MM-DD" (daily) / ref (per_referral)
CREATE TABLE IF NOT EXISTS "bazi_qi_claim" (
  "anon_id" text NOT NULL,
  "code" text NOT NULL,
  "period_key" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("anon_id", "code", "period_key")
);
--> statement-breakpoint
-- โควตาฟรีต่อฟีเจอร์รายวัน (reset โดย period_key = วันไทย). used = ใช้ไปกี่ครั้งในรอบนั้น
CREATE TABLE IF NOT EXISTS "bazi_feature_quota" (
  "anon_id" text NOT NULL,
  "feature" text NOT NULL,
  "period_key" text NOT NULL,
  "used" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("anon_id", "feature", "period_key")
);
--> statement-breakpoint
-- เปิดใช้ ownerId ที่ dormant อยู่ใน saved_chart (matching slot ต่อ user)
CREATE INDEX IF NOT EXISTS "bazi_saved_chart_owner_idx" ON "bazi_saved_chart" ("owner_id");
