import path from "node:path";
import { readFile } from "node:fs/promises";

import { config as loadEnv } from "dotenv";
import { and, eq, sql } from "drizzle-orm";

import { createDbClient } from "../src/db/client";
import { baziDatasetRecords } from "../src/db/schema";
import { parseThaiBaziCasesCsv } from "../src/lib/bazi/csv-case-loader";
import { createDatasetRecordMetadata } from "../src/lib/bazi/dataset-metadata";

type CliOptions = {
  input: string;
  overwrite: boolean;
};

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

function parseCliOptions(argv: string[]): CliOptions {
  let input = "";
  let overwrite = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    if (argument === "--input" && nextValue) {
      input = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (argument === "--overwrite") {
      overwrite = true;
    }
  }

  if (!input) {
    throw new Error("--input is required. Example: npm run dataset:metadata:backfill -- --input ../cases.csv");
  }

  return { input, overwrite };
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const csvText = await readFile(options.input, "utf8");
  const importedCases = parseThaiBaziCasesCsv(csvText);
  const db = createDbClient();
  let updatedCount = 0;
  let unmatchedCount = 0;

  for (const entry of importedCases) {
    const metadata = createDatasetRecordMetadata({
      customerName: entry.name,
      sourceFile: options.input,
      sourceRow: entry.sourceRow,
    });

    const whereClause = options.overwrite
      ? eq(baziDatasetRecords.rawInput, entry.rawInput)
      : and(
          eq(baziDatasetRecords.rawInput, entry.rawInput),
          sql`nullif(btrim(${baziDatasetRecords.metadata} ->> 'customerName'), '') is null`,
        );

    const updatedRows = await db
      .update(baziDatasetRecords)
      .set({
        metadata: sql`${baziDatasetRecords.metadata} || ${JSON.stringify(metadata)}::jsonb`,
      })
      .where(whereClause)
      .returning({ id: baziDatasetRecords.id });

    if (updatedRows.length === 0) {
      unmatchedCount += 1;
      continue;
    }

    updatedCount += updatedRows.length;
  }

  console.log(
    JSON.stringify(
      {
        input: options.input,
        importedCaseCount: importedCases.length,
        updatedCount,
        unmatchedCount,
        overwrite: options.overwrite,
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