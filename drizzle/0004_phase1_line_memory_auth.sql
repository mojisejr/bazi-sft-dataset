ALTER TYPE "public"."dataset_status" ADD VALUE 'rejected' BEFORE 'exported';--> statement-breakpoint
CREATE TABLE "bazi_chat_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_user_id" text NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bazi_chat_histories_line_user_id_unique" UNIQUE("line_user_id")
);
--> statement-breakpoint
CREATE TABLE "user_line_mappings" (
	"clerk_user_id" text PRIMARY KEY NOT NULL,
	"line_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_line_mappings_line_user_id_unique" UNIQUE("line_user_id")
);
--> statement-breakpoint
ALTER TABLE "bazi_dataset_records" DROP CONSTRAINT "bazi_dataset_records_reviewed_content_check";--> statement-breakpoint
ALTER TABLE "bazi_dataset_records" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "bazi_dataset_records" ADD CONSTRAINT "bazi_dataset_records_reviewed_content_check" CHECK ((
        (
          "bazi_dataset_records"."status" <> 'reviewed'
          AND "bazi_dataset_records"."status" <> 'rejected'
        )
        OR (
          "bazi_dataset_records"."status" = 'reviewed'
          AND
          "bazi_dataset_records"."annotation_data" IS NOT NULL
          AND jsonb_typeof("bazi_dataset_records"."annotation_data") = 'object'
          AND nullif(btrim("bazi_dataset_records"."annotation_data" ->> 'sinsaeProofNote'), '') IS NOT NULL
          AND jsonb_typeof("bazi_dataset_records"."annotation_data" -> 'dimensions') = 'array'
          AND jsonb_array_length("bazi_dataset_records"."annotation_data" -> 'dimensions') = $1
          AND NOT jsonb_path_exists(
            "bazi_dataset_records"."annotation_data",
            '$.dimensions[*] ? (@.dimension_name == null || @.dimension_name == "" || @.thought_process == null || @.thought_process == "" || @.final_prediction == null || @.final_prediction == "")'
          )
        )
        OR (
          "bazi_dataset_records"."status" = 'rejected'
          AND "bazi_dataset_records"."annotation_data" IS NOT NULL
          AND jsonb_typeof("bazi_dataset_records"."annotation_data") = 'object'
          AND nullif(btrim("bazi_dataset_records"."annotation_data" ->> 'sinsaeProofNote'), '') IS NOT NULL
        )
      ));