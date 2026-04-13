import { spawnSync } from "node:child_process";
import path from "node:path";

import { config as loadEnv } from "dotenv";

import { getDatabaseUrl } from "../src/lib/env";

const migrationFilePath = path.resolve(
  process.cwd(),
  "drizzle/0002_phase16_annotation_truth.sql",
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

async function main() {
  const beforeColumns = readDatasetColumns();
  const alreadyApplied =
    beforeColumns.includes("annotation_data") &&
    !beforeColumns.includes("chain_of_thought") &&
    !beforeColumns.includes("target_output");

  if (!alreadyApplied) {
    runPsql(["-d", getDatabaseUrl(), "-v", "ON_ERROR_STOP=1", "-f", migrationFilePath]);
  }

  const afterColumns = readDatasetColumns();

  if (!afterColumns.includes("annotation_data")) {
    throw new Error("Phase 1.6 migration did not add annotation_data to bazi_dataset_records.");
  }

  if (afterColumns.includes("chain_of_thought") || afterColumns.includes("target_output")) {
    throw new Error("Phase 1.6 migration did not fully remove legacy dataset columns.");
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
