import { eq } from "drizzle-orm";
import { ZodError, z } from "zod";

import { createDbClient } from "@/db/client";
import { baziDatasetRecords } from "@/db/schema";
import { collectCalculatedStateIntegrityIssues } from "@/lib/bazi/calculated-state-integrity";
import {
  BaseSaveDatasetRequestSchema,
  type SaveDatasetRequest,
  type SaveDatasetStatus,
} from "@/lib/bazi/dataset-request";

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

export function createDbDatasetRecordRepository(
  databaseUrl?: string,
): DatasetRecordRepository {
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
  };
}

type SaveDatasetHandlerOptions = {
  repository?: DatasetRecordRepository;
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