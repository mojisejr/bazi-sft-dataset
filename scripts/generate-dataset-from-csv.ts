import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { config as loadEnv } from "dotenv";

import { createDraftAnnotationPayload } from "../src/lib/bazi/dataset-request";
import {
  createDbDatasetRecordRepository,
  findExistingDraftOrReviewedDatasetRecord,
} from "../src/lib/bazi/dataset-records";
import { parseThaiBaziCasesCsv } from "../src/lib/bazi/csv-case-loader";
import { generateGeminiDraftAnnotation } from "../src/lib/bazi/gemini-draft-generator";
import {
  calculateBaziChart,
  createDbKnowledgeRepository,
} from "../src/lib/bazi/symbolic-engine";

type CliOptions = {
  input: string;
  output: string;
  receipt?: string;
  province: string;
  timezone: string;
  model: string;
  annotator: string;
  requestDelayMs: number;
  limit?: number;
  dryRun: boolean;
};

const DEFAULT_OUTPUT_PATH = path.resolve(
  process.cwd(),
  "output/generated_dataset_from_csv.json",
);

const DEFAULT_RECEIPT_PATH = path.resolve(
  process.cwd(),
  "output/generated_dataset_from_csv.receipt.json",
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
    output: DEFAULT_OUTPUT_PATH,
    receipt: DEFAULT_RECEIPT_PATH,
    province: "Bangkok",
    timezone: "Asia/Bangkok",
    model: "gemini-3-flash-preview",
    annotator: "gemini-3-flash-preview",
    requestDelayMs: 10_000,
    limit: undefined,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    if (argument === "--input" && nextValue) {
      options.input = path.resolve(process.cwd(), nextValue);
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
    }
  }

  if (!options.input) {
    throw new Error("--input is required. Example: npm run dataset:csv:generate -- --input ../cases.csv --dry-run");
  }

  return options;
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
  const knowledgeRepository = createDbKnowledgeRepository();
  const datasetRepository = createDbDatasetRecordRepository();
  const results = [];

  for (const [index, entry] of cases.entries()) {
    const calculatedState = await calculateBaziChart(entry.rawInput, knowledgeRepository);
    const existingRecord = await findExistingDraftOrReviewedDatasetRecord(entry.rawInput);

    if (existingRecord) {
      results.push({
        sourceRow: entry.sourceRow,
        name: entry.name,
        status: "skipped_existing",
        rawInput: entry.rawInput,
        existingRecord,
      });
      console.log(
        `Skipped existing row ${entry.sourceRow}: ${entry.name} -> ${existingRecord.id} (${existingRecord.status})`,
      );
      continue;
    }

    const generation = await generateGeminiDraftAnnotation({
      rawInput: entry.rawInput,
      calculatedState,
      model: options.model,
    });
    const payload = createDraftAnnotationPayload(
      entry.rawInput,
      calculatedState,
      generation.annotationData,
      "draft",
    );

    if (options.dryRun) {
      results.push({
        sourceRow: entry.sourceRow,
        name: entry.name,
        status: "generated_dry_run",
        rawInput: entry.rawInput,
        calculatedState,
        annotationData: generation.annotationData,
        model: generation.model,
        referenceCasePaths: generation.referenceCasePaths,
      });
      console.log(`Generated dry-run row ${entry.sourceRow}: ${entry.name}`);
      continue;
    }

    const savedRecord = await datasetRepository.saveRecord(payload, options.annotator);

    results.push({
      sourceRow: entry.sourceRow,
      name: entry.name,
      status: "inserted",
      rawInput: entry.rawInput,
      recordId: savedRecord.recordId,
      updatedAt: savedRecord.updatedAt,
      model: generation.model,
      referenceCasePaths: generation.referenceCasePaths,
    });
    console.log(`Inserted row ${entry.sourceRow}: ${entry.name} -> ${savedRecord.recordId}`);

    const hasMoreRows = index < cases.length - 1;

    if (hasMoreRows && options.requestDelayMs > 0) {
      console.log(
        `Cooling down for ${Math.ceil(options.requestDelayMs / 1000)}s before the next Gemini request...`,
      );
      await sleep(options.requestDelayMs);
    }
  }

  const payload = {
    input: options.input,
    count: cases.length,
    dryRun: options.dryRun,
    model: options.model,
    annotator: options.annotator,
    output: options.output,
    receipt: options.receipt ?? null,
    results,
  };

  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  if (options.receipt) {
    const receipt = {
      input: options.input,
      output: options.output,
      totalRows: cases.length,
      insertedCount: results.filter((entry) => entry.status === "inserted").length,
      skippedExistingCount: results.filter((entry) => entry.status === "skipped_existing").length,
      dryRunGeneratedCount: results.filter((entry) => entry.status === "generated_dry_run").length,
      model: options.model,
      annotator: options.annotator,
    };

    await mkdir(path.dirname(options.receipt), { recursive: true });
    await writeFile(options.receipt, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});