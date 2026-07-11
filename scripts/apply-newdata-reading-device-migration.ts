/**
 * Apply migration: bazi_newdata_reading.device_label (additive, idempotent)
 * Usage: npm run db:apply:newdata-reading-device
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createDbSqlClient } from "../src/db/client";

const DUPLICATE_OBJECT = "42710";
const DUPLICATE_COLUMN = "42701";

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0025_newdata_reading_device_label.sql");
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
      if (code === DUPLICATE_OBJECT || code === DUPLICATE_COLUMN) continue;
      throw error;
    }
  }

  const result = await sql.unsafe(
    "select column_name, data_type from information_schema.columns where table_name = 'bazi_newdata_reading' order by ordinal_position;",
  );
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
    column_name: string;
    data_type: string;
  }>;
  console.log("OK table bazi_newdata_reading columns:");
  for (const r of rows) console.log(`  - ${r.column_name}: ${r.data_type}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
  console.error("MIGRATION FAILED:", e);
  process.exit(1);
});
