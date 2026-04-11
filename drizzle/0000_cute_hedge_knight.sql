CREATE TYPE "public"."scaffold_stage" AS ENUM('scaffolded', 'phase_1_pending');--> statement-breakpoint
CREATE TABLE "scaffold_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_slug" text NOT NULL,
	"status" "scaffold_stage" DEFAULT 'scaffolded' NOT NULL,
	"notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scaffold_metadata_project_slug_unique" UNIQUE("project_slug")
);
