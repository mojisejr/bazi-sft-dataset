import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ZodError, z } from "zod";

import { createDbClient, createDbSqlClient } from "@/db/client";
import { baziDatasetRecords } from "@/db/schema";
import {
  createDatasetRecordMetadata,
  mergeDatasetRecordMetadata,
  type DatasetRecordMetadataValue,
} from "@/lib/bazi/dataset-metadata";
import { collectCalculatedStateIntegrityIssues } from "@/lib/bazi/calculated-state-integrity";
import {
  BaseSaveDatasetRequestSchema,
  type SaveDatasetRequest,
  type SaveDatasetStatus,
} from "@/lib/bazi/dataset-request";
import { type GenerateChunkedTopicDraftOptions, generateChunkedTopicDraft } from "@/lib/bazi/orchestrator/gemini-runner";
import {
  mapTopicDraftToDraftAnnotationData,
  mapTopicDraftWithProvenance,
} from "@/lib/bazi/orchestrator/draft-mapper";
import { summarizeProofCompositionProvenance } from "@/lib/bazi/orchestrator/proof-dimension-composer";
import {
  AnnotationDataSchema,
  DraftAnnotationDataSchema,
  RejectedAnnotationDataSchema,
  type CalculatedStateValue,
  type RawInputValue,
  type StoredAnnotationDataValue,
} from "@/lib/bazi/schema-types";

export const SaveDatasetRequestSchema = BaseSaveDatasetRequestSchema
  .superRefine((value, context) => {
    const integrityIssues = collectCalculatedStateIntegrityIssues(
      value.rawInput,
      value.calculatedState,
    );

    for (const issue of integrityIssues) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: issue,
        path: ["calculatedState"],
      });
    }

  });

export type SavedDatasetRecord = {
  recordId: string;
  status: SaveDatasetStatus;
  updatedAt: string;
};

