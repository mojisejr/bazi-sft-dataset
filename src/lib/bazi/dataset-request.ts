import { z } from "zod";

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

export const SaveDatasetStatusSchema = z.enum(["draft", "reviewed", "rejected"]);

export const BaseSaveDatasetRequestSchema = z
  .object({
    recordId: z.string().uuid().optional(),
    rawInput: RawInputSchema,
    calculatedState: CalculatedStateSchema,
    annotationData: DraftAnnotationDataSchema,
    status: SaveDatasetStatusSchema,
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
): SaveDatasetRequest {
  return BaseSaveDatasetRequestSchema.parse({
    recordId,
    rawInput,
    calculatedState,
    annotationData,
    status,
  });
}