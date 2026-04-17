import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { config as loadEnv } from "dotenv";

import { parseThaiBaziCasesCsv } from "../src/lib/bazi/csv-case-loader";

type CliOptions = {
  input: string;
  output?: string;
  province: string;
  timezone: string;
  dryRun: boolean;
};

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    input: "",
    output: undefined,
    province: "Bangkok",
    timezone: "Asia/Bangkok",
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
  const cases = parseThaiBaziCasesCsv(csvText, {
    province: options.province,
    timezone: options.timezone,
  });
  const payload = {
    input: options.input,
    count: cases.length,
    dryRun: options.dryRun,
    cases: cases.map((entry) => ({
      sourceRow: entry.sourceRow,
      name: entry.name,
      rawInput: entry.rawInput,
    })),
  };

  if (!options.dryRun && options.output) {
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify({ ...payload, output: options.output ?? null }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});