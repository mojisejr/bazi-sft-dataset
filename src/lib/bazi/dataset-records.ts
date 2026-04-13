import { eq } from "drizzle-orm";
import { ZodError, z } from "zod";

import { createDbClient } from "@/db/client";
import { baziDatasetRecords } from "@/db/schema";
import {
  AnnotationDataSchema,
  CalculatedStateSchema,
  DraftAnnotationDataSchema,
  RawInputSchema,
  type CalculatedStateValue,
  type DraftAnnotationDataValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";

export const SaveDatasetStatusSchema = z.enum(["draft", "reviewed"]);

export const SaveDatasetRequestSchema = z
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
export type SaveDatasetRequest = z.infer<typeof SaveDatasetRequestSchema>;

export type SavedDatasetRecord = {
  recordId: string;
  status: SaveDatasetStatus;
  updatedAt: string;
};

export type DatasetRecordRepository = {
  saveRecord: (input: SaveDatasetRequest) => Promise<SavedDatasetRecord>;
};

export function createDraftAnnotationPayload(
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
  annotationData: DraftAnnotationDataValue,
  status: SaveDatasetStatus,
  recordId?: string,
): SaveDatasetRequest {
  return SaveDatasetRequestSchema.parse({
    recordId,
    rawInput,
    calculatedState,
    annotationData,
    status,
  });
}

export function createDbDatasetRecordRepository(
  databaseUrl?: string,
): DatasetRecordRepository {
  return {
    async saveRecord(input) {
      const db = createDbClient(databaseUrl);
      const values = {
        rawInput: input.rawInput,
        calculatedState: input.calculatedState,
        annotationData: input.annotationData,
        status: input.status,
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
};

export function createSaveDatasetHandler(options: SaveDatasetHandlerOptions = {}) {
  return async function POST(request: Request) {
    try {
      const payload = SaveDatasetRequestSchema.parse(await request.json());
      const repository = options.repository ?? createDbDatasetRecordRepository();
      const record = await repository.saveRecord(payload);

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