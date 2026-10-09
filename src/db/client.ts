import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getDatabaseUrl } from "@/lib/env";
import * as schema from "@/db/schema";
import { createResilientSql } from "@/db/resilient-sql";

// Runtime: Supabase TRANSACTION pooler (:6543) for serverless API routes.
// `prepare: false` is REQUIRED for the transaction pooler (no prepared statements).
// ssl 'require' = use SSL without strict CA verify (Supabase self-signed chain).
const globalForDb = globalThis as unknown as {
  _pgByUrl?: Map<string, ReturnType<typeof postgres>>;
};

export function createDbSqlClient(databaseUrl = getDatabaseUrl()) {
  const clients = globalForDb._pgByUrl ?? new Map<string, ReturnType<typeof postgres>>();
  globalForDb._pgByUrl = clients;

  // key มี version — เปลี่ยน config แล้ว dev server สร้าง client ใหม่ทันทีโดยไม่ต้อง restart
  // (client เก่าที่ connection ค้างจะถูกทิ้งไว้ใน map เดิมเฉย ๆ)
  const key = `${databaseUrl}#v3`;
  const existing = clients.get(key);
  if (existing) return existing;

  // max > 1: query หนัก/ค้างหนึ่งตัวต้องไม่บล็อกทั้งแอป (เดิม max:1 → socket ค้างตัวเดียว = ทุก request แขวน)
  // timeout ทุกชั้น: กัน connection ที่ตายเงียบ (เครื่อง sleep/เน็ตสะดุด) ค้างถาวรใน pool
  // v3 (2026-10-10): timeout ของ connection ไม่ครอบ query ที่ค้างกลางทาง (prod 2026-10-09 ค้าง 9.5 นาที) — ทุก query
  // จึงวิ่งผ่าน createResilientSql: ค้างเกิน 5 วิ → เปลี่ยน pool ใหม่แล้วลองซ้ำเองหนึ่งครั้ง (ดู resilient-sql.ts)
  const client = createResilientSql(() =>
    postgres(databaseUrl, {
      prepare: false,
      ssl: "require",
      max: 10,
      connect_timeout: 10,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
    }),
  );
  clients.set(key, client);
  return client;
}

export function createDbClient(databaseUrl = getDatabaseUrl()) {
  const client = createDbSqlClient(databaseUrl);

  return drizzle(client, { schema });
}
