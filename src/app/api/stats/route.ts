/**
 * สถิติ + ต้นทุน LLM รวมทุกฟีเจอร์ (แดชบอร์ด /stats).
 * รวมด้วย SQL (SUM / COUNT / GROUP BY) ที่ฝั่ง DB → ถูกต้อง+เร็วแม้เป็นล้านแถว (ไม่ดึงแถวดิบมา JS).
 * ต้นทุนคำนวณจาก provider+model+token: group ตาม (feature, model) แล้ว priceCall() ทีละกลุ่ม
 * (ต้นทุนเป็นเชิงเส้นกับโทเคน → sum-แล้ว-price = price-แล้ว-sum เป๊ะ).
 */
import { createDbSqlClient } from "@/db/client";
import { priceCall, usdToThb, USD_TO_THB } from "@/lib/llm-usage/pricing";
import { costUsdOf } from "@/lib/louise-hay/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEATURE_LABEL: Record<string, string> = {
  reading_topic: "อ่านดวง (บทใหม่)",
  divine_cards: "โหมดเซียน (ไพ่)",
  oracle_cards: "ไพ่ออราเคิล",
  honeycomb: "เบอร์รังผึ้ง",
  pair_rephrase: "จับคู่/เรียบเรียง",
  reading_draft: "ร่างบทใหม่ (draft)",
  louise_hay: "โค้ชฮีลใจ (แชท)",
};

/** ชื่อตารางจริงของแต่ละฟีเจอร์ (นอก louise_hay ที่มีโครงเฉพาะ) */
const FEATURE_TABLE: Record<string, string> = {
  reading_topic: "reading_topic_usage",
  divine_cards: "divine_cards_usage",
  oracle_cards: "oracle_cards_usage",
  honeycomb: "honeycomb_usage",
  pair_rephrase: "pair_rephrase_usage",
  reading_draft: "reading_draft_usage",
};

const TZ = "Asia/Bangkok";
const num = (v: unknown) => Number(v ?? 0);

type Row = Record<string, unknown>;
async function rows(sql: ReturnType<typeof createDbSqlClient>, text: string): Promise<Row[]> {
  const r = await sql.query(text);
  return (Array.isArray(r) ? r : ((r as { rows?: Row[] }).rows ?? [])) as Row[];
}

