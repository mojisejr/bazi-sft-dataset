/**
 * ต้นทุนจริงต่อ "บท" ของอ่านดวง (แยกตาม topicId) + รวมเป็น 1 ดวงเต็ม
 */
import { createDbSqlClient } from "../src/db/client";
import { priceCall, usdToThb } from "../src/lib/llm-usage/pricing";
import { READING_TOPIC_PROMPTS } from "../src/lib/bazi/reading-llm";

const num = (v: unknown) => Number(v ?? 0);

async function main() {
  const sql = createDbSqlClient();
  // label = "newdata2:topicId" | "newdata:topicId" | topicId → ตัด prefix
  const r = (await sql.unsafe(
    `select split_part(coalesce(label,''), ':', greatest(1, array_length(string_to_array(label,':'),1))) topic,
            model, provider, count(*)::int n,
            coalesce(sum(in_tokens),0) si, coalesce(sum(out_tokens),0) so
     from reading_topic_usage
     group by topic, model, provider order by topic`,
  )) as Record<string, unknown>[];

  const known = new Set(Object.keys(READING_TOPIC_PROMPTS));
  const per = new Map<string, { n: number; usd: number; inTok: number }>();
  for (const g of r) {
    const topic = String(g.topic);
    const usd = priceCall({ provider: String(g.provider), model: String(g.model), inTokens: num(g.si), outTokens: num(g.so) });
    const e = per.get(topic) ?? { n: 0, usd: 0, inTok: 0 };
    e.n += num(g.n); e.usd += usd; e.inTok += num(g.si);
    per.set(topic, e);
  }

  console.log("บท (topicId)".padEnd(30), "known?".padEnd(7), "calls".padStart(6), "in/call".padStart(8), "฿/call".padStart(9));
  let sumPerCall = 0, chapters = 0;
  for (const [topic, e] of [...per.entries()].sort()) {
    const perCall = e.usd / e.n;
    const isKnown = known.has(topic);
    if (isKnown) { sumPerCall += perCall; chapters++; }
    console.log(topic.padEnd(30), (isKnown ? "yes" : "NO").padEnd(7), String(e.n).padStart(6),
      (e.inTok / e.n).toFixed(0).padStart(8), `฿${usdToThb(perCall).toFixed(4)}`.padStart(9));
  }
  console.log("─".repeat(70));
  console.log(`บทที่นิยาม (READING_TOPIC_PROMPTS) = ${known.size} บท`);
  console.log(`บทที่พบข้อมูล (known) = ${chapters} บท`);
  console.log(`ต้นทุน 1 ดวงเต็ม = ผลรวม ฿/call ของทุกบท = ฿${usdToThb(sumPerCall).toFixed(2)}`);
}
main().then(() => process.exit(0));
