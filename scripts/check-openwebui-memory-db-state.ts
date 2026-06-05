import path from "node:path";

import { neon } from "@neondatabase/serverless";
import { config as loadEnv } from "dotenv";

import { getDatabaseUrl } from "../src/lib/env";

type ColumnRow = {
  column_name: string;
};

type ConstraintRow = {
  conname: string;
};

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

async function main() {
  const sql = neon(getDatabaseUrl());
  const columns = (await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bazi_chat_histories'
      and column_name in ('thread_id', 'continuity_state')
    order by column_name;
  `) as ColumnRow[];

  const constraints = (await sql`
    select conname
    from pg_constraint
    where conrelid = 'bazi_chat_histories'::regclass
      and conname = 'bazi_chat_histories_clerk_user_id_thread_id_unique'
    limit 1;
  `) as ConstraintRow[];

  const hasThreadId = columns.some((row) => row.column_name === "thread_id");
  const hasContinuityState = columns.some((row) => row.column_name === "continuity_state");
  const hasThreadScopedUnique = constraints.length > 0;

  console.log(
    [
      "Open WebUI memory preflight:",
      `thread_id=${hasThreadId ? "present" : "missing"}`,
      `continuity_state=${hasContinuityState ? "present" : "missing"}`,
      `thread_scoped_unique=${hasThreadScopedUnique ? "present" : "missing"}`,
    ].join(" "),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});