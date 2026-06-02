CREATE TABLE "bazi_user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"line_user_id" text,
	"birth_date" text,
	"birth_time" text,
	"gender" text,
	"is_profile_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bazi_user_profiles_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "bazi_user_profiles_line_user_id_unique" UNIQUE("line_user_id")
);
--> statement-breakpoint
ALTER TABLE "bazi_chat_histories" ALTER COLUMN "line_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bazi_chat_histories" ADD COLUMN "clerk_user_id" text;--> statement-breakpoint
ALTER TABLE "bazi_chat_histories" ADD COLUMN "context_summary" text;--> statement-breakpoint
ALTER TABLE "bazi_chat_histories" ADD CONSTRAINT "bazi_chat_histories_clerk_user_id_unique" UNIQUE("clerk_user_id");