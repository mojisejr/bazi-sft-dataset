CREATE TABLE IF NOT EXISTS "louise_hay_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anon_id" text NOT NULL,
	"birth_key" text,
	"question" text NOT NULL,
	"answer_preview" text,
	"route" text NOT NULL,
	"model" text NOT NULL,
	"used_own_key" boolean DEFAULT false NOT NULL,
	"classify_in_tokens" integer DEFAULT 0 NOT NULL,
	"classify_out_tokens" integer DEFAULT 0 NOT NULL,
	"embed_tokens" integer DEFAULT 0 NOT NULL,
	"gen_in_tokens" integer DEFAULT 0 NOT NULL,
	"gen_out_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "louise_hay_usage_anon_idx" ON "louise_hay_usage" ("anon_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "louise_hay_usage_created_idx" ON "louise_hay_usage" ("created_at");
