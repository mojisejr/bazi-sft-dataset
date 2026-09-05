/**
 * Migration 0046 — add image_base64 + image_mime to bazi_sacred_map_location (engine-served images).
 * idempotent. Usage: node --env-file=.env --import tsx scripts/apply-0046-sacred-map-image.ts
 */
import { createDbSqlClient } from "../src/db/client";

async function main() {
  const sql = createDbSqlClient();
  await sql.unsafe(`ALTER TABLE "bazi_sacred_map_location" ADD COLUMN IF NOT EXISTS "image_base64" text;`);
  await sql.unsafe(`ALTER TABLE "bazi_sacred_map_location" ADD COLUMN IF NOT EXISTS "image_mime" text;`);
  const cols = (await sql.unsafe(
    `select column_name from information_schema.columns where table_name='bazi_sacred_map_location' and column_name in ('image_base64','image_mime') order by column_name;`,
  )) as unknown as Array<{ column_name: string }>;
  console.log("0046 applied. present columns:", cols.map((c) => c.column_name).join(", "));
  await sql.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
