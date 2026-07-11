/**
 * Apply migration: bazi_newdata_reading_revisions (additive, idempotent)
 * รันผ่าน neon serverless client (ไม่พึ่ง psql)
 *
 * Usage: node --env-file=.env --import tsx scripts/apply-newdata-reading-revisions-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createDbSqlClient } from "../src/db/client";

const DUPLICATE_TABLE = "42P07"; // CREATE TABLE/INDEX ที่มีอยู่แล้ว

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0018_phase_newdata_reading_revisions.sql");
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
      if (error && typeof error === "object" && (error as { code?: string }).code === DUPLICATE_TABLE) {
        continue; // ตาราง/ดัชนีมีอยู่แล้ว — รันซ้ำได้ปลอดภัย
      }
      throw error;
    }
  }

  const result = await sql.unsafe(
    "select column_name, data_type from information_schema.columns where table_name = 'bazi_newdata_reading_revisions' order by ordinal_position;",
  );
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
    column_name: string;
    data_type: string;
  }>;
  console.log("OK table bazi_newdata_reading_revisions columns:");
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
