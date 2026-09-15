import { sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";

export const runtime = "nodejs";
// query หลายชุด (sequential เพราะ postgres max:1 — parallel จะ hang) + สแกน DB ใหญ่ → ให้เวลามากขึ้น กัน timeout
export const maxDuration = 30;

/**
 * /api/ops/analytics — สรุปฝั่ง engine สำหรับหน้า analytics /ops (อ่านอย่างเดียว):
 *   DAU (คนใช้/วัน) · การใช้แยกฟีเจอร์ · รายรับ฿ (v2_payment) · QI economy · หัวข้อแชท.
 * secret-gated header x-ops-secret === OPS_ADMIN_SECRET. ?days=30 (ช่วงย้อนหลัง, 1-365).
 */

// ตาราง usage ต่อฟีเจอร์ (llmUsageColumns: anon_id + created_at) → ใช้ทำ DAU + "ใช้อะไรบ้าง".
// ป้ายชื่อไทยเพื่อโชว์บนหน้า /ops (เฉพาะฟีเจอร์ฝั่งผู้ใช้ — ไม่รวม draft/rephrase ที่เป็นงานหลังบ้าน).
const FEATURE_TABLES: Array<[table: string, label: string]> = [
  ["reading_topic_usage", "อ่านดวง (ต่อบท)"],
  ["divine_cards_usage", "ไพ่เทวะ"],
  ["oracle_cards_usage", "ไพ่ออราเคิล"],
  ["fortune_sage_usage", "เซียมซี"],
  ["phone_reading_usage", "ทำนายเบอร์"],
  ["honeycomb_usage", "เบอร์รังผึ้ง"],
  ["manifest_insights_usage", "มานิเฟส"],
  ["what_if_usage", "What-if"],
  ["almanac_usage", "ปฏิทิน/ฤกษ์"],
  ["man_vs_day_usage", "ดวงรายวัน"],
  ["reaction_chamber_usage", "ห้องปฏิกิริยา"],
  ["open_webui_usage", "แชท (open-webui)"],
];

const rowsOf = (r: unknown) => (Array.isArray(r) ? r : ((r as { rows?: unknown[] })?.rows ?? []));

export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || request.headers.get("x-ops-secret") !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const days = Math.min(365, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));
  const since = `now() - (${days} || ' days')::interval`;

  try {
    const db = createDbClient();

    // DAU: รวม (anon_id, วัน BKK) จากทุกตาราง usage + แชท แล้วนับคนไม่ซ้ำต่อวัน
    const dauUnion = [
      ...FEATURE_TABLES.map(([t]) => `SELECT anon_id, (created_at AT TIME ZONE 'Asia/Bangkok')::date AS d FROM ${t} WHERE anon_id IS NOT NULL AND created_at >= ${since}`),
      `SELECT anon_id, (created_at AT TIME ZONE 'Asia/Bangkok')::date AS d FROM mate_ai_chat_meta WHERE anon_id IS NOT NULL AND created_at >= ${since}`,
    ].join(" UNION ALL ");
    const dauByDay = await db.execute(sql.raw(`SELECT to_char(d,'YYYY-MM-DD') AS day, COUNT(DISTINCT anon_id)::int AS users FROM (${dauUnion}) u GROUP BY d ORDER BY d`));
    const dauTotal = await db.execute(sql.raw(`SELECT COUNT(DISTINCT anon_id)::int AS users FROM (${dauUnion}) u`));

    // ใช้อะไรบ้าง: จำนวนครั้ง + คนไม่ซ้ำ ต่อฟีเจอร์ (รวมแชทจาก mate_ai_chat_meta)
    const featUnion = [
      ...FEATURE_TABLES.map(([t, label]) => `SELECT '${label}' AS feature, COUNT(*)::int AS uses, COUNT(DISTINCT anon_id)::int AS users FROM ${t} WHERE created_at >= ${since}`),
      `SELECT 'แชท Mate AI' AS feature, COUNT(*)::int AS uses, COUNT(DISTINCT anon_id)::int AS users FROM mate_ai_chat_meta WHERE created_at >= ${since}`,
    ].join(" UNION ALL ");
    const features = await db.execute(sql.raw(`SELECT * FROM (${featUnion}) f WHERE uses > 0 ORDER BY uses DESC`));

    // รายรับ฿ (v2_payment APPROVED): รวม + ต่อวัน + แยกแพ็ก (amount_satang → บาท)
    const revTotal = await db.execute(sql`
      SELECT COUNT(*)::int AS orders, COALESCE(ROUND(SUM(amount_satang) / 100.0, 2), 0) AS baht
        FROM v2_payment WHERE status = 'APPROVED' AND created_at >= now() - (${days} || ' days')::interval`);
    const revByDay = await db.execute(sql`
      SELECT to_char((created_at AT TIME ZONE 'Asia/Bangkok')::date, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS orders, ROUND(SUM(amount_satang) / 100.0, 2) AS baht
        FROM v2_payment WHERE status = 'APPROVED' AND created_at >= now() - (${days} || ' days')::interval
       GROUP BY 1 ORDER BY 1`);
    const revByPackage = await db.execute(sql`
      SELECT package_code, COUNT(*)::int AS orders, ROUND(SUM(amount_satang) / 100.0, 2) AS baht
        FROM v2_payment WHERE status = 'APPROVED' AND created_at >= now() - (${days} || ' days')::interval
       GROUP BY 1 ORDER BY baht DESC`);

    // ส่วนลด/คูปองที่ใช้: discount_redemption (฿ ส่วนลดที่ให้ไป + แยกโค้ด) + activity_coupon (คูปองรางวัล)
    const discountTotal = await db.execute(sql`
      SELECT COUNT(*)::int AS uses, COALESCE(ROUND(SUM(discount_satang) / 100.0, 2), 0) AS baht, COUNT(DISTINCT user_id)::int AS users
        FROM discount_redemption WHERE redeemed_at >= now() - (${days} || ' days')::interval`);
    const discountByCode = await db.execute(sql`
      SELECT dc.code, COUNT(*)::int AS uses, ROUND(SUM(r.discount_satang) / 100.0, 2) AS baht
        FROM discount_redemption r JOIN discount_code dc ON dc.id = r.code_id
       WHERE r.redeemed_at >= now() - (${days} || ' days')::interval
       GROUP BY dc.code ORDER BY baht DESC`);
    const rewardRedeemed = await db.execute(sql`
      SELECT COUNT(*)::int AS uses, COUNT(DISTINCT anon_id)::int AS users
        FROM activity_coupon_redemption WHERE redeemed_at >= now() - (${days} || ' days')::interval`);

    // กดแชร์อะไรกี่คน: share_snapshot (tag = แชร์อะไร, user_id = คน)
    const shareTotal = await db.execute(sql`
      SELECT COUNT(*)::int AS shares, COUNT(DISTINCT user_id)::int AS users
        FROM share_snapshot WHERE created_at >= now() - (${days} || ' days')::interval`);
    const shareByTag = await db.execute(sql`
      SELECT COALESCE(NULLIF(tag, ''), '—') AS tag, COUNT(*)::int AS shares, COUNT(DISTINCT user_id)::int AS users
        FROM share_snapshot WHERE created_at >= now() - (${days} || ' days')::interval
       GROUP BY 1 ORDER BY shares DESC`);

    // QI economy (เดิม): รวม qi_delta แยกหมวดของ reason
    const qi = await db.execute(sql`
      SELECT split_part(reason, ':', 2) AS category, COUNT(*)::int AS txns,
             COALESCE(SUM(GREATEST(qi_delta, 0)), 0)::int AS qi_in,
             COALESCE(SUM(LEAST(qi_delta, 0)), 0)::int AS qi_out
        FROM bazi_ledger_txn
       WHERE qi_delta <> 0 AND created_at >= now() - (${days} || ' days')::interval
       GROUP BY 1 ORDER BY txns DESC`);

    // ถามอะไรบ้าง (แชท, PDPA-safe: หัวข้อ ไม่ใช่ข้อความ)
    const chatByPersona = await db.execute(sql`
      SELECT COALESCE(persona, 'unknown') AS persona, COUNT(*)::int AS replies
        FROM mate_ai_chat_meta WHERE created_at >= now() - (${days} || ' days')::interval
       GROUP BY 1 ORDER BY replies DESC`);
    const chatTopTopics = await db.execute(sql`
      SELECT COALESCE(topic_id, 'unknown') AS topic_id, COUNT(*)::int AS replies
        FROM mate_ai_chat_meta WHERE created_at >= now() - (${days} || ' days')::interval
       GROUP BY 1 ORDER BY replies DESC LIMIT 15`);

    return Response.json(
      {
        days,
        dau: { total: (rowsOf(dauTotal)[0] as { users?: number })?.users ?? 0, byDay: rowsOf(dauByDay) },
        features: rowsOf(features),
        revenue: { total: rowsOf(revTotal)[0] ?? { orders: 0, baht: 0 }, byDay: rowsOf(revByDay), byPackage: rowsOf(revByPackage) },
        coupons: {
          discount: { total: rowsOf(discountTotal)[0] ?? { uses: 0, baht: 0, users: 0 }, byCode: rowsOf(discountByCode) },
          reward: rowsOf(rewardRedeemed)[0] ?? { uses: 0, users: 0 },
        },
        shares: { total: rowsOf(shareTotal)[0] ?? { shares: 0, users: 0 }, byTag: rowsOf(shareByTag) },
        qiEconomy: rowsOf(qi),
        chat: { byPersona: rowsOf(chatByPersona), topTopics: rowsOf(chatTopTopics) },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analytics error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
