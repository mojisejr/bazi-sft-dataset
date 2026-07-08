/**
 * Apply migration: manifest_insights_usage (ตาราง token usage ของ Behavior Insights)
 * Usage: node --env-file=.env --import tsx scripts/apply-manifest-insights-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

import { getDatabaseUrl } from "../src/lib/env";

const DUPLICATE_OBJECT = "42710";
const DUPLICATE_TABLE = "42P07";

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0035_manifest_insights_usage.sql");
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
      const code = error && typeof error === "object" ? (error as { code?: string }).code : undefined;
      if (code === DUPLICATE_OBJECT || code === DUPLICATE_TABLE) continue;
      throw error;
    }
  }

  const result = await sql.query(
    "select count(*)::int as n from information_schema.columns where table_name = 'manifest_insights_usage';",
  );
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{ n: number }>;
  console.log(`OK manifest_insights_usage: ${rows[0]?.n ?? 0} columns`);
}

main().catch((e) => {
  console.error("MIGRATION FAILED:", e);
  process.exit(1);
});
