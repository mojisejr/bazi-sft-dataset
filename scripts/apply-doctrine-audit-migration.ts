/**
 * Apply migration: bazi_doctrine_audit (Phase 3, additive, idempotent)
 * Usage: node --env-file=.env --import tsx scripts/apply-doctrine-audit-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

import { getDatabaseUrl } from "../src/lib/env";

/** ตัด comment + แยกเป็นรายคำสั่ง (neon http รันทีละ statement) */
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
  const sqlPath = path.resolve(process.cwd(), "drizzle/0008_phase_doctrine_audit.sql");
  const ddl = readFileSync(sqlPath, "utf8");
  const sql = neon(getDatabaseUrl());

  for (const statement of splitStatements(ddl)) {
    await sql.query(statement);
  }

  const result = await sql.query(
    "select column_name, data_type from information_schema.columns where table_name = 'bazi_doctrine_audit' order by ordinal_position;",
  );
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
    column_name: string;
    data_type: string;
  }>;
  console.log("OK table bazi_doctrine_audit columns:");
  for (const r of rows) {
    console.log(`  - ${r.column_name}: ${r.data_type}`);
  }
}

main().catch((e) => {
  console.error("MIGRATION FAILED:", e);
  process.exit(1);
});
