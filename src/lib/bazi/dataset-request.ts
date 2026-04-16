import { z } from "zod";

import {
  AnnotationDataSchema,
  CalculatedStateSchema,
  DraftAnnotationDataSchema,
  RawInputSchema,
  type CalculatedStateValue,
  type RawInputValue,
  type StoredAnnotationDataValue,
} from "@/lib/bazi/schema-types";

export const SaveDatasetStatusSchema = z.enum(["draft", "reviewed"]);

export const BaseSaveDatasetRequestSchema = z
  .object({
    recordId: z.string().uuid().optional(),
    rawInput: RawInputSchema,
    calculatedState: CalculatedStateSchema,
    annotationData: DraftAnnotationDataSchema,
    status: SaveDatasetStatusSchema,
  })
  .superRefine((value, context) => {
    if (value.status !== "reviewed") {
      return;
    }

    const reviewedResult = AnnotationDataSchema.safeParse(value.annotationData);

    if (!reviewedResult.success) {
      for (const issue of reviewedResult.error.issues) {
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