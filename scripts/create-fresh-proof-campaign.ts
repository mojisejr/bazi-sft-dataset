import path from "node:path";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { config as loadEnv } from "dotenv";

import { createDraftAnnotationPayload, type SaveDatasetRequest } from "../src/lib/bazi/dataset-request";
import { parseThaiBaziCasesCsv } from "../src/lib/bazi/csv-case-loader";
import {
  buildFreshProofCampaignPlan,
  countLegacyDraftTargetsForFreshCampaign,
  createFreshCampaignDraftMetadata,
  createFreshProofCampaignReceipt,
} from "../src/lib/bazi/fresh-proof-campaign";
import {
  createActiveDraftMetadata,
  createRevisionDraftMetadata,
  createSupersededDatasetMetadata,
} from "../src/lib/bazi/dataset-regeneration";
import {
  createDbDatasetRecordRepository,
  findLatestDatasetRecordForRawInput,
  listActiveDraftProofRecords,
  type ProofDatasetRecord,
} from "../src/lib/bazi/dataset-records";
import { generateGeminiDraftAnnotation } from "../src/lib/bazi/gemini-draft-generator";
import { calculateBaziChart, createDbKnowledgeRepository } from "../src/lib/bazi/symbolic-engine";
import { mergeDatasetRecordMetadata } from "../src/lib/bazi/dataset-metadata";

type CliOptions = {
  input: string;
  campaignLabel: string;
  output: string;
  receipt: string;
  province: string;
  timezone: string;
  model: string;
  annotator: string;
  requestDelayMs: number;
  limit?: number;
  dryRun: boolean;
  excludeTestCases: boolean;
  promptVersion?: string;
  promptHash?: string;
  referencePackVersion?: string;
  engineVersion?: string;
};

const DEFAULT_OUTPUT_PATH = path.resolve(
  process.cwd(),
  "output/fresh_proof_campaign.json",
);

