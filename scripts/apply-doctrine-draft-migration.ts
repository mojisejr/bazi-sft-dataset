/**
 * Apply migration: bazi_doctrine_draft (Phase 3b, additive, idempotent)
 * Usage: node --env-file=.env --import tsx scripts/apply-doctrine-draft-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createDbSqlClient } from "../src/db/client";

function splitStatements(ddl: string): string[] {
  return ddl
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0009_phase_doctrine_draft.sql");
  const ddl = readFileSync(sqlPath, "utf8");
  const sql = createDbSqlClient();
  for (const statement of splitStatements(ddl)) {
    await sql.unsafe(statement);
  }
  const result = await sql.unsafe(
    "select column_name, data_type from information_schema.columns where table_name = 'bazi_doctrine_draft' order by ordinal_position;",
  );
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
    column_name: string;
    data_type: string;
  }>;
  console.log("OK table bazi_doctrine_draft columns:");
  for (const r of rows) {
    console.log(`  - ${r.column_name}: ${r.data_type}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
  console.error("MIGRATION FAILED:", e);
  process.exit(1);
});
