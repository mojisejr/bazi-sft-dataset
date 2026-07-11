/**
 * เช็คว่าตาราง bazi_chat_histories มีบน Supabase แล้วหรือยัง (อ่านอย่างเดียว ไม่เขียนอะไร)
 * Usage: node --env-file=.env --import tsx scripts/check-chat-table-supabase.ts
 */
import { createDbSqlClient } from "../src/db/client";

async function main() {
  const newUrl = process.env.APP_DATABASE_URL;
  if (!newUrl) throw new Error("ต้องมี APP_DATABASE_URL ใน env");

  const dst = createDbSqlClient(newUrl);
  const cols = (await dst.unsafe(
    `select column_name, is_nullable from information_schema.columns
     where table_schema='public' and table_name='bazi_chat_histories' order by ordinal_position`,
  )) as { column_name: string; is_nullable: string }[];

  if (!cols.length) {
    console.log("Supabase: ยังไม่มีตาราง bazi_chat_histories");
  } else {
    console.log("Supabase: ตารางมีแล้ว");
    for (const c of cols) console.log(`  - ${c.column_name} (nullable: ${c.is_nullable})`);
    const n = (await dst.unsafe(`select count(*)::int n from "bazi_chat_histories"`)) as { n: number }[];
    console.log(`  จำนวนแถว: ${n[0].n}`);
  }
  await dst.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
