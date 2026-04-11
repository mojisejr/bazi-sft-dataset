CREATE TYPE "public"."dataset_status" AS ENUM('draft', 'reviewed', 'exported');--> statement-breakpoint
CREATE TYPE "public"."intent_domain" AS ENUM('general', 'work', 'wealth', 'love', 'health', 'family', 'timing');--> statement-breakpoint
CREATE TABLE "bazi_dataset_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_input" jsonb NOT NULL,
	"calculated_state" jsonb NOT NULL,
	"intent_domain" "intent_domain" DEFAULT 'general' NOT NULL,
	"chain_of_thought" text,
	"target_output" text,
	"status" "dataset_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bazi_dataset_records_reviewed_content_check" CHECK ((
        "bazi_dataset_records"."status" <> 'reviewed'
        OR (
          nullif(btrim("bazi_dataset_records"."chain_of_thought"), '') IS NOT NULL
          AND nullif(btrim("bazi_dataset_records"."target_output"), '') IS NOT NULL
        )
      ))
);
