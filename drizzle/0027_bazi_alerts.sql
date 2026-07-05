CREATE TABLE IF NOT EXISTS "bazi_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_user_id" text NOT NULL,
	"target_date" text NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"birth_key" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_alerts_due_idx" ON "bazi_alerts" ("status","target_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bazi_alerts_user_idx" ON "bazi_alerts" ("line_user_id");
