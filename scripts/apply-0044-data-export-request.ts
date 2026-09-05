/**
 * Migration 0044 — bazi_data_export_request (privacy-data-export async-email).
 * idempotent (CREATE TABLE/INDEX IF NOT EXISTS). Usage: node --env-file=.env --import tsx scripts/apply-0044-data-export-request.ts
 */
import { createDbSqlClient } from "../src/db/client";

async function main() {
  const sql = createDbSqlClient();
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS "bazi_data_export_request" (
    "id" text PRIMARY KEY,
    "anon_id" text NOT NULL,
    "email" text,
    "format" text NOT NULL DEFAULT 'json+csv',
    "status" text NOT NULL DEFAULT 'collecting',
    "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
    "delivered_at" timestamp with time zone
  );`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS "bazi_data_export_request_anon_idx" ON "bazi_data_export_request" ("anon_id");`);
  const cols = (await sql.unsafe(
    `select column_name from information_schema.columns where table_name='bazi_data_export_request' order by ordinal_position;`,
  )) as unknown as Array<{ column_name: string }>;
  console.log("0044 applied. columns:", cols.map((c) => c.column_name).join(", "));
  await sql.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
