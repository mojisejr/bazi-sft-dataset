/**
 * Apply migration: ตาราง usage ของฟีเจอร์ narrate 5 ตัว (additive, idempotent)
 * Usage: node --env-file=.env --import tsx scripts/apply-narrate-usage-tables-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createDbSqlClient } from "../src/db/client";

const DUPLICATE_OBJECT = "42710";
const TABLES = [
  "fortune_sage_usage",
  "almanac_usage",
  "man_vs_day_usage",
  "phone_reading_usage",
  "reaction_chamber_usage",
];

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0028_narrate_usage_tables.sql");
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
      if (error && typeof error === "object" && (error as { code?: string }).code === DUPLICATE_OBJECT) {
        continue;
      }
      throw error;
    }
  }

  for (const t of TABLES) {
    const result = await sql.unsafe(
      `select count(*)::int as n from information_schema.columns where table_name = '${t}';`,
    );
    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{ n: number }>;
    console.log(`OK ${t}: ${rows[0]?.n ?? 0} columns`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
  console.error("MIGRATION FAILED:", e);
  process.exit(1);
});
