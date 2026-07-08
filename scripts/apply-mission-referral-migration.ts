/**
 * Apply migration: Mission/Achievement/Referral (4 ตาราง, additive, idempotent)
 * Usage: node --env-file=.env --import tsx scripts/apply-mission-referral-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

import { getDatabaseUrl } from "../src/lib/env";

const DUPLICATE_OBJECT = "42710";
const DUPLICATE_TABLE = "42P07";

const TABLES = [
  "bazi_mission_progress",
  "bazi_achievement",
  "bazi_referral_code",
  "bazi_referral_redemption",
];

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0034_mission_referral.sql");
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

  for (const table of TABLES) {
    const result = await sql.query(
      "select count(*)::int as n from information_schema.columns where table_name = $1;",
      [table],
    );
    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{ n: number }>;
    console.log(`OK ${table}: ${rows[0]?.n ?? 0} columns`);
  }
}

main().catch((e) => {
  console.error("MIGRATION FAILED:", e);
  process.exit(1);
});
