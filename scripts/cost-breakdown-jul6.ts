/**
 * แยกต้นทุน Jul 6 ตามฟีเจอร์+โมเดล + เช็คว่ามี token ครบไหม
 */
import { createDbSqlClient } from "../src/db/client";
import { priceCall, usdToThb } from "../src/lib/llm-usage/pricing";
import { costUsdOf } from "../src/lib/louise-hay/pricing";

const TZ = "Asia/Bangkok";
const num = (v: unknown) => Number(v ?? 0);
const D = "where to_char(created_at at time zone '" + TZ + "','YYYY-MM-DD') = '2026-07-06'";
const GEN = ["reading_topic_usage","divine_cards_usage","oracle_cards_usage","honeycomb_usage","pair_rephrase_usage","reading_draft_usage","fortune_sage_usage","almanac_usage","man_vs_day_usage","phone_reading_usage","reaction_chamber_usage"];

async function main() {
  const sql = createDbSqlClient();
  for (const t of GEN) {
    try {
      const r = (await sql.unsafe(`select model, provider, count(*)::int n, coalesce(sum(in_tokens),0) si, coalesce(sum(out_tokens),0) so, coalesce(sum(total_tokens),0) st from ${t} ${D} group by model, provider`)) as Record<string,unknown>[];
      for (const g of r) {
        const usd = priceCall({ provider: String(g.provider), model: String(g.model), inTokens: num(g.si), outTokens: num(g.so) });
        console.log(`${t}  ${g.provider}/${g.model}  n=${g.n}  in=${g.si} out=${g.so} tot=${g.st}  ฿${usdToThb(usd).toFixed(2)}`);
      }
    } catch {}
  }
  const lh = (await sql.unsafe(`select model, count(*)::int n, coalesce(sum(classify_in_tokens),0) ci, coalesce(sum(classify_out_tokens),0) co, coalesce(sum(embed_tokens),0) e, coalesce(sum(gen_in_tokens),0) gi, coalesce(sum(gen_out_tokens),0) go from louise_hay_usage ${D} group by model`)) as Record<string,unknown>[];
  for (const g of lh) {
    const usd = costUsdOf({ model: String(g.model), classifyInTokens: num(g.ci), classifyOutTokens: num(g.co), embedTokens: num(g.e), genInTokens: num(g.gi), genOutTokens: num(g.go) });
    console.log(`louise_hay  ${g.model}  n=${g.n}  ci=${g.ci} co=${g.co} embed=${g.e} gi=${g.gi} go=${g.go}  ฿${usdToThb(usd).toFixed(2)}`);
  }
}
main().then(() => process.exit(0));
