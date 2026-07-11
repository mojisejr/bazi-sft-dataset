/**
 * คำนวณต้นทุน (THB) ต่อวันเวลาไทย จาก usage tables — ตรรกะเดียวกับ /stats route
 * Usage: node --env-file=.env --import tsx scripts/cost-by-day.ts
 */
import { createDbSqlClient } from "../src/db/client";

import { priceCall, usdToThb } from "../src/lib/llm-usage/pricing";
import { costUsdOf } from "../src/lib/louise-hay/pricing";

const TZ = "Asia/Bangkok";
const num = (v: unknown) => Number(v ?? 0);
const GEN_TABLES = [
  "reading_topic_usage", "divine_cards_usage", "oracle_cards_usage", "honeycomb_usage",
  "pair_rephrase_usage", "reading_draft_usage", "fortune_sage_usage", "almanac_usage",
  "man_vs_day_usage", "phone_reading_usage", "reaction_chamber_usage",
];

async function main() {
  const sql = createDbSqlClient();
  const day = new Map<string, number>(); // date -> usd

  for (const t of GEN_TABLES) {
    try {
      const r = (await sql.unsafe(
        `select to_char(created_at at time zone '${TZ}','YYYY-MM-DD') d, model, provider,
                coalesce(sum(in_tokens),0) si, coalesce(sum(out_tokens),0) so
         from ${t} group by d, model, provider`,
      )) as Record<string, unknown>[];
      for (const g of r) {
        const usd = priceCall({ provider: String(g.provider), model: String(g.model), inTokens: num(g.si), outTokens: num(g.so) });
        day.set(String(g.d), (day.get(String(g.d)) ?? 0) + usd);
      }
    } catch { /* table absent */ }
  }

  const lh = (await sql.unsafe(
    `select to_char(created_at at time zone '${TZ}','YYYY-MM-DD') d, model,
            coalesce(sum(classify_in_tokens),0) ci, coalesce(sum(classify_out_tokens),0) co,
            coalesce(sum(embed_tokens),0) e, coalesce(sum(gen_in_tokens),0) gi,
            coalesce(sum(gen_out_tokens),0) go
     from louise_hay_usage group by d, model`,
  )) as Record<string, unknown>[];
  for (const g of lh) {
    const usd = costUsdOf({
      model: String(g.model), classifyInTokens: num(g.ci), classifyOutTokens: num(g.co),
      embedTokens: num(g.e), genInTokens: num(g.gi), genOutTokens: num(g.go),
    });
    day.set(String(g.d), (day.get(String(g.d)) ?? 0) + usd);
  }

  for (const d of [...day.keys()].sort()) {
    console.log(`${d}  $${day.get(d)!.toFixed(4)}  ฿${usdToThb(day.get(d)!).toFixed(2)}`);
  }
}

main().then(() => process.exit(0));
