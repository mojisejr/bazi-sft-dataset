import { access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { config as loadEnv } from "dotenv";

import { getDatabaseUrl } from "../src/lib/env";

const annotationTruthMigrationFilePath = path.resolve(
  process.cwd(),
  "drizzle/0002_phase16_annotation_truth.sql",
);

const annotatorIdentityMigrationFilePath = path.resolve(
  process.cwd(),
  "drizzle/0003_phase53_annotator_identity.sql",
);

const columnQuery = [
  "select column_name",
  "from information_schema.columns",
  "where table_schema = 'public'",
  "  and table_name = 'bazi_dataset_records'",
  "order by ordinal_position;",
].join("\n");

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

function runPsql(args: string[]) {
  const result = spawnSync("psql", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: getDatabaseUrl(),
    },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "psql command failed.");
  }

  return result.stdout.trim();
}

function readDatasetColumns() {
  const output = runPsql(["-d", getDatabaseUrl(), "-At", "-c", columnQuery]);
  return output.length === 0 ? [] : output.split("\n");
}

function hasAnnotationTruth(columns: string[]) {
  return (
    columns.includes("annotation_data") &&
    !columns.includes("chain_of_thought") &&
    !columns.includes("target_output")
  );
}

async function ensureMigrationExists(filePath: string) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Expected migration file is missing: ${path.basename(filePath)}`);
  }
}

async function main() {
  const beforeColumns = readDatasetColumns();
  const annotationTruthApplied = hasAnnotationTruth(beforeColumns);

  if (!annotationTruthApplied) {
    await ensureMigrationExists(annotationTruthMigrationFilePath);
    runPsql([
      "-d",
      getDatabaseUrl(),
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      annotationTruthMigrationFilePath,
    ]);
  }

  const afterAnnotationTruthColumns = readDatasetColumns();

  if (!afterAnnotationTruthColumns.includes("annotator_id")) {
    await ensureMigrationExists(annotatorIdentityMigrationFilePath);
    runPsql([
      "-d",
      getDatabaseUrl(),
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      annotatorIdentityMigrationFilePath,
    ]);
  }

  const afterColumns = readDatasetColumns();

  if (!afterColumns.includes("annotation_data")) {
    throw new Error("Phase 1.6 migration did not add annotation_data to bazi_dataset_records.");
  }

  if (afterColumns.includes("chain_of_thought") || afterColumns.includes("target_output")) {
    throw new Error("Phase 1.6 migration did not fully remove legacy dataset columns.");
  }

  if (!afterColumns.includes("annotator_id")) {
    throw new Error("Phase 5.3 migration did not add annotator_id to bazi_dataset_records.");
  }

  console.log(
    `Phase 1.6 migration applied successfully. Current dataset columns: ${afterColumns.join(", ")}`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
