import { access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { config as loadEnv } from "dotenv";

import { getDatabaseUrl } from "../src/lib/env";

type ColumnRow = {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
};

const migrationFilePath = path.resolve(
  process.cwd(),
  "drizzle/0006_phase6_dataset_metadata.sql",
);

const metadataColumnQuery = [
  "select column_name, data_type, is_nullable, column_default",
  "from information_schema.columns",
  "where table_schema = 'public'",
  "  and table_name = 'bazi_dataset_records'",
  "  and column_name = 'metadata'",
  "limit 1;",
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

function readMetadataColumn(): ColumnRow | null {
  const output = runPsql([
    "-d",
    getDatabaseUrl(),
    "-F",
    "\t",
    "-At",
    "-c",
    metadataColumnQuery,
  ]);

  if (output.length === 0) {
    return null;
  }

  const [column_name = "", data_type = "", is_nullable = "", column_default = ""] = output.split("\t");

  return {
    column_name,
    data_type,
    is_nullable,
    column_default,
  };
}

async function ensureMigrationExists(filePath: string) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Expected migration file is missing: ${path.basename(filePath)}`);
  }
}

async function main() {
  const beforeColumn = readMetadataColumn();

  if (!beforeColumn) {
    await ensureMigrationExists(migrationFilePath);
    runPsql([
      "-d",
      getDatabaseUrl(),
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      migrationFilePath,
    ]);
  }

  const afterColumn = readMetadataColumn();

  if (!afterColumn) {
    throw new Error("Phase 6 migration did not add metadata to bazi_dataset_records.");
  }

  if (afterColumn.data_type !== "jsonb") {
    throw new Error(`Unexpected metadata column type: ${afterColumn.data_type}`);
  }

  if (afterColumn.is_nullable !== "NO") {
    throw new Error("Metadata column must be NOT NULL after Phase 6 migration.");
  }

  if (!afterColumn.column_default?.includes("'{}'::jsonb")) {
    throw new Error("Metadata column must default to '{}'::jsonb after Phase 6 migration.");
  }

  console.log(
    `Phase 6 migration applied successfully. metadata column verified with default ${afterColumn.column_default}.`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});