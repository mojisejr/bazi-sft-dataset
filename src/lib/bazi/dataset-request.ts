import { z } from "zod";

import { DatasetRecordMetadataSchema } from "@/lib/bazi/dataset-metadata";
import {
  AnnotationDataSchema,
  CalculatedStateSchema,
  DraftAnnotationDataSchema,
  RejectedAnnotationDataSchema,
  RawInputSchema,
  type CalculatedStateValue,
  type RawInputValue,
  type StoredAnnotationDataValue,
} from "@/lib/bazi/schema-types";

const SaveDatasetIntentDomainSchema = z.enum([
  "general",
  "work",
  "study",
  "wealth",
  "love",
  "health",
  "family",
  "other",
  "timing",
]);

export const SaveDatasetStatusSchema = z.enum(["draft", "reviewed", "rejected"]);

export const BaseSaveDatasetRequestSchema = z
  .object({
    recordId: z.string().uuid().optional(),
    rawInput: RawInputSchema,
    calculatedState: CalculatedStateSchema,
    intentDomain: SaveDatasetIntentDomainSchema.optional(),
    annotationData: DraftAnnotationDataSchema,
    status: SaveDatasetStatusSchema,
    metadata: DatasetRecordMetadataSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "draft") {
      return;
    }

    const validationResult = (value.status === "reviewed"
      ? AnnotationDataSchema
      : RejectedAnnotationDataSchema).safeParse(value.annotationData);

    if (!validationResult.success) {
      for (const issue of validationResult.error.issues) {
        context.addIssue({
          ...issue,
          path: ["annotationData", ...issue.path],
        });
      }
    }
  });

export type SaveDatasetStatus = z.infer<typeof SaveDatasetStatusSchema>;
export type SaveDatasetRequest = z.infer<typeof BaseSaveDatasetRequestSchema>;

export function createDraftAnnotationPayload(
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
  annotationData: StoredAnnotationDataValue,
  status: SaveDatasetStatus,
  recordId?: string,
  metadata?: z.infer<typeof DatasetRecordMetadataSchema>,
): SaveDatasetRequest {
  return BaseSaveDatasetRequestSchema.parse({
    recordId,
    rawInput,
    calculatedState,
    annotationData,
    status,
    metadata,
  });
}
