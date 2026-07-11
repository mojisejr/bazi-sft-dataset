/**
 * ลบ mock usage: ทุกแถวที่ created_at ก่อน 2026-07-05 00:00 (เวลาไทย) ออกจาก usage tables ทั้งหมด
 * เก็บไว้เฉพาะการใช้จริง ก.ค. 05–06
 * Usage: node --env-file=.env --import tsx scripts/purge-mock-usage.ts
 */
import { createDbSqlClient } from "../src/db/client";

const CUTOFF = "2026-07-05T00:00:00+07:00"; // ลบทุกแถว < cutoff
const TABLES = [
  "reading_topic_usage",
  "divine_cards_usage",
  "oracle_cards_usage",
  "honeycomb_usage",
  "pair_rephrase_usage",
  "reading_draft_usage",
  "fortune_sage_usage",
  "almanac_usage",
  "man_vs_day_usage",
  "phone_reading_usage",
  "reaction_chamber_usage",
  "louise_hay_usage",
];

async function main() {
  const sql = createDbSqlClient();
  let grand = 0;
  for (const t of TABLES) {
    try {
      const before = ((await sql.unsafe(`select count(*)::int n from ${t}`)) as { n: number }[])[0].n;
      await sql.unsafe(`delete from ${t} where created_at < $1`, [CUTOFF]);
      const after = ((await sql.unsafe(`select count(*)::int n from ${t}`)) as { n: number }[])[0].n;
      const removed = before - after;
      grand += removed;
      console.log(`${t}: ลบ ${removed}, เหลือ ${after}`);
    } catch (e) {
      console.log(`${t}: skip (${(e as Error).message})`);
    }
  }
  console.log(`\nรวมลบทั้งหมด ${grand} แถว`);
}

main().then(() => process.exit(0));
