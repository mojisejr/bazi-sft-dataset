CREATE TABLE IF NOT EXISTS "louise_hay_crisis_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anon_id" text NOT NULL,
	"detected_by" text NOT NULL,
	"matched_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "louise_hay_crisis_log_anon_idx" ON "louise_hay_crisis_log" ("anon_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "louise_hay_crisis_log_created_idx" ON "louise_hay_crisis_log" ("created_at");