const DEFAULT_RECEIPT_PATH = path.resolve(
  process.cwd(),
  "output/fresh_proof_campaign.receipt.json",
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
    input: "",
    campaignLabel: "",
    output: DEFAULT_OUTPUT_PATH,
    receipt: DEFAULT_RECEIPT_PATH,
    province: "Bangkok",
    timezone: "Asia/Bangkok",
    model: "gemini-3-flash-preview",
    annotator: "gemini-3-flash-preview",
    requestDelayMs: 10_000,
    limit: undefined,
    dryRun: false,
    excludeTestCases: false,
    promptVersion: undefined,
    promptHash: undefined,
    referencePackVersion: undefined,
    engineVersion: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    if (argument === "--input-csv" && nextValue) {
      options.input = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (argument === "--campaign-label" && nextValue) {
      options.campaignLabel = nextValue.trim();
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

    if (argument === "--province" && nextValue) {
      options.province = nextValue;
      index += 1;
      continue;
    }

    if (argument === "--timezone" && nextValue) {
      options.timezone = nextValue;
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

    if (argument === "--exclude-test-cases") {
      options.excludeTestCases = true;
      continue;
    }

    if (argument === "--dry-run") {
      options.dryRun = true;
    }
  }

  if (!options.input) {
    throw new Error("--input-csv is required. Example: npm run dataset:fresh-campaign -- --input-csv ../cases.csv --campaign-label fresh-2026-04-24 --dry-run");
  }

  if (!options.campaignLabel) {
    throw new Error("--campaign-label is required for fresh proof campaigns.");
  }

  return options;
}

function createCalculatedStateHash(value: ProofDatasetRecord["calculatedState"]) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function createGenerationMetadata(
  options: CliOptions,
  calculatedState: ProofDatasetRecord["calculatedState"],
  generatedAt: string,
) {
  return {
    source: "csv" as const,
    model: options.model,
    promptVersion: options.promptVersion,
    promptHash: options.promptHash,
    referencePackVersion: options.referencePackVersion,
    engineVersion: options.engineVersion,
    calculatedStateHash: createCalculatedStateHash(calculatedState),
    queueBatchId: options.campaignLabel,
    generatedAt,
  };
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const csvText = await readFile(options.input, "utf8");
  const importedCases = parseThaiBaziCasesCsv(csvText, {
    province: options.province,
    timezone: options.timezone,
  });
  const cases = options.limit
    ? importedCases.slice(0, options.limit)
    : importedCases;

  const existingRecordsByRawInput = new Map<string, ProofDatasetRecord | null>();

  for (const importedCase of cases) {
    existingRecordsByRawInput.set(
      JSON.stringify(importedCase.rawInput),
      await findLatestDatasetRecordForRawInput(importedCase.rawInput),
    );
  }

  const planEntries = buildFreshProofCampaignPlan(cases, existingRecordsByRawInput, {
    excludeTestCases: options.excludeTestCases,
  });
  const activeDraftRecords = await listActiveDraftProofRecords();
  const legacyDraftTargets = countLegacyDraftTargetsForFreshCampaign(
    activeDraftRecords,
    planEntries,
    options.campaignLabel,
  );

  if (options.dryRun) {
    const receipt = {
      mode: "dry-run",
      sourceCsv: options.input,
      campaignLabel: options.campaignLabel,
      excludeTestCases: options.excludeTestCases,
      ...createFreshProofCampaignReceipt(planEntries, legacyDraftTargets.length),
      entries: planEntries.map((entry) => ({
        sourceRow: entry.importedCase.sourceRow,
        name: entry.importedCase.name,
        note: entry.importedCase.note ?? null,
        status: entry.status,
        selected: entry.selected,
        reason: entry.reason,
        existingRecordId: entry.existingRecord?.id ?? null,
        existingRecordStatus: entry.existingRecord?.status ?? null,
      })),
      excludedLegacyTargets: legacyDraftTargets.map((record) => ({
        recordId: record.id,
        customerName: record.metadata.customerName ?? null,
        queueBatchId: record.metadata.generation?.queueBatchId ?? null,
      })),
      readiness: {
        queueFilterQuery: `?campaign=${encodeURIComponent(options.campaignLabel)}`,
        sourceCsv: options.input,
        campaignLabel: options.campaignLabel,
      },
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
  const outputEntries = [] as Array<Record<string, unknown>>;
  let failedCount = 0;

  for (const [index, entry] of planEntries.entries()) {
    if (!entry.selected) {
      outputEntries.push({
        sourceRow: entry.importedCase.sourceRow,
        name: entry.importedCase.name,
        status: entry.status,
        selected: false,
        reason: entry.reason,
      });
      continue;
    }

    try {
      const recalculatedState = await calculateBaziChart(entry.importedCase.rawInput, knowledgeRepository);
      const generatedAt = new Date().toISOString();
      const generationMetadata = createGenerationMetadata(options, recalculatedState, generatedAt);
      const generationResult = await generateGeminiDraftAnnotation({
        rawInput: entry.importedCase.rawInput,
        calculatedState: recalculatedState,
        model: options.model,
      });
      const baseMetadata = createFreshCampaignDraftMetadata(
        entry.importedCase,
        options.input,
        generationMetadata,
      );

      if (entry.status === "create_draft") {
        const payload = createDraftAnnotationPayload(
          entry.importedCase.rawInput,
          recalculatedState,
          generationResult.annotationData,
          "draft",
          undefined,
          baseMetadata,
        );
        const savedRecord = await datasetRepository.saveRecord(payload, options.annotator);

        outputEntries.push({
          sourceRow: entry.importedCase.sourceRow,
          name: entry.importedCase.name,
          recordId: savedRecord.recordId,
          status: "create_draft",
          updatedAt: savedRecord.updatedAt,
          referenceCasePaths: generationResult.referenceCasePaths,
        });
      }

      if (entry.status === "rewrite_draft" && entry.existingRecord) {
        const payload = createDraftAnnotationPayload(
          entry.importedCase.rawInput,
          recalculatedState,
          generationResult.annotationData,
          "draft",
          entry.existingRecord.id,
          mergeDatasetRecordMetadata(
            createActiveDraftMetadata(entry.existingRecord, generationMetadata),
            baseMetadata,
          ),
        );
        const savedRecord = await datasetRepository.saveRecord(payload, options.annotator);

        outputEntries.push({
          sourceRow: entry.importedCase.sourceRow,
          name: entry.importedCase.name,
          recordId: savedRecord.recordId,
          status: "rewrite_draft",
          updatedAt: savedRecord.updatedAt,
          referenceCasePaths: generationResult.referenceCasePaths,
        });
      }

      if (entry.status === "cloned_revision" && entry.existingRecord) {
        const newPayload = createDraftAnnotationPayload(
          entry.importedCase.rawInput,
          recalculatedState,
          generationResult.annotationData,
          "draft",
          undefined,
          mergeDatasetRecordMetadata(
            createRevisionDraftMetadata(entry.existingRecord, generationMetadata),
            baseMetadata,
          ),
        );
        const newRecord = await datasetRepository.saveRecord(newPayload, options.annotator);

        if (entry.existingRecord.annotationData && entry.existingRecord.status !== "exported") {
          const supersededPayload: SaveDatasetRequest = {
            recordId: entry.existingRecord.id,
            rawInput: entry.existingRecord.rawInput,
            calculatedState: entry.existingRecord.calculatedState,
            annotationData: entry.existingRecord.annotationData,
            status: entry.existingRecord.status,
            metadata: createSupersededDatasetMetadata(
              entry.existingRecord.metadata,
              newRecord.recordId,
            ),
          };
          await datasetRepository.saveRecord(
            supersededPayload,
            entry.existingRecord.annotatorId ?? options.annotator,
          );
        }

        outputEntries.push({
          sourceRow: entry.importedCase.sourceRow,
          name: entry.importedCase.name,
          sourceRecordId: entry.existingRecord.id,
          recordId: newRecord.recordId,
          status: "cloned_revision",
          updatedAt: newRecord.updatedAt,
          referenceCasePaths: generationResult.referenceCasePaths,
        });
      }
    } catch (error) {
      failedCount += 1;
      outputEntries.push({
        sourceRow: entry.importedCase.sourceRow,
        name: entry.importedCase.name,
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

  let deprecatedLegacyTargetCount = 0;

  if (failedCount === 0) {
    for (const legacyRecord of legacyDraftTargets) {
      if (!legacyRecord.annotationData) {
        continue;
      }

      const payload: SaveDatasetRequest = {
        recordId: legacyRecord.id,
        rawInput: legacyRecord.rawInput,
        calculatedState: legacyRecord.calculatedState,
        annotationData: legacyRecord.annotationData,
        status: "draft",
        metadata: mergeDatasetRecordMetadata(legacyRecord.metadata, {
          reviewLifecycle: {
            state: "superseded",
            staleReason: "fresh-campaign-reset",
            staleAt: new Date().toISOString(),
          },
        }),
      };

      await datasetRepository.saveRecord(payload, legacyRecord.annotatorId ?? options.annotator);
      deprecatedLegacyTargetCount += 1;
    }
  }

  const receipt = {
    mode: "write",
    sourceCsv: options.input,
    campaignLabel: options.campaignLabel,
    excludeTestCases: options.excludeTestCases,
    deprecatedLegacyTargetCount,
    legacyTargetDeprecationSkipped: failedCount > 0,
    ...createFreshProofCampaignReceipt(planEntries, legacyDraftTargets.length, failedCount),
    readiness: {
      queueFilterQuery: `?campaign=${encodeURIComponent(options.campaignLabel)}`,
      sourceCsv: options.input,
      campaignLabel: options.campaignLabel,
    },
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