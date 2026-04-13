ALTER TABLE "bazi_dataset_records" DROP CONSTRAINT "bazi_dataset_records_reviewed_content_check";--> statement-breakpoint
ALTER TABLE "bazi_dataset_records" ADD COLUMN "annotation_data" jsonb;--> statement-breakpoint
ALTER TABLE "bazi_dataset_records" DROP COLUMN "chain_of_thought";--> statement-breakpoint
ALTER TABLE "bazi_dataset_records" DROP COLUMN "target_output";--> statement-breakpoint
ALTER TABLE "bazi_dataset_records" ADD CONSTRAINT "bazi_dataset_records_reviewed_content_check" CHECK ((
        "bazi_dataset_records"."status" <> 'reviewed'
        OR (
          "bazi_dataset_records"."annotation_data" IS NOT NULL
          AND jsonb_typeof("bazi_dataset_records"."annotation_data") = 'object'
          AND jsonb_typeof("bazi_dataset_records"."annotation_data" -> 'dimensions') = 'array'
          AND jsonb_array_length("bazi_dataset_records"."annotation_data" -> 'dimensions') = 15
          AND NOT jsonb_path_exists(
            "bazi_dataset_records"."annotation_data",
            '$.dimensions[*] ? (@.dimension_name == null || @.dimension_name == "" || @.thought_process == null || @.thought_process == "" || @.final_prediction == null || @.final_prediction == "")'
          )
        )
      ));
