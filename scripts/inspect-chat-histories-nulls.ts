/**
 * ตรวจแถว line_user_id ที่เป็น null ใน bazi_chat_histories ฝั่ง Neon (อ่านอย่างเดียว)
 * Usage: node --env-file=.env --import tsx scripts/inspect-chat-histories-nulls.ts
 */
import { createDbSqlClient } from "../src/db/client";

async function main() {
  const oldUrl = process.env.DATABASE_URL;
  if (!oldUrl) throw new Error("ต้องมี DATABASE_URL ใน env");
  const sql = createDbSqlClient(oldUrl);

  const rows = (await sql.unsafe(
    `select id, line_user_id, jsonb_array_length(messages) msg_count,
            created_at::text, updated_at::text,
            left(messages->0->>'content', 60) first_msg
     from "bazi_chat_histories" order by created_at`,
  )) as Record<string, unknown>[];

  for (const r of rows) {
    const uid = r.line_user_id === null ? "❌ NULL" : String(r.line_user_id).slice(0, 12) + "...";
    console.log(`${r.id} | uid=${uid} | ${r.msg_count} msgs | ${r.created_at} | "${r.first_msg}"`);
  }
  const nulls = rows.filter((r) => r.line_user_id === null).length;
  console.log(`\nรวม ${rows.length} แถว | line_user_id เป็น null: ${nulls} แถว`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
