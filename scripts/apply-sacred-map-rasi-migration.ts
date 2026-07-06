/**
 * Apply migration: bazi_sacred_map_location — เพิ่ม rasi_upper + rasi_lower (additive, idempotent)
 * Usage: node --env-file=.env --import tsx scripts/apply-sacred-map-rasi-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

import { getDatabaseUrl } from "../src/lib/env";

const DUPLICATE_OBJECT = "42710";

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0030_sacred_map_rasi.sql");
  const ddl = readFileSync(sqlPath, "utf8");
  const sql = neon(getDatabaseUrl());

  const statements = ddl
    .split("--> statement-breakpoint")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    try {
      await sql.query(statement);
    } catch (error) {
      if (error && typeof error === "object" && (error as { code?: string }).code === DUPLICATE_OBJECT) {
        continue;
      }
      throw error;
    }
  }

  const result = await sql.query(
    "select column_name, data_type from information_schema.columns where table_name = 'bazi_sacred_map_location' order by ordinal_position;",
  );
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
    column_name: string;
    data_type: string;
  }>;
  console.log("OK table bazi_sacred_map_location columns:");
  for (const r of rows) {
    console.log(`  - ${r.column_name}: ${r.data_type}`);
  }
}

main().catch((e) => {
  console.error("MIGRATION FAILED:", e);
  process.exit(1);
});
