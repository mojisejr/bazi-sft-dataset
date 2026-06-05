import { access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { config as loadEnv } from "dotenv";

import { getDatabaseUrl } from "../src/lib/env";

type ColumnRow = {
  thread_id: string;
  continuity_state: string;
};

type ConstraintRow = {
  thread_scoped_unique: string;
};

const threadScopedMigrationFilePath = path.resolve(
  process.cwd(),
  "drizzle/0007_phase4b_thread_scoped_openwebui_memory.sql",
);

const continuityStateMigrationFilePath = path.resolve(
  process.cwd(),
  "drizzle/0008_phase3a_openwebui_continuity_state.sql",
);

const columnStateQuery = [
  "select",
  "  exists(",
  "    select 1",
  "    from information_schema.columns",
  "    where table_schema = 'public'",
  "      and table_name = 'bazi_chat_histories'",
  "      and column_name = 'thread_id'",
  "  ) as thread_id,",
  "  exists(",
  "    select 1",
  "    from information_schema.columns",
  "    where table_schema = 'public'",
  "      and table_name = 'bazi_chat_histories'",
  "      and column_name = 'continuity_state'",
  "  ) as continuity_state;",
].join("\n");

const constraintStateQuery = [
  "select exists(",
  "  select 1",
  "  from pg_constraint",
  "  where conrelid = 'bazi_chat_histories'::regclass",
  "    and conname = 'bazi_chat_histories_clerk_user_id_thread_id_unique'",
  ") as thread_scoped_unique;",
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

function readColumnState(): ColumnRow {
  const output = runPsql([
    "-d",
    getDatabaseUrl(),
    "-F",
    "\t",
    "-At",
    "-c",
    columnStateQuery,
  ]);

  const [thread_id = "f", continuity_state = "f"] = output.split("\t");

  return {
    thread_id,
    continuity_state,
  };
}

function readConstraintState(): ConstraintRow {
  const output = runPsql([
    "-d",
    getDatabaseUrl(),
    "-F",
    "\t",
    "-At",
    "-c",
    constraintStateQuery,
  ]);

  return {
    thread_scoped_unique: output || "f",
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
  const beforeColumns = readColumnState();
  const beforeConstraint = readConstraintState();

  if (beforeColumns.thread_id !== "t" || beforeConstraint.thread_scoped_unique !== "t") {
    await ensureMigrationExists(threadScopedMigrationFilePath);
    runPsql([
      "-d",
      getDatabaseUrl(),
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      threadScopedMigrationFilePath,
    ]);
  }

  const afterThreadColumns = readColumnState();
  const afterThreadConstraint = readConstraintState();

  if (afterThreadColumns.thread_id !== "t") {
    throw new Error("Open WebUI memory migration did not add thread_id to bazi_chat_histories.");
  }

  if (afterThreadConstraint.thread_scoped_unique !== "t") {
    throw new Error("Open WebUI memory migration did not add the thread-scoped unique constraint.");
  }

  if (afterThreadColumns.continuity_state !== "t") {
    await ensureMigrationExists(continuityStateMigrationFilePath);
    runPsql([
      "-d",
      getDatabaseUrl(),
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      continuityStateMigrationFilePath,
    ]);
  }

  const afterColumns = readColumnState();

  if (afterColumns.continuity_state !== "t") {
    throw new Error("Open WebUI memory migration did not add continuity_state to bazi_chat_histories.");
  }

  console.log(
    "Open WebUI memory migration applied successfully. bazi_chat_histories now has thread_id, continuity_state, and thread-scoped uniqueness.",
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});