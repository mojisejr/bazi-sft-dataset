import path from "node:path";
import { pathToFileURL } from "node:url";

import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

type CliOptions = {
  limit: number | null;
  runName: string | null;
  concurrency: number;
  help: boolean;
};

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

export async function main(argv = process.argv.slice(2)) {
  const options = parseCliOptions(argv);

  if (options.help) {
    console.log(HELP_TEXT);
    return;
  }

  console.log(
    JSON.stringify(
      {
        status: "phase-1-scaffold-ready",
        message: "Phase 2 will wire generateAndSaveOrchestratedDraft into this script.",
        options,
      },
      null,
      2,
    ),
  );
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