-- 0042 — ก้อน 4 (Settings & Privacy) + ก้อน 2 (ลบบัญชี): ความยินยอม · ตั้งค่าแจ้งเตือน ·
-- บทความช่วยเหลือ (help-faq / document-reader) · ลบบัญชีแบบพัก 30 วัน. ADDITIVE ONLY.
CREATE TABLE IF NOT EXISTS bazi_consent (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "anon_id" text NOT NULL,
  "kind" text NOT NULL,             -- pdpa | marketing | ...
  "version" text NOT NULL,          -- '2026-09' ฯลฯ
  "accepted" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bazi_consent_anon_idx ON bazi_consent ("anon_id", "kind");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS bazi_notification_prefs (
  "anon_id" text PRIMARY KEY,
  "daily_fortune" boolean NOT NULL DEFAULT true,
  "reminders" boolean NOT NULL DEFAULT true,
  "updates" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS bazi_help_article (
  "slug" text PRIMARY KEY,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS bazi_account_deletion (
  "anon_id" text PRIMARY KEY,
  "status" text NOT NULL DEFAULT 'pending',   -- pending | canceled | purged
  "reason" text,
  "feedback" text,
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  "purge_at" timestamptz NOT NULL,
  "canceled_at" timestamptz
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bazi_account_deletion_due_idx ON bazi_account_deletion ("purge_at")
  WHERE "status" = 'pending';