export async function GET() {
  const sql = createDbSqlClient();

  try {
    const byFeature: { feature: string; label: string; calls: number; tokens: number; costUsd: number; costThb: number }[] = [];
    const dayMap = new Map<string, { tokens: number; costUsd: number; calls: number }>();
    const recentRaw: {
      feature: string; createdAt: string; model: string; provider: string;
      inTokens: number; outTokens: number; totalTokens: number; label: string | null;
    }[] = [];

    // ── ฟีเจอร์ทั่วไป (6 ตาราง) — group by model เพื่อคิดต้นทุนต่อโมเดล ──
    for (const [feature, table] of Object.entries(FEATURE_TABLE)) {
      const grp = await rows(
        sql,
        `select model, provider, count(*)::int n, coalesce(sum(in_tokens),0) si,
                coalesce(sum(out_tokens),0) so, coalesce(sum(total_tokens),0) st
         from ${table} group by model, provider`,
      );
      let calls = 0, tokens = 0, costUsd = 0;
      for (const g of grp) {
        const n = num(g.n), si = num(g.si), so = num(g.so), st = num(g.st);
        calls += n; tokens += st;
        costUsd += priceCall({ provider: String(g.provider), model: String(g.model), inTokens: si, outTokens: so });
      }
      if (calls > 0) byFeature.push({ feature, label: FEATURE_LABEL[feature], calls, tokens, costUsd, costThb: usdToThb(costUsd) });

      // รายวัน (group by วัน+โมเดล)
      const daily = await rows(
        sql,
        `select to_char(created_at at time zone '${TZ}','YYYY-MM-DD') d, model, provider,
                count(*)::int n, coalesce(sum(in_tokens),0) si, coalesce(sum(out_tokens),0) so,
                coalesce(sum(total_tokens),0) st
         from ${table} group by d, model, provider`,
      );
      for (const g of daily) {
        const d = String(g.d);
        const e = dayMap.get(d) ?? { tokens: 0, costUsd: 0, calls: 0 };
        e.calls += num(g.n); e.tokens += num(g.st);
        e.costUsd += priceCall({ provider: String(g.provider), model: String(g.model), inTokens: num(g.si), outTokens: num(g.so) });
        dayMap.set(d, e);
      }

      // ล่าสุด (ต่อฟีเจอร์ 40 แถว)
      const rec = await rows(
        sql,
        `select created_at, model, provider, in_tokens, out_tokens, total_tokens, label
         from ${table} order by created_at desc limit 40`,
      );
      for (const g of rec) {
        recentRaw.push({
          feature, createdAt: new Date(g.created_at as string).toISOString(),
          model: String(g.model), provider: String(g.provider),
          inTokens: num(g.in_tokens), outTokens: num(g.out_tokens), totalTokens: num(g.total_tokens),
          label: g.label == null ? null : String(g.label),
        });
      }
    }

    // ── louise_hay (แชท) — โครงเฉพาะ (classify/embed/gen) ──
    const lhGrp = await rows(
      sql,
      `select model, count(*)::int n,
              coalesce(sum(classify_in_tokens),0) ci, coalesce(sum(classify_out_tokens),0) co,
              coalesce(sum(embed_tokens),0) e, coalesce(sum(gen_in_tokens),0) gi,
              coalesce(sum(gen_out_tokens),0) go, coalesce(sum(total_tokens),0) st,
              count(*) filter (where used_own_key)::int own
       from louise_hay_usage group by model`,
    );
    {
      let calls = 0, tokens = 0, costUsd = 0;
      for (const g of lhGrp) {
        calls += num(g.n); tokens += num(g.st);
        // ต้นทุนของแถวที่ใช้คีย์ผู้ใช้เอง = 0 → ประมาณด้วยสัดส่วน (own/total)
        const systemRatio = num(g.n) > 0 ? (num(g.n) - num(g.own)) / num(g.n) : 1;
        costUsd += costUsdOf({
          model: String(g.model), classifyInTokens: num(g.ci), classifyOutTokens: num(g.co),
          embedTokens: num(g.e), genInTokens: num(g.gi), genOutTokens: num(g.go),
        }) * systemRatio;
      }
      if (calls > 0) byFeature.push({ feature: "louise_hay", label: FEATURE_LABEL.louise_hay, calls, tokens, costUsd, costThb: usdToThb(costUsd) });
    }

    const lhDaily = await rows(
      sql,
      `select to_char(created_at at time zone '${TZ}','YYYY-MM-DD') d, model, count(*)::int n,
              coalesce(sum(classify_in_tokens),0) ci, coalesce(sum(classify_out_tokens),0) co,
              coalesce(sum(embed_tokens),0) e, coalesce(sum(gen_in_tokens),0) gi,
              coalesce(sum(gen_out_tokens),0) go, coalesce(sum(total_tokens),0) st
       from louise_hay_usage group by d, model`,
    );
    for (const g of lhDaily) {
      const d = String(g.d);
      const e = dayMap.get(d) ?? { tokens: 0, costUsd: 0, calls: 0 };
      e.calls += num(g.n); e.tokens += num(g.st);
      e.costUsd += costUsdOf({
        model: String(g.model), classifyInTokens: num(g.ci), classifyOutTokens: num(g.co),
        embedTokens: num(g.e), genInTokens: num(g.gi), genOutTokens: num(g.go),
      });
      dayMap.set(d, e);
    }

    const lhRec = await rows(
      sql,
      `select created_at, model, (classify_in_tokens+embed_tokens+gen_in_tokens) it,
              (classify_out_tokens+gen_out_tokens) ot, total_tokens, question
       from louise_hay_usage order by created_at desc limit 40`,
    );
    for (const g of lhRec) {
      recentRaw.push({
        feature: "louise_hay", createdAt: new Date(g.created_at as string).toISOString(),
        model: String(g.model), provider: "gemini",
        inTokens: num(g.it), outTokens: num(g.ot), totalTokens: num(g.total_tokens),
        label: g.question == null ? null : String(g.question),
      });
    }

    // ── ผู้ใช้แชท (top 50 ตามจำนวนคำถาม) ──
    const usersRaw = await rows(
      sql,
      `select anon_id, count(*)::int q, max(created_at) last, model,
              coalesce(sum(classify_in_tokens),0) ci, coalesce(sum(classify_out_tokens),0) co,
              coalesce(sum(embed_tokens),0) e, coalesce(sum(gen_in_tokens),0) gi,
              coalesce(sum(gen_out_tokens),0) go
       from louise_hay_usage group by anon_id, model order by q desc limit 100`,
    );
    // รวมข้ามโมเดลต่อ user
    const userMap = new Map<string, { anonId: string; questions: number; costUsd: number; lastAt: string }>();
    for (const g of usersRaw) {
      const id = String(g.anon_id);
      const u = userMap.get(id) ?? { anonId: id, questions: 0, costUsd: 0, lastAt: new Date(0).toISOString() };
      u.questions += num(g.q);
      u.costUsd += costUsdOf({
        model: String(g.model), classifyInTokens: num(g.ci), classifyOutTokens: num(g.co),
        embedTokens: num(g.e), genInTokens: num(g.gi), genOutTokens: num(g.go),
      });
      const last = new Date(g.last as string).toISOString();
      if (last > u.lastAt) u.lastAt = last;
      userMap.set(id, u);
    }
    const chatUsers = [...userMap.values()].sort((a, b) => b.questions - a.questions).slice(0, 50);

    // จำนวนผู้ใช้แชททั้งหมด (distinct)
    const distinctUsers = num((await rows(sql, `select count(distinct anon_id)::int c from louise_hay_usage`))[0]?.c);

    // ── ประกอบผลลัพธ์ ──
    byFeature.sort((a, b) => b.costUsd - a.costUsd);
    const daily = [...dayMap.entries()]
      .map(([date, v]) => ({ date, tokens: v.tokens, costUsd: v.costUsd, calls: v.calls }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    const recent = recentRaw
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 200)
      .map((r) => ({
        feature: r.feature, featureLabel: FEATURE_LABEL[r.feature] ?? r.feature,
        createdAt: r.createdAt, model: r.model, provider: r.provider,
        inTokens: r.inTokens, outTokens: r.outTokens, totalTokens: r.totalTokens, label: r.label,
        // ต้นทุนต่อแถว (แชทคิดโดยประมาณจากโทเคนรวม × โมเดล gen — classify/embed เล็กมาก)
        costUsd: priceCall({ provider: r.provider, model: r.model, inTokens: r.inTokens, outTokens: r.outTokens }),
      }));

    const totalCostUsd = byFeature.reduce((s, f) => s + f.costUsd, 0);
    const totalCalls = byFeature.reduce((s, f) => s + f.calls, 0);
    const totalTokens = byFeature.reduce((s, f) => s + f.tokens, 0);

    return Response.json({
      usdToThb: USD_TO_THB,
      totals: {
        calls: totalCalls, tokens: totalTokens, costUsd: totalCostUsd,
        costThb: usdToThb(totalCostUsd), features: byFeature.length, chatUsers: distinctUsers,
      },
      byFeature, daily, recent, chatUsers,
    });
  } catch (error) {
    console.error("[stats] aggregate failed:", error);
    return Response.json({
      usdToThb: USD_TO_THB,
      totals: { calls: 0, tokens: 0, costUsd: 0, costThb: 0, features: 0, chatUsers: 0 },
      byFeature: [], daily: [], recent: [], chatUsers: [],
    });
  }
}
