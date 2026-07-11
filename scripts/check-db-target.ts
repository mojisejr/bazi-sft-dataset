/**
 * เช็คว่า local ต่อ database ตัวไหนอยู่ (APP_DATABASE_URL ?? DATABASE_URL) + นับข้อมูลตารางหลัก
 * Usage: node --env-file=.env --import tsx scripts/check-db-target.ts
 */
import { getDatabaseUrl } from "../src/lib/env";
import { createDbSqlClient } from "../src/db/client";

async function main() {
  const url = new URL(getDatabaseUrl());
  console.log(`host     : ${url.hostname}:${url.port || "5432"}`);
  console.log(`database : ${url.pathname.slice(1)}`);
  console.log(`source   : ${process.env.APP_DATABASE_URL ? "APP_DATABASE_URL (ใหม่)" : "DATABASE_URL (เก่า)"}`);

  const sql = createDbSqlClient();
  const info = await sql.unsafe(
    "select current_database() db, inet_server_addr()::text addr, version() v",
  );
  console.log(`server   : ${info[0].db} @ ${info[0].addr ?? "?"} | ${String(info[0].v).split(",")[0]}`);

  const tables = [
    "bazi_reading_sessions",
    "bazi_newdata_reading_sessions",
    "bazi_dataset_records",
    "bazi_saved_charts",
  ];
  for (const t of tables) {
    try {
      const r = await sql.unsafe(`select count(*)::int n, max(created_at)::text latest from ${t}`);
      console.log(`${t}: ${r[0].n} แถว | ล่าสุด ${r[0].latest ?? "-"}`);
    } catch (e) {
      console.log(`${t}: (${(e as Error).message.split("\n")[0]})`);
    }
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
