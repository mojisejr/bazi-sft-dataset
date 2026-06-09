/**
 * Apply migration: bazi_reading_doctrine_overrides (additive, idempotent)
 * รันผ่าน neon serverless client (ไม่พึ่ง psql) — ปลอดภัยเพราะใช้ CREATE TABLE IF NOT EXISTS
 *
 * Usage: node --env-file=.env --import tsx scripts/apply-reading-doctrine-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

import { getDatabaseUrl } from "../src/lib/env";

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0006_phase_reading_doctrine_overrides.sql");
  const ddl = readFileSync(sqlPath, "utf8");
  const sql = neon(getDatabaseUrl());

  // ใช้ sql.query() สำหรับ raw SQL string (ไม่ใช่ tagged template) — DDL เป็น statement เดียว
  await sql.query(ddl);

  const result = await sql.query(
    "select column_name, data_type from information_schema.columns where table_name = 'bazi_reading_doctrine_overrides' order by ordinal_position;",
  );
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
    column_name: string;
    data_type: string;
  }>;
  console.log("OK table bazi_reading_doctrine_overrides columns:");
  for (const r of rows) {
    console.log(`  - ${r.column_name}: ${r.data_type}`);
  }
}

main().catch((e) => {
  console.error("MIGRATION FAILED:", e);
  process.exit(1);
});
