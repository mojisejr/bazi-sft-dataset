CREATE TYPE "public"."bazi_knowledge_domain" AS ENUM('general', 'work', 'study', 'wealth', 'love', 'health', 'family', 'other', 'timing');--> statement-breakpoint
CREATE TYPE "public"."bazi_knowledge_source_format" AS ENUM('csv', 'markdown', 'docx', 'xlsx');--> statement-breakpoint
CREATE TYPE "public"."bazi_matrix_domain" AS ENUM('love', 'work');--> statement-breakpoint
CREATE TYPE "public"."bazi_source_root" AS ENUM('distilled', 'raw');--> statement-breakpoint
ALTER TYPE "public"."intent_domain" ADD VALUE 'study' BEFORE 'wealth';--> statement-breakpoint
ALTER TYPE "public"."intent_domain" ADD VALUE 'other' BEFORE 'timing';--> statement-breakpoint
CREATE TABLE "bazi_canonical_raw_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text NOT NULL,
	"source_group" text NOT NULL,
	"row_order" integer NOT NULL,
	"primary_value" text,
	"secondary_value" text,
	"cells" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bazi_canonical_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relative_path" text NOT NULL,
	"source_root" "bazi_source_root" NOT NULL,
	"source_format" "bazi_knowledge_source_format" NOT NULL,
	"title" text NOT NULL,
	"domain" "bazi_knowledge_domain" DEFAULT 'general' NOT NULL,
	"normalized_table" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bazi_canonical_sources_relative_path_unique" UNIQUE("relative_path")
);
--> statement-breakpoint
CREATE TABLE "bazi_day_master_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text NOT NULL,
	"record_number" integer,
	"day_master_code" text NOT NULL,
	"branch_code" text NOT NULL,
	"day_master_chinese" text,
	"branch_chinese" text,
	"baseline_original" text,
	"day_master_trait" text,
	"merged_baseline" text,
	"interpreted_profile" text,
	"concise_profile" text,
	"combined_narrative" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bazi_day_master_strength_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text NOT NULL,
	"source_variant" text NOT NULL,
	"day_master_code" text,
	"day_master_chinese" text,
	"strength_state" text,
	"score_text" text,
	"qi_label" text,
	"narrative_summary" text,
	"row_order" integer NOT NULL,
	"raw_cells" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bazi_domain_matrices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text NOT NULL,
	"domain" "bazi_matrix_domain" NOT NULL,
	"source_variant" text NOT NULL,
	"pair_key" text,
	"row_order" integer NOT NULL,
	"code" text,
	"label" text,
	"score_text" text,
	"narrative" text,
	"raw_cells" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bazi_element_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text NOT NULL,
	"source_table" text NOT NULL,
	"day_master" text,
	"left_symbol" text NOT NULL,
	"right_symbol" text,
	"relation_type" text NOT NULL,
	"qi_label" text,
	"note" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bazi_faq_taxonomies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text NOT NULL,
	"row_group" integer NOT NULL,
	"question_order" integer NOT NULL,
	"raw_type_label" text NOT NULL,
	"primary_intent" "bazi_knowledge_domain" NOT NULL,
	"intent_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"question_text" text NOT NULL,
	"normalized_question" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bazi_reference_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"domain" "bazi_knowledge_domain" DEFAULT 'general' NOT NULL,
	"content" text NOT NULL,
	"headings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bazi_reference_documents_source_path_unique" UNIQUE("source_path"),
	CONSTRAINT "bazi_reference_documents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "bazi_sixty_jiazi_narratives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text NOT NULL,
	"row_group" integer NOT NULL,
	"day_master_code" text NOT NULL,
	"day_master_chinese" text NOT NULL,
	"branch_code" text NOT NULL,
	"branch_chinese" text NOT NULL,
	"element_tone" text,
	"twelve_qi_label" text,
	"day_master_narrative" text,
	"branch_narrative" text,
	"combined_narrative" text,
	"raw_cells" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bazi_time_solar_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text,
	"label" text NOT NULL,
	"solar_term_name" text,
	"boundary_at" text,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bazi_twelve_qi_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text NOT NULL,
	"stage_order" integer NOT NULL,
	"stage_name_chinese" text NOT NULL,
	"stage_name_thai" text NOT NULL,
	"day_master" text NOT NULL,
	"branch" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
