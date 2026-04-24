import { z } from "zod";

export const DatasetGenerationSourceSchema = z.enum([
  "manual",
  "csv",
  "queue",
  "agent-import",
  "revision-regeneration",
]);

export const DatasetGenerationProvenanceSchema = z.object({
  source: DatasetGenerationSourceSchema.optional(),
  model: z.string().trim().min(1).optional(),
  promptVersion: z.string().trim().min(1).optional(),
  promptHash: z.string().trim().min(1).optional(),
  referencePackVersion: z.string().trim().min(1).optional(),
  engineVersion: z.string().trim().min(1).optional(),
  calculatedStateHash: z.string().trim().min(1).optional(),
  queueBatchId: z.string().trim().min(1).optional(),
  queueSeed: z.number().int().nonnegative().optional(),
  generatedAt: z.string().trim().min(1).optional(),
}).strict();

export const DatasetRevisionLineageSchema = z.object({
  supersedesRecordId: z.string().uuid().optional(),
  supersededByRecordId: z.string().uuid().optional(),
  revisionRootRecordId: z.string().uuid().optional(),
  latestEffectiveRecordId: z.string().uuid().optional(),
}).strict();

export const DatasetReviewLifecycleStateSchema = z.enum([
  "active",
  "stale",
  "needs-reproof",
  "superseded",
]);

export const DatasetReviewLifecycleSchema = z.object({
  state: DatasetReviewLifecycleStateSchema.optional(),
  staleReason: z.string().trim().min(1).optional(),
  staleAt: z.string().trim().min(1).optional(),
}).strict();

export const DatasetRecordMetadataSchema = z.object({
  customerName: z.string().trim().min(1).optional(),
  sourceFile: z.string().trim().min(1).optional(),
  sourceRow: z.number().int().positive().optional(),
  generation: DatasetGenerationProvenanceSchema.optional(),
  revision: DatasetRevisionLineageSchema.optional(),
  reviewLifecycle: DatasetReviewLifecycleSchema.optional(),
});

export type DatasetRecordMetadataValue = z.infer<typeof DatasetRecordMetadataSchema>;
export type DatasetGenerationProvenanceValue = z.infer<typeof DatasetGenerationProvenanceSchema>;
export type DatasetRevisionLineageValue = z.infer<typeof DatasetRevisionLineageSchema>;
export type DatasetReviewLifecycleValue = z.infer<typeof DatasetReviewLifecycleSchema>;

function compactOptionalObject<T extends Record<string, unknown>>(
  value: T,
): T | undefined {
  return Object.values(value).some((entry) => entry !== undefined) ? value : undefined;
}

export function createDatasetRecordMetadata(
  metadata: DatasetRecordMetadataValue,
): DatasetRecordMetadataValue {
  return DatasetRecordMetadataSchema.parse(metadata);
}

export function mergeDatasetRecordMetadata(
  current: DatasetRecordMetadataValue | undefined,
  next: DatasetRecordMetadataValue,
): DatasetRecordMetadataValue {
  return createDatasetRecordMetadata({
    ...current,
    ...next,
    generation: compactOptionalObject({
      ...current?.generation,
      ...next.generation,
    }),
    revision: compactOptionalObject({
      ...current?.revision,
      ...next.revision,
    }),
    reviewLifecycle: compactOptionalObject({
      ...current?.reviewLifecycle,
      ...next.reviewLifecycle,
    }),
  });
}