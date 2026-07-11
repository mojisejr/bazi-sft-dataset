/**
 * นับแถวใน usage tables ทั้งหมด แยกตามวัน (เวลาไทย) เพื่อดูว่ามี mock data วันไหนบ้าง
 * Usage: node --env-file=.env --import tsx scripts/inspect-usage-by-day.ts
 */
import { createDbSqlClient } from "../src/db/client";

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
  for (const t of TABLES) {
    try {
      const r = (await sql.unsafe(
        `select to_char(created_at at time zone 'Asia/Bangkok','YYYY-MM-DD') d, count(*)::int n
         from ${t} group by d order by d`,
      )) as { d: string; n: number }[];
      if (!r.length) continue;
      const total = r.reduce((s, x) => s + x.n, 0);
      console.log(`\n== ${t} (total ${total}) ==`);
      for (const x of r) console.log(`   ${x.d}  ${x.n}`);
    } catch (e) {
      console.log(`\n== ${t} == (skip: ${(e as Error).message})`);
    }
  }
}

main().then(() => process.exit(0));
