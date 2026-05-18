import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

import {
  AutoLabelingDraftBatchSchema,
  AutoLabelingIntentDomainSchema,
  createQueueEntry,
} from "../src/lib/bazi/auto-labeling";
import { createDatasetRecordMetadata } from "../src/lib/bazi/dataset-metadata";
import { generateGeminiDraftAnnotation } from "../src/lib/bazi/gemini-draft-generator";
import { RawInputSchema } from "../src/lib/bazi/schema-types";
import { calculateBaziChart, createDbKnowledgeRepository } from "../src/lib/bazi/symbolic-engine";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const DEFAULT_OUTPUT_PATH = path.resolve(process.cwd(), "output/legacy-gemini-three-cases.json");
const DEFAULT_MODEL = "gemini-3-flash-preview";

const LegacyCaseInputSchema = z.object({
  label: z.string().trim().min(1).optional(),
  intentDomain: AutoLabelingIntentDomainSchema.default("general"),
  customerName: z.string().trim().min(1).optional(),
  caseNote: z.string().trim().min(1).optional(),
  rawInput: RawInputSchema,
});

const LegacyCaseDocumentSchema = z.object({
  version: z.literal("1"),
  cases: z.array(LegacyCaseInputSchema).min(1),
});

type CliOptions = {
  input: string;
  output: string;
  model: string;
  dryRun: boolean;
  useReferenceCases: boolean;
};

function readFlagValue(argv: string[], flag: string) {
  return argv.find((entry) => entry.startsWith(`${flag}=`))?.slice(flag.length + 1);
}

function parseCliOptions(argv: string[]): CliOptions {
  const dryRun = argv.includes("--dry-run");
  const useReferenceCases = !argv.includes("--no-reference-cases");
  const input = readFlagValue(argv, "--input");
  const output = readFlagValue(argv, "--output");
  const model = readFlagValue(argv, "--model") || DEFAULT_MODEL;
  const unknownFlags = argv.filter((entry) => {
    if (!entry.startsWith("--")) {
      return true;
    }

    if (entry === "--dry-run" || entry === "--no-reference-cases") {
      return false;
    }

    return !["--input", "--output", "--model"].some((flag) => entry.startsWith(`${flag}=`));
  });

  if (unknownFlags.length > 0) {
    throw new Error(`Unknown CLI option(s): ${unknownFlags.join(", ")}`);
  }

  if (!input) {
    throw new Error("Missing required --input=<path> option.");
  }

  return {
    input: path.resolve(process.cwd(), input),
    output: output ? path.resolve(process.cwd(), output) : DEFAULT_OUTPUT_PATH,
    model,
    dryRun,
    useReferenceCases,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCliOptions(argv);
  const repository = createDbKnowledgeRepository();
  const inputRaw = await readFile(options.input, "utf8");
  const inputDocument = LegacyCaseDocumentSchema.parse(JSON.parse(inputRaw));
  const queueBatchId = `legacy-gemini-${new Date().toISOString()}`;

  if (options.dryRun) {
    const previews = [];

    for (const [index, entry] of inputDocument.cases.entries()) {
      const calculatedState = await calculateBaziChart(entry.rawInput, repository);
      const generation = await generateGeminiDraftAnnotation({
        rawInput: entry.rawInput,
        calculatedState,
        model: options.model,
        useReferenceCases: options.useReferenceCases,
      });

      previews.push({
        label: entry.label ?? null,
        customerName: entry.customerName ?? null,
        rawInput: entry.rawInput,
        dimensions: generation.annotationData.dimensions.map((dimension) => ({
          dimension_name: dimension.dimension_name,
          thought_process: dimension.thought_process,
          final_prediction: dimension.final_prediction,
          supporting_signals: dimension.supporting_signals,
        })),
        reviewSummary: generation.annotationData.reviewSummary ?? null,
        referenceCasePaths: generation.referenceCasePaths,
        sourceRow: index + 1,
      });
    }

    console.log(JSON.stringify({
      mode: "dry-run",
      input: options.input,
      output: options.output,
      model: options.model,
      useReferenceCases: options.useReferenceCases,
      count: previews.length,
      previews,
    }, null, 2));
    return;
  }

  const records = [];

  for (const [index, entry] of inputDocument.cases.entries()) {
    const calculatedState = await calculateBaziChart(entry.rawInput, repository);
    const queueEntry = createQueueEntry({
      intentDomain: entry.intentDomain,
      rawInput: entry.rawInput,
      calculatedState,
    });
    const generation = await generateGeminiDraftAnnotation({
      rawInput: entry.rawInput,
      calculatedState,
      model: options.model,
      useReferenceCases: options.useReferenceCases,
    });

    records.push({
      ...queueEntry,
      metadata: createDatasetRecordMetadata({
        customerName: entry.customerName,
        caseNote: entry.caseNote,
        sourceFile: options.input,
        sourceRow: index + 1,
        generation: {
          source: "agent-import",
          model: options.model,
          queueBatchId,
          generatedAt: new Date().toISOString(),
        },
      }),
      annotationData: generation.annotationData,
    });
  }

  const batch = AutoLabelingDraftBatchSchema.parse({
    version: "1",
    records,
  });

  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(batch, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    input: options.input,
    output: options.output,
    count: batch.records.length,
    model: options.model,
    useReferenceCases: options.useReferenceCases,
  }, null, 2));
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
