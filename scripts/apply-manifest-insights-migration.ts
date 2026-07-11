/**
 * Apply migration: manifest_insights_usage (ตาราง token usage ของ Behavior Insights)
 * Usage: node --env-file=.env --import tsx scripts/apply-manifest-insights-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createDbSqlClient } from "../src/db/client";

const DUPLICATE_OBJECT = "42710";
const DUPLICATE_TABLE = "42P07";

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0035_manifest_insights_usage.sql");
  const ddl = readFileSync(sqlPath, "utf8");
  const sql = createDbSqlClient();

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
      await sql.unsafe(statement);
    } catch (error) {
      const code = error && typeof error === "object" ? (error as { code?: string }).code : undefined;
      if (code === DUPLICATE_OBJECT || code === DUPLICATE_TABLE) continue;
      throw error;
    }
  }

  const result = await sql.unsafe(
    "select count(*)::int as n from information_schema.columns where table_name = 'manifest_insights_usage';",
  );
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{ n: number }>;
  console.log(`OK manifest_insights_usage: ${rows[0]?.n ?? 0} columns`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
  console.error("MIGRATION FAILED:", e);
  process.exit(1);
});
