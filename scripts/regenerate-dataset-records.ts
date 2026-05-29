import path from "node:path";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import { config as loadEnv } from "dotenv";

import { createDraftAnnotationPayload, type SaveDatasetRequest } from "../src/lib/bazi/dataset-request";
import {
  buildDatasetRegenerationPlan,
  createActiveDraftMetadata,
  createDatasetRegenerationReceipt,
  createRevisionDraftMetadata,
  createSupersededDatasetMetadata,
  type DatasetGenerationFingerprint,
} from "../src/lib/bazi/dataset-regeneration";
import {
  createDbDatasetRecordRepository,
  listDatasetRecordsForRegeneration,
  type ProofDatasetRecord,
} from "../src/lib/bazi/dataset-records";
import { generateGeminiDraftAnnotation } from "../src/lib/bazi/gemini-draft-generator";
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createDbKnowledgeRepository } from "../src/lib/bazi/symbolic-engine.repository";

type CliOptions = {
  sourceFile?: string;
  batch?: string;
  output: string;
  receipt: string;
  model: string;
  annotator: string;
  requestDelayMs: number;
  limit?: number;
  dryRun: boolean;
  onlyStale: boolean;
  includeReviewedAsRevision: boolean;
  promptVersion?: string;
  promptHash?: string;
  referencePackVersion?: string;
  engineVersion?: string;
  all: boolean;
};

const DEFAULT_OUTPUT_PATH = path.resolve(
  process.cwd(),
  "output/regenerated_dataset_records.json",
);

const DEFAULT_RECEIPT_PATH = path.resolve(
  process.cwd(),
  "output/regenerated_dataset_records.receipt.json",
);

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

