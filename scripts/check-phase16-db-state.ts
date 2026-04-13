import path from "node:path";

import { neon } from "@neondatabase/serverless";
import { config as loadEnv } from "dotenv";

import { getDatabaseUrl } from "../src/lib/env";

type ColumnRow = {
  column_name: string;
};

type CountRow = {
  dataset_count: number;
  reviewed_count: number;
  legacy_content_count: number;
};

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

async function main() {
  const sql = neon(getDatabaseUrl());
  const legacyColumns = (await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bazi_dataset_records'
      and column_name in ('chain_of_thought', 'target_output')
    order by column_name;
  `) as ColumnRow[];

  if (legacyColumns.length === 0) {
    console.log(
      "Phase 1.6 preflight: legacy dataset columns are already absent in the live database. Safe migrate precheck is not needed.",
    );
    return;
  }

  const datasetRows = (await sql`
    select
      count(*)::int as dataset_count,
      count(*) filter (where status = 'reviewed')::int as reviewed_count,
      count(*) filter (
        where nullif(btrim(coalesce(chain_of_thought, '')), '') is not null
           or nullif(btrim(coalesce(target_output, '')), '') is not null
      )::int as legacy_content_count
    from bazi_dataset_records;
  `) as CountRow[];

  const counts = datasetRows[0] ?? {
    dataset_count: 0,
    reviewed_count: 0,
    legacy_content_count: 0,
  };

  console.log(
    `Phase 1.6 preflight: dataset_count=${counts.dataset_count}, reviewed_count=${counts.reviewed_count}, legacy_content_count=${counts.legacy_content_count}`,
  );

  if (
    counts.dataset_count > 0 ||
    counts.reviewed_count > 0 ||
    counts.legacy_content_count > 0
  ) {
    throw new Error(
      "Phase 1.6 migration is blocked because bazi_dataset_records still contains rows that could lose legacy content. Backup or truncate the dataset table before running db:migrate:safe.",
    );
  }

  console.log(
    "Phase 1.6 preflight passed: bazi_dataset_records is empty, so dataset-only migration can proceed safely.",
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
