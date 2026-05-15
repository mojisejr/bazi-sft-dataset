import path from "node:path";
import { pathToFileURL } from "node:url";

import { config as loadEnv } from "dotenv";

import {
  DEFAULT_DAY_MASTER_RELATION_POC_MODEL,
  buildDayMasterRelationBrief,
  buildDayMasterRelationPacket,
  formatDayMasterRelationPocBriefPreview,
  formatDayMasterRelationPocGeneratedReport,
  formatDayMasterRelationPocPreflightReport,
  generateDayMasterRelationReadingPoc,
} from "@/lib/bazi/day-master-relation-reading-poc";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart, createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const DEFAULT_TEST_CASE = RawInputSchema.parse({
  birthDate: "1989-01-03",
  birthTime: "08:45",
  gender: "male",
  province: "Bangkok",
  calendarSystem: "solar",
  timezone: "Asia/Bangkok",
});

type CliExecutionOptions = {
  dryRun: boolean;
  model: string;
  maxStep: number;
  rawInput: typeof DEFAULT_TEST_CASE;
};

const RAW_INPUT_FLAG_TO_FIELD = {
  "--birth-date": "birthDate",
  "--birth-time": "birthTime",
  "--gender": "gender",
  "--province": "province",
  "--calendar-system": "calendarSystem",
  "--timezone": "timezone",
} as const;

function readFlagValue(argv: string[], flag: string) {
  return argv.find((entry) => entry.startsWith(`${flag}=`))?.slice(flag.length + 1);
}

export function parseCliExecutionOptions(argv: string[]): CliExecutionOptions {
  const dryRun = argv.includes("--dry-run");
  const model = readFlagValue(argv, "--model") || DEFAULT_DAY_MASTER_RELATION_POC_MODEL;
  const maxStepRaw = readFlagValue(argv, "--max-step");
  const parsedMaxStep = maxStepRaw ? parseInt(maxStepRaw, 10) : 6;
  const maxStep = Number.isNaN(parsedMaxStep) ? 6 : Math.max(1, Math.min(6, parsedMaxStep));
  const rawInputPatch = Object.fromEntries(
    Object.entries(RAW_INPUT_FLAG_TO_FIELD)
      .map(([flag, field]) => [field, readFlagValue(argv, flag)])
      .filter(([, value]) => value !== undefined),
  );

  const unknownFlags = argv.filter((entry) => {
    if (!entry.startsWith("--")) {
      return true;
    }

    if (entry === "--dry-run") {
      return false;
    }

    return !["--model", "--max-step", ...Object.keys(RAW_INPUT_FLAG_TO_FIELD)].some((flag) => entry.startsWith(`${flag}=`));
  });

  if (unknownFlags.length > 0) {
    throw new Error(`Unknown CLI option(s): ${unknownFlags.join(", ")}`);
  }

  return {
    dryRun,
    model,
    maxStep,
    rawInput: RawInputSchema.parse({
      ...DEFAULT_TEST_CASE,
      ...rawInputPatch,
    }),
  };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCliExecutionOptions(argv);
  const repository = createDbKnowledgeRepository();
  const calculatedState = await calculateBaziChart(options.rawInput, repository);
  const packet = buildDayMasterRelationPacket(calculatedState);
  const brief = buildDayMasterRelationBrief(options.rawInput, packet);

  const maxVisibleStep = options.maxStep < 6 ? options.maxStep : undefined;

  console.log(formatDayMasterRelationPocPreflightReport({
    rawInput: options.rawInput,
    packet,
    maxVisibleStep,
  }));
  console.log("");
  console.log(formatDayMasterRelationPocBriefPreview({
    rawInput: options.rawInput,
    brief,
    model: options.model,
    maxVisibleStep,
  }));

  if (options.dryRun) {
    return;
  }

  const result = await generateDayMasterRelationReadingPoc({
    rawInput: options.rawInput,
    calculatedState,
    model: options.model,
  });

  console.log("");
  console.log(formatDayMasterRelationPocGeneratedReport({
    rawInput: options.rawInput,
    packet: result.packet,
    brief: result.brief,
    response: result.response,
    model: result.model,
    includeAuditAppendix: true,
    includeBriefPreview: false,
    maxVisibleStep,
  }));
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
