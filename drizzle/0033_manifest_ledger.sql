CREATE TABLE IF NOT EXISTS "bazi_wallet" (
  "anon_id" text PRIMARY KEY,
  "coins" integer NOT NULL DEFAULT 0,
  "xp" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_ledger_txn" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "anon_id" text NOT NULL,
  "coin_delta" integer NOT NULL DEFAULT 0,
  "xp_delta" integer NOT NULL DEFAULT 0,
  "reason" text NOT NULL,
  "ref" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_ledger_txn_user_idx" ON "bazi_ledger_txn" ("anon_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_manifest_goal" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "anon_id" text NOT NULL,
  "title" text NOT NULL,
  "affirmation" text,
  "image_url" text,
  "status" text NOT NULL DEFAULT 'active',
  "ordinal" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_manifest_goal_user_idx" ON "bazi_manifest_goal" ("anon_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_manifest_task" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "goal_id" uuid NOT NULL,
  "anon_id" text NOT NULL,
  "title" text NOT NULL,
  "target_count" integer NOT NULL DEFAULT 1,
  "is_daily" boolean NOT NULL DEFAULT true,
  "ordinal" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_manifest_task_goal_idx" ON "bazi_manifest_task" ("goal_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_manifest_checkin" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL,
  "anon_id" text NOT NULL,
  "entry_date" text NOT NULL,
  "count" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bazi_manifest_checkin_task_date_uq" ON "bazi_manifest_checkin" ("task_id", "entry_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_manifest_checkin_user_date_idx" ON "bazi_manifest_checkin" ("anon_id", "entry_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bazi_manifest_entry" (
  "anon_id" text NOT NULL,
  "entry_date" text NOT NULL,
  "mood" integer,
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("anon_id", "entry_date")
);