export type ExistingDatasetRecord = {
  id: string;
  status: "draft" | "reviewed";
  annotatorId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PendingDraftDatasetRecord = {
  id: string;
  birthDate: string;
  birthTime: string;
  dayMaster: string;
  intentDomain: string;
  customerName: string | null;
  caseNote: string | null;
  queueBatchId: string | null;
  reviewState: "active" | "stale" | "needs-reproof" | "superseded" | null;
  staleReason: string | null;
  supersedesRecordId: string | null;
  latestEffectiveRecordId: string | null;
  sourceRow: number | null;
  annotatorId: string | null;
  createdAt: string;
  updatedAt: string;
};

type PendingDraftDatasetRecordRow = {
  id: string;
  birth_date: string;
  birth_time: string;
  day_master: string;
  intent_domain: string;
  customer_name: string | null;
  case_note: string | null;
  queue_batch_id: string | null;
  review_state: PendingDraftDatasetRecord["reviewState"];
  stale_reason: string | null;
  supersedes_record_id: string | null;
  latest_effective_record_id: string | null;
  source_row: string | null;
  annotator_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ProofDatasetRecord = {
  id: string;
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  intentDomain: string;
  annotationData: StoredAnnotationDataValue | null;
  status: "draft" | "reviewed" | "rejected" | "exported";
  annotatorId: string | null;
  metadata: DatasetRecordMetadataValue;
  createdAt: string;
  updatedAt: string;
};

export type ActiveDraftProofRecordSummary = Pick<ProofDatasetRecord, "id" | "metadata">;

export const ProofDatasetRequestSchema = z
  .object({
    recordId: z.string().uuid(),
    annotationData: DraftAnnotationDataSchema,
    status: z.enum(["draft", "reviewed", "rejected"]),
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

export type SaveDatasetAuth = {
  userId: string | null;
  isAuthenticated?: boolean;
};

export type SaveDatasetAuthenticate = () => Promise<SaveDatasetAuth>;

/** Default identity when no authenticate function is supplied (login removed). */
const LOCAL_USER_ID = "local";
const localAuth: SaveDatasetAuthenticate = async () => ({ userId: LOCAL_USER_ID, isAuthenticated: true });

export type DatasetRecordRepository = {
  saveRecord: (
    input: SaveDatasetRequest,
    annotatorId: string,
  ) => Promise<SavedDatasetRecord>;
};

export type GenerateAndSaveOrchestratedDraftDependencies = {
  generateTopicDraft?: (
    options: GenerateChunkedTopicDraftOptions,
  ) => Promise<Awaited<ReturnType<typeof generateChunkedTopicDraft>>>;
  mapTopicDraft?: typeof mapTopicDraftToDraftAnnotationData;
  mapTopicDraftWithProvenance?: typeof mapTopicDraftWithProvenance;
  repository?: DatasetRecordRepository;
};

export type GenerateAndSaveOrchestratedDraftOptions = {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  annotatorId: string;
  intentDomain?: SaveDatasetRequest["intentDomain"];
  recordId?: string;
  metadata?: DatasetRecordMetadataValue;
  model?: string;
  apiKey?: string;
  retry?: GenerateChunkedTopicDraftOptions["retry"];
  executeChunk?: GenerateChunkedTopicDraftOptions["executeChunk"];
  repository?: DatasetRecordRepository;
  databaseUrl?: string;
  dependencies?: GenerateAndSaveOrchestratedDraftDependencies;
};

export type GenerateAndSaveOrchestratedDraftResult = {
  savedRecord: SavedDatasetRecord;
  annotationData: z.infer<typeof DraftAnnotationDataSchema>;
  draftByTopic: Awaited<ReturnType<typeof generateChunkedTopicDraft>>["draftByTopic"];
  completedChunkIds: Awaited<ReturnType<typeof generateChunkedTopicDraft>>["completedChunkIds"];
  model: string;
  generationSeed: number;
};

export type DatasetDraftPurgeRepository = {
  purgeDrafts: (annotatorId: string) => Promise<void>;
};

export type DatasetDraftListRepository = {
  listDraftRecords: (filters?: { campaignLabel?: string }) => Promise<PendingDraftDatasetRecord[]>;
};

export type DatasetProofLookupRepository = {
  getRecordById: (recordId: string) => Promise<ProofDatasetRecord | null>;
};

type ProofDatasetRecordRow = {
  id: string;
  raw_input: RawInputValue;
  calculated_state: CalculatedStateValue;
  intent_domain: string;
  annotation_data: StoredAnnotationDataValue | null;
  status: ProofDatasetRecord["status"];
  annotator_id: string | null;
  metadata: DatasetRecordMetadataValue;
  created_at: string;
  updated_at: string;
};

function mapProofDatasetRecordRow(record: ProofDatasetRecordRow): ProofDatasetRecord {
  return {
    id: record.id,
    rawInput: record.raw_input,
    calculatedState: record.calculated_state,
    intentDomain: record.intent_domain,
    annotationData: record.annotation_data,
    status: record.status,
    annotatorId: record.annotator_id,
    metadata: record.metadata,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export async function generateAndSaveOrchestratedDraft(
  options: GenerateAndSaveOrchestratedDraftOptions,
): Promise<GenerateAndSaveOrchestratedDraftResult> {
  const generateTopicDraft = options.dependencies?.generateTopicDraft ?? generateChunkedTopicDraft;
  const mapTopicDraft = options.dependencies?.mapTopicDraft ?? mapTopicDraftToDraftAnnotationData;
  const mapTopicDraftAndProvenance =
    options.dependencies?.mapTopicDraftWithProvenance ?? mapTopicDraftWithProvenance;
  const repository = options.dependencies?.repository
    ?? options.repository
    ?? createDbDatasetRecordRepository(options.databaseUrl);
  const generation = await generateTopicDraft({
    rawInput: options.rawInput,
    calculatedState: options.calculatedState,
    model: options.model,
    apiKey: options.apiKey,
    retry: options.retry,
    executeChunk: options.executeChunk,
  });
  const mapped = options.dependencies?.mapTopicDraft
    ? { annotationData: mapTopicDraft(generation.draftByTopic, { calculatedState: options.calculatedState }) }
    : mapTopicDraftAndProvenance(generation.draftByTopic, { calculatedState: options.calculatedState });
  const annotationData = mapped.annotationData;
  const metadata = createDatasetRecordMetadata({
    ...options.metadata,
    generation: {
      ...options.metadata?.generation,
      source: options.metadata?.generation?.source ?? "queue",
      model: generation.model,
      generatedAt:
        options.metadata?.generation?.generatedAt
        ?? new Date().toISOString(),
      composition: "provenance" in mapped
        ? summarizeProofCompositionProvenance(mapped.provenance)
        : options.metadata?.generation?.composition,
    },
  });
  const payload = SaveDatasetRequestSchema.parse({
    recordId: options.recordId,
    rawInput: options.rawInput,
    calculatedState: options.calculatedState,
    intentDomain: options.intentDomain,
    annotationData,
    status: "draft",
    metadata,
  });
  const savedRecord = await repository.saveRecord(payload, options.annotatorId);

  return {
    savedRecord,
    annotationData,
    draftByTopic: generation.draftByTopic,
    completedChunkIds: generation.completedChunkIds,
    model: generation.model,
    generationSeed: generation.generationSeed,
  };
}

export function createDbDatasetRecordRepository(
  databaseUrl?: string,
): DatasetRecordRepository
  & DatasetDraftPurgeRepository
  & DatasetDraftListRepository
  & DatasetProofLookupRepository {
  return {
    async saveRecord(input, annotatorId) {
      const db = createDbClient(databaseUrl);
      let metadata = input.metadata;

      if (input.recordId && input.metadata) {
        const [existingRecord] = await db
          .select({
            metadata: baziDatasetRecords.metadata,
          })
          .from(baziDatasetRecords)
          .where(eq(baziDatasetRecords.id, input.recordId))
          .limit(1);

        if (!existingRecord) {
          throw new Error(`Dataset record ${input.recordId} was not found.`);
        }

        metadata = mergeDatasetRecordMetadata(existingRecord.metadata, input.metadata);
      }

      const values = {
        rawInput: input.rawInput,
        calculatedState: input.calculatedState,
        ...(input.intentDomain ? { intentDomain: input.intentDomain } : {}),
        annotationData: input.annotationData,
        status: input.status,
        annotatorId,
        ...(metadata ? { metadata } : {}),
      };

      if (input.recordId) {
        const [updatedRecord] = await db
          .update(baziDatasetRecords)
          .set(values)
          .where(eq(baziDatasetRecords.id, input.recordId))
          .returning({
            recordId: baziDatasetRecords.id,
            updatedAt: baziDatasetRecords.updatedAt,
          });

        if (!updatedRecord) {
          throw new Error(`Dataset record ${input.recordId} was not found.`);
        }

        return {
          recordId: updatedRecord.recordId,
          status: input.status,
          updatedAt: updatedRecord.updatedAt.toISOString(),
        };
      }

      const [createdRecord] = await db
        .insert(baziDatasetRecords)
        .values(values)
        .returning({
          recordId: baziDatasetRecords.id,
          updatedAt: baziDatasetRecords.updatedAt,
        });

      return {
        recordId: createdRecord.recordId,
        status: input.status,
        updatedAt: createdRecord.updatedAt.toISOString(),
      };
    },
    async purgeDrafts(annotatorId) {
      const db = createDbClient(databaseUrl);

      await db
        .delete(baziDatasetRecords)
        .where(
          and(
            eq(baziDatasetRecords.annotatorId, annotatorId),
            eq(baziDatasetRecords.status, "draft"),
          ),
        );
    },
    async listDraftRecords(filters = {}) {
      const db = createDbSqlClient(databaseUrl);
      const records = (filters.campaignLabel
        ? await db`
            select
              id,
              raw_input ->> 'birthDate' as birth_date,
              raw_input ->> 'birthTime' as birth_time,
              calculated_state ->> 'dayMaster' as day_master,
              intent_domain,
              metadata ->> 'customerName' as customer_name,
              metadata ->> 'caseNote' as case_note,
              metadata -> 'generation' ->> 'queueBatchId' as queue_batch_id,
              metadata -> 'reviewLifecycle' ->> 'state' as review_state,
              metadata -> 'reviewLifecycle' ->> 'staleReason' as stale_reason,
              metadata -> 'revision' ->> 'supersedesRecordId' as supersedes_record_id,
              metadata -> 'revision' ->> 'latestEffectiveRecordId' as latest_effective_record_id,
              metadata ->> 'sourceRow' as source_row,
              annotator_id,
              created_at,
              updated_at
            from bazi_dataset_records
            where status = 'draft'
              and coalesce(metadata -> 'reviewLifecycle' ->> 'state', '') <> 'superseded'
              and metadata -> 'generation' ->> 'queueBatchId' = ${filters.campaignLabel}
            order by updated_at desc
          `
        : await db`
            select
              id,
              raw_input ->> 'birthDate' as birth_date,
              raw_input ->> 'birthTime' as birth_time,
              calculated_state ->> 'dayMaster' as day_master,
              intent_domain,
              metadata ->> 'customerName' as customer_name,
              metadata ->> 'caseNote' as case_note,
              metadata -> 'generation' ->> 'queueBatchId' as queue_batch_id,
              metadata -> 'reviewLifecycle' ->> 'state' as review_state,
              metadata -> 'reviewLifecycle' ->> 'staleReason' as stale_reason,
              metadata -> 'revision' ->> 'supersedesRecordId' as supersedes_record_id,
              metadata -> 'revision' ->> 'latestEffectiveRecordId' as latest_effective_record_id,
              metadata ->> 'sourceRow' as source_row,
              annotator_id,
              created_at,
              updated_at
            from bazi_dataset_records
            where status = 'draft'
              and coalesce(metadata -> 'reviewLifecycle' ->> 'state', '') <> 'superseded'
            order by updated_at desc
          `) as PendingDraftDatasetRecordRow[];

      return records.map((record) => ({
        id: record.id,
        birthDate: record.birth_date,
        birthTime: record.birth_time,
        dayMaster: record.day_master,
        intentDomain: record.intent_domain,
        customerName: record.customer_name,
        caseNote: record.case_note,
        queueBatchId: record.queue_batch_id,
        reviewState: record.review_state,
        staleReason: record.stale_reason,
        supersedesRecordId: record.supersedes_record_id,
        latestEffectiveRecordId: record.latest_effective_record_id,
        sourceRow: record.source_row ? Number(record.source_row) : null,
        annotatorId: record.annotator_id,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      }));
    },
    async getRecordById(recordId) {
      const db = createDbClient(databaseUrl);
      const [record] = await db
        .select({
          id: baziDatasetRecords.id,
          rawInput: baziDatasetRecords.rawInput,
          calculatedState: baziDatasetRecords.calculatedState,
          intentDomain: baziDatasetRecords.intentDomain,
          annotationData: baziDatasetRecords.annotationData,
          status: baziDatasetRecords.status,
          annotatorId: baziDatasetRecords.annotatorId,
          metadata: baziDatasetRecords.metadata,
          createdAt: baziDatasetRecords.createdAt,
          updatedAt: baziDatasetRecords.updatedAt,
        })
        .from(baziDatasetRecords)
        .where(eq(baziDatasetRecords.id, recordId))
        .limit(1);

      if (!record) {
        return null;
      }

      return {
        id: record.id,
        rawInput: record.rawInput,
        calculatedState: record.calculatedState,
        intentDomain: record.intentDomain,
        annotationData: record.annotationData,
        status: record.status,
        annotatorId: record.annotatorId,
        metadata: record.metadata,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      };
    },
  };
}

type ListDraftDatasetRecordsOptions = {
  repository?: DatasetDraftListRepository;
  campaignLabel?: string;
};

export async function listDraftDatasetRecords(
  options: ListDraftDatasetRecordsOptions = {},
) {
  const repository = options.repository ?? createDbDatasetRecordRepository();

  return repository.listDraftRecords({ campaignLabel: options.campaignLabel });
}

type GetProofDatasetRecordOptions = {
  repository?: DatasetProofLookupRepository;
};

export async function getProofDatasetRecord(
  recordId: string,
  options: GetProofDatasetRecordOptions = {},
) {
  const repository = options.repository ?? createDbDatasetRecordRepository();

  return repository.getRecordById(recordId);
}

export async function findExistingDraftOrReviewedDatasetRecord(
  rawInput: RawInputValue,
  databaseUrl?: string,
): Promise<ExistingDatasetRecord | null> {
  const db = createDbClient(databaseUrl);
  const [record] = await db
    .select({
      id: baziDatasetRecords.id,
      status: baziDatasetRecords.status,
      annotatorId: baziDatasetRecords.annotatorId,
      createdAt: baziDatasetRecords.createdAt,
      updatedAt: baziDatasetRecords.updatedAt,
    })
    .from(baziDatasetRecords)
    .where(
      and(
        eq(baziDatasetRecords.rawInput, rawInput),
        inArray(baziDatasetRecords.status, ["draft", "reviewed"]),
      ),
    )
    .orderBy(desc(baziDatasetRecords.updatedAt))
    .limit(1);

  if (!record) {
    return null;
  }

  if (record.status !== "draft" && record.status !== "reviewed") {
    throw new Error(
      `Unexpected dataset status returned from existing-record lookup: ${record.status}`,
    );
  }

  return {
    id: record.id,
    status: record.status,
    annotatorId: record.annotatorId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function findLatestDatasetRecordForRawInput(
  rawInput: RawInputValue,
  databaseUrl?: string,
): Promise<ProofDatasetRecord | null> {
  const db = createDbSqlClient(databaseUrl);
  const [record] = (await db`
    select
      id,
      raw_input,
      calculated_state,
      intent_domain,
      annotation_data,
      status,
      annotator_id,
      metadata,
      created_at,
      updated_at
    from bazi_dataset_records
    where raw_input = ${JSON.stringify(rawInput)}::jsonb
    order by updated_at desc
    limit 1
  `) as ProofDatasetRecordRow[];

  if (!record) {
    return null;
  }

  return mapProofDatasetRecordRow(record);
}

export async function listActiveDraftProofRecords(
  databaseUrl?: string,
): Promise<ActiveDraftProofRecordSummary[]> {
  const db = createDbSqlClient(databaseUrl);
  const records = (await db`
    select
      id,
      metadata
    from bazi_dataset_records
    where status = 'draft'
      and coalesce(metadata -> 'reviewLifecycle' ->> 'state', '') <> 'superseded'
    order by updated_at desc
  `) as Array<{
    id: string;
    metadata: DatasetRecordMetadataValue;
  }>;

  return records.map((record) => ({
    id: record.id,
    metadata: record.metadata,
  }));
}

type ListDatasetRecordsForRegenerationFilters = {
  sourceFile?: string;
  batch?: string;
};

export async function listDatasetRecordsForRegeneration(
  filters: ListDatasetRecordsForRegenerationFilters = {},
  databaseUrl?: string,
): Promise<ProofDatasetRecord[]> {
  const db = createDbClient(databaseUrl);
  const baseQuery = db
    .select({
      id: baziDatasetRecords.id,
      rawInput: baziDatasetRecords.rawInput,
      calculatedState: baziDatasetRecords.calculatedState,
      intentDomain: baziDatasetRecords.intentDomain,
      annotationData: baziDatasetRecords.annotationData,
      status: baziDatasetRecords.status,
      annotatorId: baziDatasetRecords.annotatorId,
      metadata: baziDatasetRecords.metadata,
      createdAt: baziDatasetRecords.createdAt,
      updatedAt: baziDatasetRecords.updatedAt,
    })
    .from(baziDatasetRecords)
    .orderBy(desc(baziDatasetRecords.updatedAt));

  const whereClause = filters.sourceFile && filters.batch
    ? and(
        sql<boolean>`${baziDatasetRecords.metadata} ->> 'sourceFile' = ${filters.sourceFile}`,
        sql<boolean>`${baziDatasetRecords.metadata} -> 'generation' ->> 'queueBatchId' = ${filters.batch}`,
      )
    : filters.sourceFile
      ? sql<boolean>`${baziDatasetRecords.metadata} ->> 'sourceFile' = ${filters.sourceFile}`
      : filters.batch
        ? sql<boolean>`${baziDatasetRecords.metadata} -> 'generation' ->> 'queueBatchId' = ${filters.batch}`
        : undefined;

  const records = whereClause
    ? await baseQuery.where(whereClause)
    : await baseQuery;

  return records.map((record) => ({
    id: record.id,
    rawInput: record.rawInput,
    calculatedState: record.calculatedState,
    intentDomain: record.intentDomain,
    annotationData: record.annotationData,
    status: record.status,
    annotatorId: record.annotatorId,
    metadata: record.metadata,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }));
}

type SaveDatasetHandlerOptions = {
  repository?: DatasetRecordRepository;
  /** Optional. When omitted, requests are treated as the local user (no login). */
  authenticate?: SaveDatasetAuthenticate;
};

type PurgeDatasetDraftsHandlerOptions = {
  repository?: DatasetDraftPurgeRepository;
  authenticate?: SaveDatasetAuthenticate;
};

type ListDraftDatasetRecordsHandlerOptions = {
  repository?: DatasetDraftListRepository;
  authenticate?: SaveDatasetAuthenticate;
};

type SaveProofDatasetHandlerOptions = {
  repository?: DatasetRecordRepository & DatasetProofLookupRepository;
  authenticate?: SaveDatasetAuthenticate;
};

export function createSaveDatasetHandler(options: SaveDatasetHandlerOptions) {
  return async function POST(request: Request) {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);

      if (!isAuthenticated || !authResult.userId) {
        return Response.json(
          {
            error: "Unauthorized",
          },
          { status: 401 },
        );
      }

      const payload = SaveDatasetRequestSchema.parse(await request.json());
      const repository = options.repository ?? createDbDatasetRecordRepository();
      const record = await repository.saveRecord(payload, authResult.userId);

      return Response.json(record, { status: 200 });
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          {
            error: "Invalid dataset save payload.",
            details: error.issues,
          },
          { status: 400 },
        );
      }

      if (error instanceof Error && error.message.includes("was not found")) {
        return Response.json(
          {
            error: error.message,
          },
          { status: 404 },
        );
      }

      const message = error instanceof Error ? error.message : "Unknown dataset save error.";

      return Response.json(
        {
          error: message,
        },
        { status: 500 },
      );
    }
  };
}

export function createPurgeDatasetDraftsHandler(
  options: PurgeDatasetDraftsHandlerOptions,
) {
  return async function POST() {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);

      if (!isAuthenticated || !authResult.userId) {
        return Response.json(
          {
            error: "Unauthorized",
          },
          { status: 401 },
        );
      }

      const repository = options.repository ?? createDbDatasetRecordRepository();

      await repository.purgeDrafts(authResult.userId);

      return new Response(null, { status: 200 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown dataset purge error.";

      return Response.json(
        {
          error: message,
        },
        { status: 500 },
      );
    }
  };
}

export function createListDraftDatasetRecordsHandler(
  options: ListDraftDatasetRecordsHandlerOptions,
) {
  return async function GET(request: Request) {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);

      if (!isAuthenticated || !authResult.userId) {
        return Response.json(
          {
            error: "Unauthorized",
          },
          { status: 401 },
        );
      }

      const repository = options.repository ?? createDbDatasetRecordRepository();
      const requestUrl = new URL(request.url);
      const campaignLabel = requestUrl.searchParams.get("campaign")?.trim() || undefined;
      const records = await repository.listDraftRecords({ campaignLabel });

      return Response.json(records, { status: 200 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown dataset draft listing error.";

      return Response.json(
        {
          error: message,
        },
        { status: 500 },
      );
    }
  };
}

export function createSaveProofDatasetHandler(
  options: SaveProofDatasetHandlerOptions,
) {
  return async function POST(request: Request) {
    try {
      const authResult = await (options.authenticate ?? localAuth)();
      const isAuthenticated = authResult.isAuthenticated ?? Boolean(authResult.userId);

      if (!isAuthenticated || !authResult.userId) {
        return Response.json(
          {
            error: "Unauthorized",
          },
          { status: 401 },
        );
      }

      const payload = ProofDatasetRequestSchema.parse(await request.json());
      const repository = options.repository ?? createDbDatasetRecordRepository();
      const existingRecord = await repository.getRecordById(payload.recordId);

      if (!existingRecord || existingRecord.status === "exported") {
        return Response.json(
          {
            error: `Dataset record ${payload.recordId} was not found.`,
          },
          { status: 404 },
        );
      }

      const mergedPayload: SaveDatasetRequest = {
        recordId: payload.recordId,
        rawInput: existingRecord.rawInput,
        calculatedState: existingRecord.calculatedState,
        intentDomain: existingRecord.intentDomain as SaveDatasetRequest["intentDomain"],
        annotationData: payload.annotationData,
        status: payload.status,
        metadata: existingRecord.metadata,
      };
      const record = await repository.saveRecord(mergedPayload, authResult.userId);

      return Response.json(record, { status: 200 });
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          {
            error: "Invalid proof dataset payload.",
            details: error.issues,
          },
          { status: 400 },
        );
      }

      const message = error instanceof Error ? error.message : "Unknown proof dataset error.";

      return Response.json(
        {
          error: message,
        },
        { status: 500 },
      );
    }
  };
}
