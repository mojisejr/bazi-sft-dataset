/**
 * สรุปการเรียกใช้ API ต่อฟีเจอร์: model, จำนวนครั้ง, โทเคนเฉลี่ย/ครั้ง, ต้นทุนเฉลี่ย/ครั้ง, รวม
 * Usage: node --env-file=.env --import tsx scripts/api-call-summary.ts
 */
import { createDbSqlClient } from "../src/db/client";
import { priceCall, usdToThb } from "../src/lib/llm-usage/pricing";
import { costUsdOf } from "../src/lib/louise-hay/pricing";

const num = (v: unknown) => Number(v ?? 0);
const baht = (u: number) => `฿${usdToThb(u).toFixed(4)}`;
const FEAT: Record<string, string> = {
  reading_topic_usage: "อ่านดวง (บทใหม่)", divine_cards_usage: "โหมดเซียน (ไพ่)",
  oracle_cards_usage: "ไพ่ออราเคิล", honeycomb_usage: "เบอร์รังผึ้ง",
  pair_rephrase_usage: "จับคู่/เรียบเรียง", reading_draft_usage: "ร่างบท (draft)",
  fortune_sage_usage: "เซียมซี", almanac_usage: "ปฏิทินโหรา",
  man_vs_day_usage: "ดวงกับวัน", phone_reading_usage: "เลขพยากรณ์",
  reaction_chamber_usage: "ห้องปฏิกิริยา",
};

async function main() {
  const sql = createDbSqlClient();
  const rows: { label: string; model: string; n: number; inPer: number; outPer: number; usdPer: number; usdTot: number }[] = [];

  for (const [t, label] of Object.entries(FEAT)) {
    try {
      const r = (await sql.unsafe(
        `select model, provider, count(*)::int n, coalesce(sum(in_tokens),0) si, coalesce(sum(out_tokens),0) so
         from ${t} group by model, provider`,
      )) as Record<string, unknown>[];
      for (const g of r) {
        const n = num(g.n); if (!n) continue;
        const usdTot = priceCall({ provider: String(g.provider), model: String(g.model), inTokens: num(g.si), outTokens: num(g.so) });
        rows.push({ label, model: String(g.model), n, inPer: num(g.si) / n, outPer: num(g.so) / n, usdPer: usdTot / n, usdTot });
      }
    } catch {}
  }

  const lh = (await sql.unsafe(
    `select model, count(*)::int n, coalesce(sum(classify_in_tokens+embed_tokens+gen_in_tokens),0) si,
            coalesce(sum(classify_out_tokens+gen_out_tokens),0) so,
            coalesce(sum(classify_in_tokens),0) ci, coalesce(sum(classify_out_tokens),0) co,
            coalesce(sum(embed_tokens),0) e, coalesce(sum(gen_in_tokens),0) gi, coalesce(sum(gen_out_tokens),0) go
     from louise_hay_usage group by model`,
  )) as Record<string, unknown>[];
  for (const g of lh) {
    const n = num(g.n); if (!n) continue;
    const usdTot = costUsdOf({ model: String(g.model), classifyInTokens: num(g.ci), classifyOutTokens: num(g.co), embedTokens: num(g.e), genInTokens: num(g.gi), genOutTokens: num(g.go) });
    rows.push({ label: "โค้ชฮีลใจ (แชท)", model: String(g.model), n, inPer: num(g.si) / n, outPer: num(g.so) / n, usdPer: usdTot / n, usdTot });
  }

  rows.sort((a, b) => b.usdTot - a.usdTot);
  console.log("ฟีเจอร์".padEnd(22), "โมเดล".padEnd(24), "ครั้ง".padStart(6), "in/ครั้ง".padStart(9), "out/ครั้ง".padStart(9), "฿/ครั้ง".padStart(11), "฿รวม".padStart(10));
  let tUsd = 0, tN = 0;
  for (const r of rows) {
    tUsd += r.usdTot; tN += r.n;
    console.log(
      r.label.padEnd(20), r.model.padEnd(24), String(r.n).padStart(6),
      r.inPer.toFixed(0).padStart(9), r.outPer.toFixed(0).padStart(9),
      baht(r.usdPer).padStart(11), baht(r.usdTot).padStart(12),
    );
  }
  console.log("─".repeat(96));
  console.log(`รวม ${tN} calls  =  ฿${usdToThb(tUsd).toFixed(2)}  (เฉลี่ย ฿${usdToThb(tUsd / tN).toFixed(4)}/call)`);
}
main().then(() => process.exit(0));
