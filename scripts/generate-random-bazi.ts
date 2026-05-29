import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { config as loadEnv } from "dotenv";

import {
  createAutoLabelingQueueDocument,
  createDeterministicRawInputs,
  createQueueEntry,
  type AutoLabelingIntentDomain,
} from "../src/lib/bazi/auto-labeling";
import {
  calculateBaziChart,
} from "../src/lib/bazi/symbolic-engine";
import { createDbKnowledgeRepository } from "../src/lib/bazi/symbolic-engine.repository";

type CliOptions = {
  count: number;
  seed: number;
  output: string;
  intentDomain: AutoLabelingIntentDomain;
  province: string;
  timezone: string;
  startYear: number;
  endYear: number;
};

const DEFAULT_OUTPUT_PATH = path.resolve(process.cwd(), "output/pending_generation.json");

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

function parseNumberOption(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    count: 200,
    seed: 20260416,
    output: DEFAULT_OUTPUT_PATH,
    intentDomain: "love",
    province: "Bangkok",
    timezone: "Asia/Bangkok",
    startYear: 1970,
    endYear: 2005,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    if (argument === "--count") {
      options.count = parseNumberOption(nextValue, options.count);
      index += 1;
      continue;
    }

    if (argument === "--seed") {
      options.seed = parseNumberOption(nextValue, options.seed);
      index += 1;
      continue;
    }

    if (argument === "--output" && nextValue) {
      options.output = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (argument === "--intent" && nextValue) {
      options.intentDomain = nextValue as AutoLabelingIntentDomain;
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

    if (argument === "--start-year") {
      options.startYear = parseNumberOption(nextValue, options.startYear);
      index += 1;
      continue;
    }

    if (argument === "--end-year") {
      options.endYear = parseNumberOption(nextValue, options.endYear);
      index += 1;
    }
  }

  return options;
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const repository = createDbKnowledgeRepository();
  const rawInputs = createDeterministicRawInputs({
    count: options.count,
    seed: options.seed,
    province: options.province,
    timezone: options.timezone,
    startYear: options.startYear,
    endYear: options.endYear,
  });
  const cases = [];

  for (const [index, rawInput] of rawInputs.entries()) {
    const calculatedState = await calculateBaziChart(rawInput, repository);

    cases.push(
      createQueueEntry({
        intentDomain: options.intentDomain,
        rawInput,
        calculatedState,
      }),
    );

    console.log(
      `Generated queue case ${index + 1}/${rawInputs.length}: ${rawInput.birthDate} ${rawInput.birthTime}`,
    );
  }

  const queueDocument = createAutoLabelingQueueDocument({
    seed: options.seed,
    cases,
  });

  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(queueDocument, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        output: options.output,
        count: queueDocument.cases.length,
        intentDomain: options.intentDomain,
        seed: options.seed,
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