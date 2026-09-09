import { sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";

export const runtime = "nodejs";

/**
 * /api/ops/analytics — สรุปฝั่ง engine สำหรับหน้า analytics /ops: เศรษฐกิจ QI + metadata แชท.
 * secret-gated header x-ops-secret === OPS_ADMIN_SECRET. อ่านอย่างเดียว. ?days=30 (ช่วงย้อนหลัง)
 */
export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret || request.headers.get("x-ops-secret") !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const days = Math.min(365, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));

  try {
    const db = createDbClient();
    // QI economy: รวม qi_delta แยกตามหมวดของ reason (earn/spend/buy/ops/refund) ในช่วง N วัน
    const qi = await db.execute(sql`
      SELECT split_part(reason, ':', 2) AS category,
             COUNT(*)::int AS txns,
             COALESCE(SUM(GREATEST(qi_delta, 0)), 0)::int AS qi_in,
             COALESCE(SUM(LEAST(qi_delta, 0)), 0)::int AS qi_out
        FROM bazi_ledger_txn
       WHERE qi_delta <> 0 AND created_at >= now() - (${days} || ' days')::interval
       GROUP BY 1 ORDER BY txns DESC`);
    // Chat metadata: ปริมาณรวม + แยก persona + หัวข้อยอดฮิต
    const chatByPersona = await db.execute(sql`
      SELECT COALESCE(persona, 'unknown') AS persona, COUNT(*)::int AS replies
        FROM mate_ai_chat_meta
       WHERE created_at >= now() - (${days} || ' days')::interval
       GROUP BY 1 ORDER BY replies DESC`);
    const chatTopTopics = await db.execute(sql`
      SELECT COALESCE(topic_id, 'unknown') AS topic_id, COUNT(*)::int AS replies
        FROM mate_ai_chat_meta
       WHERE created_at >= now() - (${days} || ' days')::interval
       GROUP BY 1 ORDER BY replies DESC LIMIT 15`);
    const rowsOf = (r: unknown) => (Array.isArray(r) ? r : ((r as { rows?: unknown[] })?.rows ?? []));

    return Response.json(
      { days, qiEconomy: rowsOf(qi), chat: { byPersona: rowsOf(chatByPersona), topTopics: rowsOf(chatTopTopics) } },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analytics error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
