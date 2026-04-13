import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { config as loadEnv } from "dotenv";
import { asc, eq, inArray } from "drizzle-orm";

import { createDbClient } from "../src/db/client";
import { baziDatasetRecords } from "../src/db/schema";
import { createBaziSftJsonlContent } from "../src/lib/bazi/export-sft-dataset";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

export type ExportCliOptions = {
  outputPath?: string;
  limit?: number;
  markExported: boolean;
};

function parsePositiveInteger(value: string, flagName: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flagName} must be a positive integer.`);
  }

  return parsed;
}

export function parseExportCliArgs(argv: readonly string[]): ExportCliOptions {
  let outputPath: string | undefined;
  let limit: number | undefined;
  let markExported = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--mark-exported") {
      markExported = true;
      continue;
    }

    if (arg === "--output") {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error("--output requires a file path.");
      }

      outputPath = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (arg.startsWith("--output=")) {
      outputPath = path.resolve(process.cwd(), arg.slice("--output=".length));
      continue;
    }

    if (arg === "--limit") {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error("--limit requires a numeric value.");
      }

      limit = parsePositiveInteger(nextValue, "--limit");
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      limit = parsePositiveInteger(arg.slice("--limit=".length), "--limit");
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    outputPath,
    limit,
    markExported,
  };
}

export function createDefaultExportOutputPath(now = new Date()) {
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes(),
  ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

  return path.resolve(process.cwd(), "output", `bazi-sft-reviewed-${stamp}.jsonl`);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseExportCliArgs(argv);
  const db = createDbClient();

  const query = db
    .select({
      id: baziDatasetRecords.id,
      rawInput: baziDatasetRecords.rawInput,
      calculatedState: baziDatasetRecords.calculatedState,
      intentDomain: baziDatasetRecords.intentDomain,
      annotationData: baziDatasetRecords.annotationData,
      status: baziDatasetRecords.status,
      updatedAt: baziDatasetRecords.updatedAt,
    })
    .from(baziDatasetRecords)
    .where(eq(baziDatasetRecords.status, "reviewed"))
    .orderBy(asc(baziDatasetRecords.updatedAt));

  const reviewedRecords =
    typeof options.limit === "number" ? await query.limit(options.limit) : await query;

  if (reviewedRecords.length === 0) {
    throw new Error("No reviewed dataset records found to export.");
  }

  const outputPath = options.outputPath ?? createDefaultExportOutputPath();
  const jsonlContent = createBaziSftJsonlContent(reviewedRecords);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${jsonlContent}\n`, "utf8");

  if (options.markExported) {
    await db
      .update(baziDatasetRecords)
      .set({ status: "exported" })
      .where(
        inArray(
          baziDatasetRecords.id,
          reviewedRecords.map((record) => record.id),
        ),
      );
  }

  console.log(
    JSON.stringify(
      {
        exportedCount: reviewedRecords.length,
        outputPath,
        markExported: options.markExported,
      },
      null,
      2,
    ),
  );
}

const isMainModule =
  typeof process.argv[1] === "string" &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}