/**
 * สถิติ + ต้นทุน LLM รวมทุกฟีเจอร์ (แดชบอร์ด /stats).
 * รวมด้วย SQL (SUM / COUNT / GROUP BY) ที่ฝั่ง DB → ถูกต้อง+เร็วแม้เป็นล้านแถว (ไม่ดึงแถวดิบมา JS).
 * รับช่วงวันผ่าน ?from=ISO&to=ISO (ดีฟอลต์ 30 วันล่าสุด) — กรองทุกส่วนด้วย created_at.
 * กราฟรายช่วง: ช่วง ≤ 2 วัน = bucket รายชั่วโมง, มากกว่านั้น = รายวัน.
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

const FEATURE_TABLE: Record<string, string> = {
  reading_topic: "reading_topic_usage",
  divine_cards: "divine_cards_usage",
  oracle_cards: "oracle_cards_usage",
  honeycomb: "honeycomb_usage",
  pair_rephrase: "pair_rephrase_usage",
  reading_draft: "reading_draft_usage",
};

const TZ = "Asia/Bangkok";
const DAY_MS = 86_400_000;
const num = (v: unknown) => Number(v ?? 0);

type Row = Record<string, unknown>;
async function rows(sql: ReturnType<typeof createDbSqlClient>, text: string, params: unknown[]): Promise<Row[]> {
  const r = await sql.query(text, params);
  return (Array.isArray(r) ? r : ((r as { rows?: Row[] }).rows ?? [])) as Row[];
}

function parseRange(req: Request): { from: string; to: string; bucket: "hour" | "day" } {
  const u = new URL(req.url);
  const now = Date.now();
  const parse = (s: string | null, fallback: number) => {
    const t = s ? Date.parse(s) : NaN;
    return Number.isFinite(t) ? t : fallback;
  };
  const toMs = parse(u.searchParams.get("to"), now);
  const fromMs = parse(u.searchParams.get("from"), toMs - 30 * DAY_MS);
  const lo = Math.min(fromMs, toMs);
  const hi = Math.max(fromMs, toMs);
  const bucket = hi - lo <= 2 * DAY_MS ? "hour" : "day";
  return { from: new Date(lo).toISOString(), to: new Date(hi).toISOString(), bucket };
}

export async function GET(req: Request) {
  const sql = createDbSqlClient();
  const { from, to, bucket } = parseRange(req);
  const p = [from, to];
  const WHERE = "where created_at >= $1 and created_at < $2";
  const bucketFmt = bucket === "hour" ? `YYYY-MM-DD"T"HH24:00` : "YYYY-MM-DD";

  try {
    const byFeature: { feature: string; label: string; calls: number; tokens: number; costUsd: number; costThb: number }[] = [];
    const dayMap = new Map<string, { tokens: number; costUsd: number; calls: number }>();
    const recentRaw: {
      feature: string; createdAt: string; model: string; provider: string;
      inTokens: number; outTokens: number; totalTokens: number; label: string | null;
    }[] = [];

    // ── ฟีเจอร์ทั่วไป (6 ตาราง) ──
    for (const [feature, table] of Object.entries(FEATURE_TABLE)) {
      const grp = await rows(
        sql,
        `select model, provider, count(*)::int n, coalesce(sum(in_tokens),0) si,
                coalesce(sum(out_tokens),0) so, coalesce(sum(total_tokens),0) st
         from ${table} ${WHERE} group by model, provider`,
        p,
      );
      let calls = 0, tokens = 0, costUsd = 0;
      for (const g of grp) {
        calls += num(g.n); tokens += num(g.st);
        costUsd += priceCall({ provider: String(g.provider), model: String(g.model), inTokens: num(g.si), outTokens: num(g.so) });
      }
      if (calls > 0) byFeature.push({ feature, label: FEATURE_LABEL[feature], calls, tokens, costUsd, costThb: usdToThb(costUsd) });

      const series = await rows(
        sql,
        `select to_char(created_at at time zone '${TZ}','${bucketFmt}') d, model, provider,
                count(*)::int n, coalesce(sum(in_tokens),0) si, coalesce(sum(out_tokens),0) so,
                coalesce(sum(total_tokens),0) st
         from ${table} ${WHERE} group by d, model, provider`,
        p,
      );
      for (const g of series) {
        const d = String(g.d);
        const e = dayMap.get(d) ?? { tokens: 0, costUsd: 0, calls: 0 };
        e.calls += num(g.n); e.tokens += num(g.st);
        e.costUsd += priceCall({ provider: String(g.provider), model: String(g.model), inTokens: num(g.si), outTokens: num(g.so) });
        dayMap.set(d, e);
      }

      const rec = await rows(
        sql,
        `select created_at, model, provider, in_tokens, out_tokens, total_tokens, label
         from ${table} ${WHERE} order by created_at desc limit 40`,
        p,
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

    // ── louise_hay (แชท) ──
    const lhGrp = await rows(
      sql,
      `select model, count(*)::int n,
              coalesce(sum(classify_in_tokens),0) ci, coalesce(sum(classify_out_tokens),0) co,
              coalesce(sum(embed_tokens),0) e, coalesce(sum(gen_in_tokens),0) gi,
              coalesce(sum(gen_out_tokens),0) go, coalesce(sum(total_tokens),0) st,
              count(*) filter (where used_own_key)::int own
       from louise_hay_usage ${WHERE} group by model`,
      p,
    );
    let chatCompare: {
      calls: number; flashThb: number; flashLiteThb: number; savedThb: number; savedPct: number; currentModel: string;
    } | null = null;
    {
      let calls = 0, tokens = 0, costUsd = 0;
      // รวมโทเคนแชททั้งหมด (ทุกโมเดล) ไว้ reprice เทียบ flash vs flash-lite
      let sCi = 0, sCo = 0, sE = 0, sGi = 0, sGo = 0;
      for (const g of lhGrp) {
        calls += num(g.n); tokens += num(g.st);
        sCi += num(g.ci); sCo += num(g.co); sE += num(g.e); sGi += num(g.gi); sGo += num(g.go);
        const systemRatio = num(g.n) > 0 ? (num(g.n) - num(g.own)) / num(g.n) : 1;
        costUsd += costUsdOf({
          model: String(g.model), classifyInTokens: num(g.ci), classifyOutTokens: num(g.co),
          embedTokens: num(g.e), genInTokens: num(g.gi), genOutTokens: num(g.go),
        }) * systemRatio;
      }
      if (calls > 0) {
        byFeature.push({ feature: "louise_hay", label: FEATURE_LABEL.louise_hay, calls, tokens, costUsd, costThb: usdToThb(costUsd) });
        // เทียบต้นทุนแชทเดียวกัน (โทเคนเท่ากัน) ระหว่าง gen = flash vs flash-lite
        const chatTok = { classifyInTokens: sCi, classifyOutTokens: sCo, embedTokens: sE, genInTokens: sGi, genOutTokens: sGo };
        const flashUsd = costUsdOf({ model: "gemini-2.5-flash", ...chatTok });
        const liteUsd = costUsdOf({ model: "gemini-2.5-flash-lite", ...chatTok });
        chatCompare = {
          calls,
          flashThb: usdToThb(flashUsd),
          flashLiteThb: usdToThb(liteUsd),
          savedThb: usdToThb(flashUsd - liteUsd),
          savedPct: flashUsd > 0 ? ((flashUsd - liteUsd) / flashUsd) * 100 : 0,
          currentModel: "gemini-2.5-flash-lite",
        };
      }
    }

    const lhSeries = await rows(
      sql,
      `select to_char(created_at at time zone '${TZ}','${bucketFmt}') d, model, count(*)::int n,
              coalesce(sum(classify_in_tokens),0) ci, coalesce(sum(classify_out_tokens),0) co,
              coalesce(sum(embed_tokens),0) e, coalesce(sum(gen_in_tokens),0) gi,
              coalesce(sum(gen_out_tokens),0) go, coalesce(sum(total_tokens),0) st
       from louise_hay_usage ${WHERE} group by d, model`,
      p,
    );
    for (const g of lhSeries) {
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
       from louise_hay_usage ${WHERE} order by created_at desc limit 40`,
      p,
    );
    for (const g of lhRec) {
      recentRaw.push({
        feature: "louise_hay", createdAt: new Date(g.created_at as string).toISOString(),
        model: String(g.model), provider: "gemini",
        inTokens: num(g.it), outTokens: num(g.ot), totalTokens: num(g.total_tokens),
        label: g.question == null ? null : String(g.question),
      });
    }

    // ── ผู้ใช้แชท (top ตามจำนวนคำถาม) ──
    const usersRaw = await rows(
      sql,
      `select anon_id, count(*)::int q, max(created_at) last, model,
              coalesce(sum(classify_in_tokens),0) ci, coalesce(sum(classify_out_tokens),0) co,
              coalesce(sum(embed_tokens),0) e, coalesce(sum(gen_in_tokens),0) gi,
              coalesce(sum(gen_out_tokens),0) go
       from louise_hay_usage ${WHERE} group by anon_id, model order by q desc limit 100`,
      p,
    );
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

    const distinctUsers = num(
      (await rows(sql, `select count(distinct anon_id)::int c from louise_hay_usage ${WHERE}`, p))[0]?.c,
    );

    // ── ประกอบผลลัพธ์ ──
    byFeature.sort((a, b) => b.costUsd - a.costUsd);
    const daily = [...dayMap.entries()]
      .map(([date, v]) => ({ date, tokens: v.tokens, costUsd: v.costUsd, calls: v.calls }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const recent = recentRaw
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 200)
      .map((r) => ({
        feature: r.feature, featureLabel: FEATURE_LABEL[r.feature] ?? r.feature,
        createdAt: r.createdAt, model: r.model, provider: r.provider,
        inTokens: r.inTokens, outTokens: r.outTokens, totalTokens: r.totalTokens, label: r.label,
        costUsd: priceCall({ provider: r.provider, model: r.model, inTokens: r.inTokens, outTokens: r.outTokens }),
      }));

    const totalCostUsd = byFeature.reduce((s, f) => s + f.costUsd, 0);
    const totalCalls = byFeature.reduce((s, f) => s + f.calls, 0);
    const totalTokens = byFeature.reduce((s, f) => s + f.tokens, 0);

    return Response.json({
      usdToThb: USD_TO_THB,
      range: { from, to, bucket },
      totals: {
        calls: totalCalls, tokens: totalTokens, costUsd: totalCostUsd,
        costThb: usdToThb(totalCostUsd), features: byFeature.length, chatUsers: distinctUsers,
      },
      byFeature, daily, recent, chatUsers, chatCompare,
    });
  } catch (error) {
    console.error("[stats] aggregate failed:", error);
    return Response.json({
      usdToThb: USD_TO_THB,
      range: { from, to, bucket },
      totals: { calls: 0, tokens: 0, costUsd: 0, costThb: 0, features: 0, chatUsers: 0 },
      byFeature: [], daily: [], recent: [], chatUsers: [], chatCompare: null,
    });
  }
}
