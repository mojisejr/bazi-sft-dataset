import { z } from "zod";

export const DatasetRecordMetadataSchema = z.object({
  customerName: z.string().trim().min(1).optional(),
  sourceFile: z.string().trim().min(1).optional(),
  sourceRow: z.number().int().positive().optional(),
});

export type DatasetRecordMetadataValue = z.infer<typeof DatasetRecordMetadataSchema>;

export function createDatasetRecordMetadata(
  metadata: DatasetRecordMetadataValue,
): DatasetRecordMetadataValue {
  return DatasetRecordMetadataSchema.parse(metadata);
}