function parseNumberOption(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    output: DEFAULT_OUTPUT_PATH,
    receipt: DEFAULT_RECEIPT_PATH,
    model: "gemini-3-flash-preview",
    annotator: "gemini-3-flash-preview",
    requestDelayMs: 10_000,
    limit: undefined,
    dryRun: false,
    onlyStale: false,
    includeReviewedAsRevision: false,
    promptVersion: undefined,
    promptHash: undefined,
    referencePackVersion: undefined,
    engineVersion: undefined,
    sourceFile: undefined,
    batch: undefined,
    all: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    if (argument === "--source-file" && nextValue) {
      options.sourceFile = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (argument === "--batch" && nextValue) {
      options.batch = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--output" && nextValue) {
      options.output = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (argument === "--receipt" && nextValue) {
      options.receipt = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (argument === "--model" && nextValue) {
      options.model = nextValue;
      options.annotator = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--annotator" && nextValue) {
      options.annotator = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--prompt-version" && nextValue) {
      options.promptVersion = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--prompt-hash" && nextValue) {
      options.promptHash = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--reference-pack-version" && nextValue) {
      options.referencePackVersion = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--engine-version" && nextValue) {
      options.engineVersion = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--limit") {
      options.limit = parseNumberOption(nextValue);
      index += 1;
      continue;
    }

    if (argument === "--request-delay-ms") {
      options.requestDelayMs = parseNumberOption(nextValue) ?? options.requestDelayMs;
      index += 1;
      continue;
    }

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (argument === "--only-stale") {
      options.onlyStale = true;
      continue;
    }

    if (argument === "--include-reviewed-as-revision") {
      options.includeReviewedAsRevision = true;
      continue;
    }

    if (argument === "--all") {
      options.all = true;
    }
  }

  if (!options.sourceFile && !options.batch && !options.all) {
    throw new Error(
      "One of --source-file, --batch, or --all is required. Example: npm run dataset:regenerate -- --source-file output/cases.csv --dry-run",
    );
  }

  return options;
}

function createCalculatedStateHash(value: ProofDatasetRecord["calculatedState"]) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function createGenerationFingerprint(options: CliOptions): DatasetGenerationFingerprint {
  return {
    model: options.model,
    promptVersion: options.promptVersion,
    promptHash: options.promptHash,
    referencePackVersion: options.referencePackVersion,
    engineVersion: options.engineVersion,
  };
}

function createGenerationMetadata(
  record: ProofDatasetRecord,
  options: CliOptions,
  calculatedState: ProofDatasetRecord["calculatedState"],
  generatedAt: string,
) {
  return {
    source: "revision-regeneration" as const,
    model: options.model,
    promptVersion: options.promptVersion,
    promptHash: options.promptHash,
    referencePackVersion: options.referencePackVersion,
    engineVersion: options.engineVersion,
    calculatedStateHash: createCalculatedStateHash(calculatedState),
    queueBatchId: record.metadata.generation?.queueBatchId,
    queueSeed: record.metadata.generation?.queueSeed,
    generatedAt,
  };
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const allRecords = await listDatasetRecordsForRegeneration({
    sourceFile: options.sourceFile,
    batch: options.batch,
  });
  const planEntries = buildDatasetRegenerationPlan(allRecords, {
    fingerprint: createGenerationFingerprint(options),
    onlyStale: options.onlyStale,
    includeReviewedAsRevision: options.includeReviewedAsRevision,
    limit: options.limit,
  });

  const outputEntries = [] as Array<Record<string, unknown>>;

  if (options.dryRun) {
    const receipt = {
      mode: "dry-run",
      sourceFile: options.sourceFile ?? null,
      batch: options.batch ?? null,
      ...createDatasetRegenerationReceipt(planEntries),
      entries: planEntries.map((entry) => ({
        recordId: entry.record.id,
        status: entry.status,
        selected: entry.selected,
        recordStatus: entry.record.status,
        staleReasons: entry.staleReasons,
        reason: entry.reason,
      })),
    };

    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(
      options.output,
      `${JSON.stringify({ mode: "dry-run", entries: receipt.entries }, null, 2)}\n`,
      "utf8",
    );
    await mkdir(path.dirname(options.receipt), { recursive: true });
    await writeFile(options.receipt, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  const knowledgeRepository = createDbKnowledgeRepository();
  const datasetRepository = createDbDatasetRecordRepository();
  let failedCount = 0;

  for (const [index, entry] of planEntries.entries()) {
    if (!entry.selected) {
      outputEntries.push({
        recordId: entry.record.id,
        status: entry.status,
        selected: false,
        reason: entry.reason,
        staleReasons: entry.staleReasons,
      });
      continue;
    }

    try {
      const recalculatedState = await calculateBaziChart(entry.record.rawInput, knowledgeRepository);
      const generatedAt = new Date().toISOString();
      const generationMetadata = createGenerationMetadata(
        entry.record,
        options,
        recalculatedState,
        generatedAt,
      );
      const generationResult = await generateGeminiDraftAnnotation({
        rawInput: entry.record.rawInput,
        calculatedState: recalculatedState,
        model: options.model,
      });

      if (entry.status === "rewrite_draft") {
        const payload = createDraftAnnotationPayload(
          entry.record.rawInput,
          recalculatedState,
          generationResult.annotationData,
          "draft",
          entry.record.id,
          createActiveDraftMetadata(entry.record, generationMetadata),
        );
        const savedRecord = await datasetRepository.saveRecord(payload, options.annotator);

        outputEntries.push({
          recordId: savedRecord.recordId,
          status: "rewritten",
          updatedAt: savedRecord.updatedAt,
          staleReasons: entry.staleReasons,
          referenceCasePaths: generationResult.referenceCasePaths,
        });
      }

      if (entry.status === "cloned_revision") {
        const newPayload = createDraftAnnotationPayload(
          entry.record.rawInput,
          recalculatedState,
          generationResult.annotationData,
          "draft",
          undefined,
          createRevisionDraftMetadata(entry.record, generationMetadata, entry.staleReasons),
        );
        const newRecord = await datasetRepository.saveRecord(newPayload, options.annotator);

        if (!entry.record.annotationData) {
          throw new Error(`Cannot supersede record ${entry.record.id} because annotation data is missing.`);
        }

        if (entry.record.status === "exported") {
          throw new Error(`Cannot supersede exported record ${entry.record.id}.`);
        }

        const supersededPayload: SaveDatasetRequest = {
          recordId: entry.record.id,
          rawInput: entry.record.rawInput,
          calculatedState: entry.record.calculatedState,
          annotationData: entry.record.annotationData,
          status: entry.record.status,
          metadata: createSupersededDatasetMetadata(entry.record.metadata, newRecord.recordId),
        };
        await datasetRepository.saveRecord(
          supersededPayload,
          entry.record.annotatorId ?? options.annotator,
        );

        outputEntries.push({
          sourceRecordId: entry.record.id,
          recordId: newRecord.recordId,
          status: "cloned_revision",
          updatedAt: newRecord.updatedAt,
          staleReasons: entry.staleReasons,
          referenceCasePaths: generationResult.referenceCasePaths,
        });
      }
    } catch (error) {
      failedCount += 1;
      outputEntries.push({
        recordId: entry.record.id,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    const hasMoreSelectedEntries = planEntries.slice(index + 1).some((nextEntry) => nextEntry.selected);

    if (hasMoreSelectedEntries && options.requestDelayMs > 0) {
      console.log(
        `Cooling down for ${Math.ceil(options.requestDelayMs / 1000)}s before the next Gemini request...`,
      );
      await sleep(options.requestDelayMs);
    }
  }

  const receipt = {
    mode: "write",
    sourceFile: options.sourceFile ?? null,
    batch: options.batch ?? null,
    ...createDatasetRegenerationReceipt(planEntries, failedCount),
    entries: planEntries.map((entry) => ({
      recordId: entry.record.id,
      status: entry.status,
      selected: entry.selected,
      recordStatus: entry.record.status,
      staleReasons: entry.staleReasons,
      reason: entry.reason,
    })),
  };

  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(
    options.output,
    `${JSON.stringify({ mode: "write", results: outputEntries }, null, 2)}\n`,
    "utf8",
  );
  await mkdir(path.dirname(options.receipt), { recursive: true });
  await writeFile(options.receipt, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({ receipt, results: outputEntries }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});