import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  DatasetRecordMetadataSchema,
  createDatasetRecordMetadata,
} from "@/lib/bazi/dataset-metadata";
import {
  BaseSaveDatasetRequestSchema,
  type SaveDatasetRequest,
} from "@/lib/bazi/dataset-request";
import {
  addAnnotationDimensionIssues,
  CalculatedStateSchema,
  DimensionSchema,
  RawInputSchema,
  REQUIRED_ANNOTATION_DIMENSION_COUNT,
  type RawInputValue,
} from "@/lib/bazi/schema-types";

export const AutoLabelingIntentDomainSchema = z.enum([
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

export const AutoLabelingQueueEntrySchema = z.object({
  queueId: z.string().uuid(),
  intentDomain: AutoLabelingIntentDomainSchema,
  rawInput: RawInputSchema,
  calculatedState: CalculatedStateSchema,
});

export const AutoLabelingQueueDocumentSchema = z.object({
  version: z.literal("1"),
  generatedAt: z.string().datetime(),
  seed: z.number().int().nonnegative(),
  cases: z.array(AutoLabelingQueueEntrySchema),
});

export const AutoLabelingAnnotationDataSchema = z
  .object({
    version: z.literal("1.6"),
    dimensions: z.array(DimensionSchema)
      .min(1)
      .max(REQUIRED_ANNOTATION_DIMENSION_COUNT),
    reviewSummary: z.string().trim().min(1).optional(),
  })
  .superRefine((value, context) => {
    addAnnotationDimensionIssues(value, context);
  });

export const AutoLabelingDraftRecordSchema = AutoLabelingQueueEntrySchema.extend({
  annotationData: AutoLabelingAnnotationDataSchema,
  metadata: DatasetRecordMetadataSchema.optional(),
});

export const AutoLabelingDraftBatchSchema = z.object({
  version: z.literal("1"),
  records: z.array(AutoLabelingDraftRecordSchema).min(1),
});

export type AutoLabelingIntentDomain = z.infer<typeof AutoLabelingIntentDomainSchema>;
export type AutoLabelingQueueEntry = z.infer<typeof AutoLabelingQueueEntrySchema>;
export type AutoLabelingQueueDocument = z.infer<typeof AutoLabelingQueueDocumentSchema>;

type CreateDeterministicRawInputsOptions = {
  count: number;
  seed: number;
  province?: string;
  timezone?: string;
  startYear?: number;
  endYear?: number;
  genders?: string[];
};

function mulberry32(seed: number) {
  let state = seed >>> 0;

  return function next() {
    state += 0x6d2b79f5;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);

    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);

    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function createDeterministicRawInputs(
  options: CreateDeterministicRawInputsOptions,
): RawInputValue[] {
  const {
    count,
    seed,
    province = "Bangkok",
    timezone = "Asia/Bangkok",
    startYear = 1970,
    endYear = 2005,
    genders = ["female", "male"],
  } = options;
  const nextRandom = mulberry32(seed);

  return Array.from({ length: count }, () => {
    const year = startYear + Math.floor(nextRandom() * (endYear - startYear + 1));
    const month = Math.floor(nextRandom() * 12) + 1;
    const day = Math.floor(nextRandom() * getDaysInMonth(year, month)) + 1;
    const hour = Math.floor(nextRandom() * 24);
    const minute = Math.floor(nextRandom() * 60);
    const gender = genders[Math.floor(nextRandom() * genders.length)] ?? genders[0] ?? "female";

    return RawInputSchema.parse({
      birthDate: `${year}-${pad(month)}-${pad(day)}`,
      birthTime: `${pad(hour)}:${pad(minute)}`,
      gender,
      province,
      calendarSystem: "solar",
      timezone,
    });
  });
}

export function createAutoLabelingQueueDocument(input: {
  seed: number;
  cases: AutoLabelingQueueEntry[];
}) {
  return AutoLabelingQueueDocumentSchema.parse({
    version: "1",
    generatedAt: new Date().toISOString(),
    seed: input.seed,
    cases: input.cases,
  });
}

export function createQueueEntry(input: {
  intentDomain: AutoLabelingIntentDomain;
  rawInput: RawInputValue;
  calculatedState: z.infer<typeof CalculatedStateSchema>;
}) {
  return AutoLabelingQueueEntrySchema.parse({
    queueId: randomUUID(),
    intentDomain: input.intentDomain,
    rawInput: input.rawInput,
    calculatedState: input.calculatedState,
  });
}

export function buildDraftPayloadFromAutoLabelingRecord(
  record: z.infer<typeof AutoLabelingDraftRecordSchema>,
): SaveDatasetRequest {
  return BaseSaveDatasetRequestSchema.parse({
    rawInput: record.rawInput,
    calculatedState: record.calculatedState,
    intentDomain: record.intentDomain,
    annotationData: record.annotationData,
    status: "draft",
    metadata: record.metadata ?? createDatasetRecordMetadata({
      generation: {
        source: "agent-import",
        queueBatchId: record.queueId,
      },
    }),
  });
}

export function pruneImportedQueueCases(
  queueDocument: AutoLabelingQueueDocument,
  importedQueueIds: readonly string[],
) {
  const importedIdSet = new Set(importedQueueIds);

  return AutoLabelingQueueDocumentSchema.parse({
    ...queueDocument,
    cases: queueDocument.cases.filter((entry) => !importedIdSet.has(entry.queueId)),
  });
}
