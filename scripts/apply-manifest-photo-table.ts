/**
 * Migration — create bazi_manifest_photo (manifest images stored in the SAME DB as the goal card, Neon).
 * idempotent. Usage: node --env-file=.env --import tsx scripts/apply-manifest-photo-table.ts
 */
import { createDbSqlClient } from "../src/db/client";

async function main() {
  const sql = createDbSqlClient();
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "bazi_manifest_photo" (
      "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "anon_id"      text NOT NULL,
      "image_base64" text NOT NULL,
      "mime"         text NOT NULL DEFAULT 'image/jpeg',
      "created_at"   timestamptz NOT NULL DEFAULT now()
    );
  `);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS "bazi_manifest_photo_anon_idx" ON "bazi_manifest_photo" ("anon_id");`);
  const cols = (await sql.unsafe(
    `select column_name from information_schema.columns where table_name='bazi_manifest_photo' order by ordinal_position;`,
  )) as unknown as Array<{ column_name: string }>;
  console.log("manifest-photo applied. columns:", cols.map((c) => c.column_name).join(", "));
  await sql.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
