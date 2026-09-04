/**
 * Migration 0043 — add email + birth_province to bazi_user_profile (edit-personal-info / edit-birth-data).
 * idempotent (ADD COLUMN IF NOT EXISTS). Usage: node --env-file=.env --import tsx scripts/apply-0043-profile-fields.ts
 */
import { createDbSqlClient } from "../src/db/client";

async function main() {
  const sql = createDbSqlClient();
  await sql.unsafe(`ALTER TABLE "bazi_user_profile" ADD COLUMN IF NOT EXISTS "email" text;`);
  await sql.unsafe(`ALTER TABLE "bazi_user_profile" ADD COLUMN IF NOT EXISTS "birth_province" text;`);
  const cols = (await sql.unsafe(
    `select column_name from information_schema.columns where table_name='bazi_user_profile' and column_name in ('email','birth_province') order by column_name;`,
  )) as unknown as Array<{ column_name: string }>;
  console.log("0043 applied. present columns:", cols.map((c) => c.column_name).join(", "));
  await sql.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
