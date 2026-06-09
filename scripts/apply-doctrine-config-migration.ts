/**
 * Apply migration: bazi_doctrine_config (Phase 2, additive, idempotent)
 * Usage: node --env-file=.env --import tsx scripts/apply-doctrine-config-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

import { getDatabaseUrl } from "../src/lib/env";

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0007_phase_doctrine_config.sql");
  const ddl = readFileSync(sqlPath, "utf8");
  const sql = neon(getDatabaseUrl());

  await sql.query(ddl);

  const result = await sql.query(
    "select column_name, data_type from information_schema.columns where table_name = 'bazi_doctrine_config' order by ordinal_position;",
  );
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
    column_name: string;
    data_type: string;
  }>;
  console.log("OK table bazi_doctrine_config columns:");
  for (const r of rows) {
    console.log(`  - ${r.column_name}: ${r.data_type}`);
  }
}

main().catch((e) => {
  console.error("MIGRATION FAILED:", e);
  process.exit(1);
});
