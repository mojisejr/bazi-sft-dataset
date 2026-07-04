/**
 * Apply migration: ตารางสถิติ LLM แยกตามฟีเจอร์ (additive, idempotent)
 *   reading_topic_usage / divine_cards_usage / oracle_cards_usage / honeycomb_usage /
 *   pair_rephrase_usage / reading_draft_usage
 * Usage: node --env-file=.env --import tsx scripts/apply-llm-usage-tables-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

import { getDatabaseUrl } from "../src/lib/env";

const DUPLICATE_OBJECT = "42710";

const TABLES = [
  "reading_topic_usage",
  "divine_cards_usage",
  "oracle_cards_usage",
  "honeycomb_usage",
  "pair_rephrase_usage",
  "reading_draft_usage",
];

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0024_phase_llm_usage_tables.sql");
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

  for (const table of TABLES) {
    const result = await sql.query(
      `select count(*)::int as n from information_schema.columns where table_name = '${table}';`,
    );
    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
      n: number;
    }>;
    console.log(`OK ${table}: ${rows[0]?.n ?? 0} columns`);
  }
}

main().catch((e) => {
  console.error("MIGRATION FAILED:", e);
  process.exit(1);
});
