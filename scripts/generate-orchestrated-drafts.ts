import path from "node:path";
import { pathToFileURL } from "node:url";

import { config as loadEnv } from "dotenv";

import { AutoLabelingIntentDomainSchema } from "../src/lib/bazi/auto-labeling";
import {
  createDbDatasetRecordRepository,
  generateAndSaveOrchestratedDraft,
  type PendingDraftDatasetRecord,
  type ProofDatasetRecord,
} from "../src/lib/bazi/dataset-records";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

type CliOptions = {
  limit: number | null;
  runName: string | null;
  concurrency: number;
  help: boolean;
};

type GenerateRecordSuccess = {
  recordId: string;
  savedRecordId: string;
  updatedAt: string;
  model: string;
  completedChunkCount: number;
};

type GenerateRecordFailure = {
  recordId: string;
  message: string;
};

export type GenerateOrchestratedDraftsSummary = {
  status: "completed";
  runName: string | null;
  totalAvailableCount: number;
  selectedCount: number;
  skippedCount: number;
  processedCount: number;
  failedCount: number;
  limit: number | null;
  concurrency: number;
  results: GenerateRecordSuccess[];
  failures: GenerateRecordFailure[];
};

export type GenerateOrchestratedDraftsDependencies = {
  listDraftRecords?: () => Promise<PendingDraftDatasetRecord[]>;
  getRecordById?: (recordId: string) => Promise<ProofDatasetRecord | null>;
  generateDraft?: typeof generateAndSaveOrchestratedDraft;
  now?: () => Date;
  log?: (message: string) => void;
};

const DEFAULT_ANNOTATOR_ID = "agent_orchestrator";

const HELP_TEXT = [
  "Usage: bun scripts/generate-orchestrated-drafts.ts [options]",
  "",
  "Options:",
  "  --limit=<number>         Limit the number of target records to process.",
  "  --runName=<string>       Optional run label for operator logging.",
  "  --concurrency=<number>   Worker concurrency for Phase 2 integration.",
  "  --help                   Show this help message.",
].join("\n");

function readFlagValue(argv: string[], flag: string) {
  return argv.find((entry) => entry.startsWith(`${flag}=`))?.slice(flag.length + 1);
}

function parsePositiveInteger(value: string, flag: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return parsed;
}

export function parseCliOptions(argv: string[]): CliOptions {
  const help = argv.includes("--help");
  const limitValue = readFlagValue(argv, "--limit");
  const runNameValue = readFlagValue(argv, "--runName");
  const concurrencyValue = readFlagValue(argv, "--concurrency");
  const unknownFlags = argv.filter((entry) => {
    if (!entry.startsWith("--")) {
      return true;
    }

    if (entry === "--help") {
      return false;
    }

    return !["--limit", "--runName", "--concurrency"].some((flag) =>
      entry.startsWith(`${flag}=`)
    );
  });

  if (unknownFlags.length > 0) {
    throw new Error(`Unknown CLI option(s): ${unknownFlags.join(", ")}`);
  }

  return {
    limit: limitValue ? parsePositiveInteger(limitValue, "--limit") : null,
    runName: runNameValue?.trim() ? runNameValue.trim() : null,
    concurrency: concurrencyValue ? parsePositiveInteger(concurrencyValue, "--concurrency") : 1,
    help,
  };
}

function selectTargetRecordIds(records: PendingDraftDatasetRecord[], limit: number | null) {
  return records
    .slice(0, limit ?? records.length)
    .map((record) => record.id);
}

function resolveIntentDomain(record: ProofDatasetRecord) {
  const result = AutoLabelingIntentDomainSchema.safeParse(record.intentDomain);

  return result.success ? result.data : undefined;
}

function createLogLine(message: string) {
  return `[orchestrated-generator] ${message}`;
}

