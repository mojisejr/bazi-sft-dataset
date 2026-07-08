CREATE TABLE IF NOT EXISTS "bazi_mission_progress" (
  "anon_id" text NOT NULL,
  "mission_id" text NOT NULL,
  "period_key" text NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  "claimed_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("anon_id", "mission_id", "period_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_achievement" (
  "anon_id" text NOT NULL,
  "badge_id" text NOT NULL,
  "unlocked_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("anon_id", "badge_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_referral_code" (
  "anon_id" text PRIMARY KEY,
  "code" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bazi_referral_code_code_uq" ON "bazi_referral_code" ("code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_referral_redemption" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" text NOT NULL,
  "referrer_anon_id" text NOT NULL,
  "referee_anon_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bazi_referral_redemption_referee_uq" ON "bazi_referral_redemption" ("referee_anon_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_referral_redemption_referrer_idx" ON "bazi_referral_redemption" ("referrer_anon_id");
