/**
 * เทียบตาราง + จำนวนแถวระหว่างฐานเก่า (DATABASE_URL/Neon) กับฐานใหม่ (APP_DATABASE_URL/Supabase)
 * เช็คว่าการย้ายข้อมูลครบหรือไม่
 * Usage: node --env-file=.env --import tsx scripts/compare-db-migration.ts
 */
import { createDbSqlClient } from "../src/db/client";

async function snapshot(url: string) {
  const sql = createDbSqlClient(url);
  const tables = (await sql.unsafe(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  )) as { table_name: string }[];

  const counts = new Map<string, { n: number; latest: string | null }>();
  for (const { table_name } of tables) {
    try {
      const hasCreated = (await sql.unsafe(
        `select 1 from information_schema.columns where table_schema='public' and table_name=$1 and column_name='created_at'`,
        [table_name],
      )) as unknown[];
      const r = (await sql.unsafe(
        hasCreated.length
          ? `select count(*)::int n, max(created_at)::text latest from "${table_name}"`
          : `select count(*)::int n, null latest from "${table_name}"`,
      )) as { n: number; latest: string | null }[];
      counts.set(table_name, r[0]);
    } catch {
      counts.set(table_name, { n: -1, latest: null });
    }
  }
  await sql.end();
  return counts;
}

async function main() {
  const newUrl = process.env.APP_DATABASE_URL;
  const oldUrl = process.env.DATABASE_URL;
  if (!newUrl || !oldUrl) throw new Error("ต้องมีทั้ง APP_DATABASE_URL และ DATABASE_URL ใน env");

  console.log("กำลังอ่านฐานใหม่ (Supabase)...");
  const nw = await snapshot(newUrl);
  console.log("กำลังอ่านฐานเก่า (Neon)...");
  const old = await snapshot(oldUrl);

  const all = [...new Set([...old.keys(), ...nw.keys()])].sort();
  const pad = (s: string, w: number) => s.padEnd(w);
  console.log(`\n${pad("table", 46)}${pad("Neon(เก่า)", 12)}${pad("Supabase(ใหม่)", 15)}สถานะ`);
  let missing = 0, behind = 0, ok = 0;
  for (const t of all) {
    const o = old.get(t);
    const n = nw.get(t);
    let status: string;
    if (!n) { status = "❌ ไม่มีในฐานใหม่"; missing++; }
    else if (!o) { status = "🆕 มีเฉพาะฐานใหม่"; ok++; }
    else if (n.n < o.n) { status = `⚠️ ขาด ${o.n - n.n} แถว`; behind++; }
    else { status = "✅"; ok++; }
    console.log(`${pad(t, 46)}${pad(String(o?.n ?? "-"), 12)}${pad(String(n?.n ?? "-"), 15)}${status}`);
  }
  console.log(`\nสรุป: ครบ/เกิน ${ok} | แถวขาด ${behind} | ตารางหายไป ${missing}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