async function generateDraftForRecord(
  recordId: string,
  dependencies: Required<GenerateOrchestratedDraftsDependencies>,
) {
  const record = await dependencies.getRecordById(recordId);

  if (!record) {
    throw new Error(`Draft record ${recordId} was not found.`);
  }

  const generatedAt = dependencies.now().toISOString();
  const result = await dependencies.generateDraft({
    rawInput: record.rawInput,
    calculatedState: record.calculatedState,
    intentDomain: resolveIntentDomain(record),
    annotatorId: record.annotatorId ?? DEFAULT_ANNOTATOR_ID,
    recordId: record.id,
    metadata: {
      generation: {
        source: "queue",
        queueBatchId: record.metadata.generation?.queueBatchId,
        queueSeed: record.metadata.generation?.queueSeed,
        generatedAt,
      },
      reviewLifecycle: {
        state: "active",
        staleReason: undefined,
        staleAt: undefined,
      },
    },
  });

  return {
    recordId: record.id,
    savedRecordId: result.savedRecord.recordId,
    updatedAt: result.savedRecord.updatedAt,
    model: result.model,
    completedChunkCount: result.completedChunkIds.length,
  } satisfies GenerateRecordSuccess;
}

export async function runGeneration(
  options: CliOptions,
  dependencies: GenerateOrchestratedDraftsDependencies = {},
): Promise<GenerateOrchestratedDraftsSummary> {
  const repository = createDbDatasetRecordRepository();
  const resolvedDependencies: Required<GenerateOrchestratedDraftsDependencies> = {
    listDraftRecords: dependencies.listDraftRecords ?? (() => repository.listDraftRecords()),
    getRecordById: dependencies.getRecordById ?? ((recordId) => repository.getRecordById(recordId)),
    generateDraft: dependencies.generateDraft ?? generateAndSaveOrchestratedDraft,
    now: dependencies.now ?? (() => new Date()),
    log: dependencies.log ?? console.log,
  };
  const draftRecords = await resolvedDependencies.listDraftRecords();
  const targetRecordIds = selectTargetRecordIds(draftRecords, options.limit);
  const results: GenerateRecordSuccess[] = [];
  const failures: GenerateRecordFailure[] = [];
  const skippedCount = Math.max(0, draftRecords.length - targetRecordIds.length);

  resolvedDependencies.log(
    createLogLine(
      `starting run${options.runName ? ` "${options.runName}"` : ""} with ${draftRecords.length} active draft target(s); selected ${targetRecordIds.length} for this pass${options.limit ? ` (limit=${options.limit})` : ""}.`,
    ),
  );

  if (skippedCount > 0) {
    resolvedDependencies.log(
      createLogLine(`skipping ${skippedCount} remaining active draft target(s) for a later pass.`),
    );
  }

  if (targetRecordIds.length === 0) {
    resolvedDependencies.log(createLogLine("no active draft targets found; nothing to process."));
  }

  for (let index = 0; index < targetRecordIds.length; index += options.concurrency) {
    const currentBatch = targetRecordIds.slice(index, index + options.concurrency);
    const currentResults = await Promise.all(
      currentBatch.map(async (recordId) => {
        try {
          resolvedDependencies.log(createLogLine(`processing record ${recordId}...`));
          const result = await generateDraftForRecord(recordId, resolvedDependencies);

          resolvedDependencies.log(
            createLogLine(
              `saved record ${result.savedRecordId} from target ${recordId} using ${result.model} (${result.completedChunkCount} chunk(s)).`,
            ),
          );

          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const failure = { recordId, message } satisfies GenerateRecordFailure;

          failures.push(failure);
          resolvedDependencies.log(createLogLine(`failed record ${recordId}: ${message}`));
          return null;
        }
      }),
    );

    results.push(...currentResults.filter((entry): entry is GenerateRecordSuccess => entry !== null));
  }

  if (failures.length > 0) {
    throw new Error(
      `Failed to generate orchestrated drafts for ${failures.length} record(s): ${failures
        .map((failure) => `${failure.recordId} (${failure.message})`)
        .join(", ")}`,
    );
  }

  return {
    status: "completed",
    runName: options.runName,
    totalAvailableCount: draftRecords.length,
    selectedCount: targetRecordIds.length,
    skippedCount,
    processedCount: results.length,
    failedCount: failures.length,
    limit: options.limit,
    concurrency: options.concurrency,
    results,
    failures,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCliOptions(argv);

  if (options.help) {
    console.log(HELP_TEXT);
    return;
  }

  const summary = await runGeneration(options);

  console.log(createLogLine(`completed run with ${summary.processedCount} success(es), ${summary.failedCount} failure(s), and ${summary.skippedCount} skipped target(s).`));

  console.log(JSON.stringify(summary, null, 2));
}

if (
  typeof process.argv[1] === "string"
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}