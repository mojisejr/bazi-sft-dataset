import { and, desc, eq, sql } from "drizzle-orm";
import { ZodError, z } from "zod";

import { createDbClient } from "@/db/client";
import { baziDatasetRecords } from "@/db/schema";
import { collectCalculatedStateIntegrityIssues } from "@/lib/bazi/calculated-state-integrity";
import {
  BaseSaveDatasetRequestSchema,
  type SaveDatasetRequest,
  type SaveDatasetStatus,
} from "@/lib/bazi/dataset-request";
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

export type PendingDraftDatasetRecord = {
  id: string;
  birthDate: string;
  birthTime: string;
  dayMaster: string;
  intentDomain: string;
  annotatorId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProofDatasetRecord = {
  id: string;
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  intentDomain: string;
  annotationData: StoredAnnotationDataValue | null;
  status: "draft" | "reviewed" | "rejected" | "exported";
  annotatorId: string | null;
  createdAt: string;
  updatedAt: string;
};

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

export type DatasetRecordRepository = {
  saveRecord: (
    input: SaveDatasetRequest,
    annotatorId: string,
  ) => Promise<SavedDatasetRecord>;
};

export type DatasetDraftPurgeRepository = {
  purgeDrafts: (annotatorId: string) => Promise<void>;
};

export type DatasetDraftListRepository = {
  listDraftRecords: () => Promise<PendingDraftDatasetRecord[]>;
};

export type DatasetProofLookupRepository = {
  getRecordById: (recordId: string) => Promise<ProofDatasetRecord | null>;
};

export function createDbDatasetRecordRepository(
  databaseUrl?: string,
): DatasetRecordRepository
  & DatasetDraftPurgeRepository
  & DatasetDraftListRepository
  & DatasetProofLookupRepository {
  return {
    async saveRecord(input, annotatorId) {
      const db = createDbClient(databaseUrl);
      const values = {
        rawInput: input.rawInput,
        calculatedState: input.calculatedState,
        annotationData: input.annotationData,
        status: input.status,
        annotatorId,
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
    async listDraftRecords() {
      const db = createDbClient(databaseUrl);
      const records = await db
        .select({
          id: baziDatasetRecords.id,
          birthDate: sql<string>`${baziDatasetRecords.rawInput} ->> 'birthDate'`,
          birthTime: sql<string>`${baziDatasetRecords.rawInput} ->> 'birthTime'`,
          dayMaster: sql<string>`${baziDatasetRecords.calculatedState} ->> 'dayMaster'`,
          intentDomain: baziDatasetRecords.intentDomain,
          annotatorId: baziDatasetRecords.annotatorId,
          createdAt: baziDatasetRecords.createdAt,
          updatedAt: baziDatasetRecords.updatedAt,
        })
        .from(baziDatasetRecords)
        .where(eq(baziDatasetRecords.status, "draft"))
        .orderBy(desc(baziDatasetRecords.updatedAt));

      return records.map((record) => ({
        id: record.id,
        birthDate: record.birthDate,
        birthTime: record.birthTime,
        dayMaster: record.dayMaster,
        intentDomain: record.intentDomain,
        annotatorId: record.annotatorId,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
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
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      };
    },
  };
}

type ListDraftDatasetRecordsOptions = {
  repository?: DatasetDraftListRepository;
};

export async function listDraftDatasetRecords(
  options: ListDraftDatasetRecordsOptions = {},
) {
  const repository = options.repository ?? createDbDatasetRecordRepository();

  return repository.listDraftRecords();
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

type SaveDatasetHandlerOptions = {
  repository?: DatasetRecordRepository;
  authenticate: SaveDatasetAuthenticate;
};

type PurgeDatasetDraftsHandlerOptions = {
  repository?: DatasetDraftPurgeRepository;
  authenticate: SaveDatasetAuthenticate;
};

type ListDraftDatasetRecordsHandlerOptions = {
  repository?: DatasetDraftListRepository;
  authenticate: SaveDatasetAuthenticate;
};

type SaveProofDatasetHandlerOptions = {
  repository?: DatasetRecordRepository & DatasetProofLookupRepository;
  authenticate: SaveDatasetAuthenticate;
};

export function createSaveDatasetHandler(options: SaveDatasetHandlerOptions) {
  return async function POST(request: Request) {
    try {
      const authResult = await options.authenticate();
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
      const authResult = await options.authenticate();
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
  return async function GET() {
    try {
      const authResult = await options.authenticate();
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
      const records = await repository.listDraftRecords();

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
      const authResult = await options.authenticate();
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
        annotationData: payload.annotationData,
        status: payload.status,
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