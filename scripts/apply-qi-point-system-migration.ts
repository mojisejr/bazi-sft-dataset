/**
 * Apply migration: Qi Point System (ระบบกิจกรรม — แต้ม Qi)
 *   - เพิ่มคอลัมน์ bazi_wallet.qi + bazi_ledger_txn.qi_delta
 *   - สร้าง bazi_entitlement / bazi_qi_claim / bazi_feature_quota
 *   - index owner_id ของ bazi_saved_chart
 * additive + idempotent.
 * Usage: node --env-file=.env --import tsx scripts/apply-qi-point-system-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createDbSqlClient } from "../src/db/client";

const DUPLICATE_OBJECT = "42710";
const DUPLICATE_TABLE = "42P07";
const DUPLICATE_COLUMN = "42701";

const TABLES = ["bazi_wallet", "bazi_ledger_txn", "bazi_entitlement", "bazi_qi_claim", "bazi_feature_quota"];

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0038_qi_point_system.sql");
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
      if (code === DUPLICATE_OBJECT || code === DUPLICATE_TABLE || code === DUPLICATE_COLUMN) continue;
      throw error;
    }
  }

  for (const table of TABLES) {
    const result = await sql.unsafe(
      "select count(*)::int as n from information_schema.columns where table_name = $1;",
      [table],
    );
    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{ n: number }>;
    console.log(`OK ${table}: ${rows[0]?.n ?? 0} columns`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION FAILED:", e);
    process.exit(1);
  });
