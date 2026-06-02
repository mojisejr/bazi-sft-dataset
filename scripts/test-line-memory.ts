import assert from "node:assert/strict";
import path from "node:path";

import { config as loadEnv } from "dotenv";

import { createDbClient, createDbSqlClient } from "../src/db/client";
import { createLineMemoryService, MAX_MEMORY_MESSAGES } from "../src/features/line-chat/memory-service";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

async function ensureLineChatTables() {
  const sql = createDbSqlClient();

  await sql`create extension if not exists pgcrypto;`;
  await sql`
    create table if not exists bazi_user_profiles (
      id uuid primary key default gen_random_uuid(),
      clerk_user_id text not null unique,
      line_user_id text unique,
      birth_date text,
      birth_time text,
      gender text,
      is_profile_complete boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `;
  await sql`
    create table if not exists user_line_mappings (
      clerk_user_id text primary key,
      line_user_id text not null unique,
      created_at timestamptz not null default now()
    );
  `;
  await sql`
    create table if not exists bazi_chat_histories (
      id uuid primary key default gen_random_uuid(),
      clerk_user_id text unique,
      line_user_id text unique,
      context_summary text,
      messages jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `;
  await sql`
    alter table bazi_chat_histories
    add column if not exists clerk_user_id text,
    add column if not exists context_summary text;
  `;
  await sql`
    alter table bazi_chat_histories
    alter column line_user_id drop not null;
  `;
  await sql`
    do $$
    begin
      if not exists (
        select 1
        from pg_constraint
        where conname = 'bazi_chat_histories_clerk_user_id_unique'
      ) then
        alter table bazi_chat_histories
        add constraint bazi_chat_histories_clerk_user_id_unique unique (clerk_user_id);
      end if;
    end
    $$;
  `;
}

async function main() {
  await ensureLineChatTables();

  const lineUserId = `line-phase1-${Date.now()}`;
  const clerkUserId = `clerk-phase1-${Date.now()}`;
  const db = createDbClient();
  const sql = createDbSqlClient();
  const memoryService = createLineMemoryService(db);

  try {
    await sql`delete from bazi_chat_histories where line_user_id = ${lineUserId};`;
    await sql`delete from user_line_mappings where clerk_user_id = ${clerkUserId};`;
    await sql`
      insert into user_line_mappings (clerk_user_id, line_user_id)
      values (${clerkUserId}, ${lineUserId})
      on conflict (clerk_user_id) do update
      set line_user_id = excluded.line_user_id;
    `;

    for (let turn = 0; turn < 6; turn += 1) {
      await memoryService.addTurnAndPrune(lineUserId, [
        { role: "user", content: `user-${turn}` },
        { role: "model", content: `model-${turn}` },
      ]);
    }

    const memoryAfterInsert = await memoryService.getMemory(lineUserId);

    assert.equal(memoryAfterInsert.length, MAX_MEMORY_MESSAGES);
    assert.equal(memoryAfterInsert[0]?.content, "user-1");
    assert.equal(memoryAfterInsert.at(-1)?.content, "model-5");

    await sql`
      update bazi_chat_histories
      set updated_at = now() - interval '25 hours'
      where line_user_id = ${lineUserId};
    `;

    const memoryAfterAmnesia = await memoryService.getMemory(lineUserId);

    assert.deepEqual(memoryAfterAmnesia, []);

    console.log(
      `Line memory validation passed: inserted 12 messages, retained ${MAX_MEMORY_MESSAGES}, expired history cleared after 24h.`,
    );
  } finally {
    await sql`delete from bazi_chat_histories where line_user_id = ${lineUserId};`;
    await sql`delete from user_line_mappings where clerk_user_id = ${clerkUserId};`;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});