import path from "node:path";

import { createDbSqlClient } from "../src/db/client";
import { config as loadEnv } from "dotenv";

type CountRow = {
  dataset_count: number;
};

type MetadataColumnRow = {
  column_name: string;
};

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

async function main() {
  const sql = createDbSqlClient();
  const metadataColumns = (await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bazi_dataset_records'
      and column_name = 'metadata'
    limit 1;
  `) as MetadataColumnRow[];

  const counts = (await sql`
    select count(*)::int as dataset_count
    from bazi_dataset_records;
  `) as CountRow[];

  const datasetCount = counts[0]?.dataset_count ?? 0;

  if (metadataColumns.length > 0) {
    console.log(
      `Phase 6 preflight: metadata column already exists on bazi_dataset_records. dataset_count=${datasetCount}`,
    );
    return;
  }

  console.log(
    `Phase 6 preflight: metadata column is absent and ready for append-only migration. dataset_count=${datasetCount}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});