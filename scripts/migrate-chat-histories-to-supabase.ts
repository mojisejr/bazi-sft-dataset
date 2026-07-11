/**
 * ย้ายตาราง bazi_chat_histories (ตกหล่นจากการย้าย Neon → Supabase):
 * สร้างตารางบนฐานใหม่ (ถ้ายังไม่มี) แล้ว copy ทุกแถวจาก Neon แบบ upsert (id เดิม, ข้อมูลใหม่กว่าชนะ)
 * Usage: node --env-file=.env --import tsx scripts/migrate-chat-histories-to-supabase.ts
 */
import { createDbSqlClient } from "../src/db/client";

const DDL = `
create table if not exists "bazi_chat_histories" (
  "id" uuid primary key default gen_random_uuid(),
  "line_user_id" text not null unique,
  "messages" jsonb not null default '[]'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);`;

async function main() {
  const newUrl = process.env.APP_DATABASE_URL;
  const oldUrl = process.env.DATABASE_URL;
  if (!newUrl || !oldUrl) throw new Error("ต้องมีทั้ง APP_DATABASE_URL และ DATABASE_URL ใน env");

  const src = createDbSqlClient(oldUrl);
  const dst = createDbSqlClient(newUrl);

  await dst.unsafe(DDL);
  console.log("สร้างตาราง bazi_chat_histories บน Supabase แล้ว (if not exists)");

  const rows = (await src.unsafe(
    `select id, line_user_id, messages, created_at, updated_at from "bazi_chat_histories" order by created_at`,
  )) as {
    id: string;
    line_user_id: string;
    messages: unknown;
    created_at: string;
    updated_at: string;
  }[];
  console.log(`อ่านจาก Neon: ${rows.length} แถว`);

  let copied = 0;
  for (const r of rows) {
    await dst.unsafe(
      `insert into "bazi_chat_histories" (id, line_user_id, messages, created_at, updated_at)
       values ($1, $2, $3::jsonb, $4, $5)
       on conflict (line_user_id) do update set
         messages = excluded.messages,
         updated_at = excluded.updated_at
       where "bazi_chat_histories".updated_at < excluded.updated_at`,
      [r.id, r.line_user_id, JSON.stringify(r.messages), r.created_at, r.updated_at],
    );
    copied++;
  }
  console.log(`คัดลอกแล้ว ${copied} แถว`);

  const check = (await dst.unsafe(
    `select count(*)::int n, max(updated_at)::text latest from "bazi_chat_histories"`,
  )) as { n: number; latest: string | null }[];
  console.log(`ตรวจสอบบน Supabase: ${check[0].n} แถว | updated ล่าสุด ${check[0].latest}`);

  await src.end();
  await dst.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
