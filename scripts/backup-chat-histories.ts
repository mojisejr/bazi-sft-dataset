/**
 * (1) เช็คว่าตาราง bazi_chat_histories มีบน Supabase แล้วหรือยัง (อ่านอย่างเดียว)
 * (2) สำรอง 11 แถวจาก Neon เป็นไฟล์ exports/bazi_chat_histories_neon_backup.json
 * Usage: node --env-file=.env --import tsx scripts/backup-chat-histories.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { createDbSqlClient } from "../src/db/client";

async function main() {
  const newUrl = process.env.APP_DATABASE_URL;
  const oldUrl = process.env.DATABASE_URL;
  if (!newUrl || !oldUrl) throw new Error("ต้องมีทั้ง APP_DATABASE_URL และ DATABASE_URL ใน env");

  const dst = createDbSqlClient(newUrl);
  const exists = (await dst.unsafe(
    `select column_name, is_nullable from information_schema.columns
     where table_schema='public' and table_name='bazi_chat_histories' order by ordinal_position`,
  )) as { column_name: string; is_nullable: string }[];
  if (exists.length) {
    const n = (await dst.unsafe(`select count(*)::int n from "bazi_chat_histories"`)) as { n: number }[];
    console.log(`Supabase: ตารางมีแล้ว (${exists.map((c) => c.column_name).join(", ")}) | ${n[0].n} แถว`);
  } else {
    console.log("Supabase: ยังไม่มีตาราง bazi_chat_histories");
  }
  await dst.end();

  const src = createDbSqlClient(oldUrl);
  const rows = await src.unsafe(
    `select id, line_user_id, messages, created_at::text created_at, updated_at::text updated_at
     from "bazi_chat_histories" order by created_at`,
  );
  mkdirSync("exports", { recursive: true });
  const path = "exports/bazi_chat_histories_neon_backup.json";
  writeFileSync(path, JSON.stringify(rows, null, 2), "utf8");
  console.log(`สำรองจาก Neon แล้ว ${rows.length} แถว → ${path}`);
  await src.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
