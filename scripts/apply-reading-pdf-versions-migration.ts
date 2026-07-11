/**
 * Apply migration: bazi_reading_pdf_versions (additive, idempotent)
 * รันผ่าน neon serverless client (ไม่พึ่ง psql)
 *
 * neon-http รับทีละ 1 statement ต่อ query และไม่รองรับ DO-block/dollar-quote →
 * split ไฟล์ .sql ด้วย "--> statement-breakpoint", ลบบรรทัดคอมเมนต์ออก, แล้วยิงทีละ statement
 * idempotency: CREATE TABLE/INDEX ใช้ IF NOT EXISTS; ถ้าตาราง/ดัชนีมีอยู่แล้วจะได้ 42P07 → กลืนทิ้ง
 *
 * Usage: node --env-file=.env --import tsx scripts/apply-reading-pdf-versions-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createDbSqlClient } from "../src/db/client";

const DUPLICATE_TABLE = "42P07"; // CREATE TABLE/INDEX ที่มีอยู่แล้ว

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0014_phase_reading_pdf_versions.sql");
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
    "select column_name, data_type from information_schema.columns where table_name = 'bazi_reading_pdf_versions' order by ordinal_position;",
  );
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
    column_name: string;
    data_type: string;
  }>;
  console.log("OK table bazi_reading_pdf_versions columns:");
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
