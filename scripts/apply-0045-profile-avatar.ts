/**
 * Migration 0045 — add avatar (base64) columns to bazi_user_profile (edit-personal-info "เปลี่ยนรูปโปรไฟล์").
 * idempotent (ADD COLUMN IF NOT EXISTS). Usage: node --env-file=.env --import tsx scripts/apply-0045-profile-avatar.ts
 */
import { createDbSqlClient } from "../src/db/client";

async function main() {
  const sql = createDbSqlClient();
  await sql.unsafe(`ALTER TABLE "bazi_user_profile" ADD COLUMN IF NOT EXISTS "avatar_base64" text;`);
  await sql.unsafe(`ALTER TABLE "bazi_user_profile" ADD COLUMN IF NOT EXISTS "avatar_mime" text;`);
  await sql.unsafe(`ALTER TABLE "bazi_user_profile" ADD COLUMN IF NOT EXISTS "avatar_updated_at" timestamptz;`);
  const cols = (await sql.unsafe(
    `select column_name from information_schema.columns where table_name='bazi_user_profile' and column_name in ('avatar_base64','avatar_mime','avatar_updated_at') order by column_name;`,
  )) as unknown as Array<{ column_name: string }>;
  console.log("0045 applied. present columns:", cols.map((c) => c.column_name).join(", "));
  await sql.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
