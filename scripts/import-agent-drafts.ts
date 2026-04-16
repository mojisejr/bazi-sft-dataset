import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { config as loadEnv } from "dotenv";

import {
  AutoLabelingDraftBatchSchema,
  AutoLabelingQueueDocumentSchema,
  buildDraftPayloadFromAutoLabelingRecord,
  pruneImportedQueueCases,
} from "../src/lib/bazi/auto-labeling";
import { createDbDatasetRecordRepository } from "../src/lib/bazi/dataset-records";

type CliOptions = {
  inputPath: string;
  queuePath: string | null;
  annotatorId: string;
  receiptPath: string | null;
};

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

function parseCliOptions(argv: string[]): CliOptions {
  let inputPath: string | null = null;
  let queuePath: string | null = null;
  let annotatorId = "agent_gpt4o";
  let receiptPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    if (argument === "--input" && nextValue) {
      inputPath = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (argument === "--queue" && nextValue) {
      queuePath = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (argument === "--annotator" && nextValue) {
      annotatorId = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--receipt" && nextValue) {
      receiptPath = path.resolve(process.cwd(), nextValue);
      index += 1;
    }
  }

  if (!inputPath) {
    throw new Error("Missing required --input <path> argument.");
  }

  return {
    inputPath,
    queuePath,
    annotatorId,
    receiptPath,
  };
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const batchRaw = await readFile(options.inputPath, "utf8");
  const batch = AutoLabelingDraftBatchSchema.parse(JSON.parse(batchRaw));
  const repository = createDbDatasetRecordRepository();
  const insertedRecords = [];

  for (const record of batch.records) {
    const payload = buildDraftPayloadFromAutoLabelingRecord(record);
    const insertedRecord = await repository.saveRecord(payload, options.annotatorId);

    insertedRecords.push({
      queueId: record.queueId,
      recordId: insertedRecord.recordId,
      updatedAt: insertedRecord.updatedAt,
      intentDomain: record.intentDomain,
    });
  }

  if (options.queuePath) {
    const queueRaw = await readFile(options.queuePath, "utf8");
    const queueDocument = AutoLabelingQueueDocumentSchema.parse(JSON.parse(queueRaw));
    const prunedQueueDocument = pruneImportedQueueCases(
      queueDocument,
      insertedRecords.map((record) => record.queueId),
    );

    await writeFile(
      options.queuePath,
      `${JSON.stringify(prunedQueueDocument, null, 2)}\n`,
      "utf8",
    );
  }

  if (options.receiptPath) {
    await mkdir(path.dirname(options.receiptPath), { recursive: true });
    await writeFile(
      options.receiptPath,
      `${JSON.stringify({ insertedRecords }, null, 2)}\n`,
      "utf8",
    );
  }

  console.log(
    JSON.stringify(
      {
        insertedCount: insertedRecords.length,
        annotatorId: options.annotatorId,
        inputPath: options.inputPath,
        queuePath: options.queuePath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});