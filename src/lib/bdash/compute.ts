// bdash — คำนวณตัวเลขทั้งห้าจากตารางที่มีอยู่แล้ว (อ่านอย่างเดียว) · เรียกจาก /api/cron/bdash-snapshot วันละครั้ง.
// วันทั้งหมดเป็นวันไทย (Asia/Bangkok). query เรียงทีละตัว (ไม่ยิงพร้อมกัน) เพื่อไม่แย่ง connection ของสมาชิก.
import { sql, type SQL } from "drizzle-orm";

import type { createDbClient } from "@/db/client";

import { addDays, fillQiDays, priceAi, shapeCohorts, shapePayments, type AiSqlRow, type CohortSqlRow, type PaymentSqlRow, type QiSqlRow } from "./shape";
import { BDASH_RETENTION_FROM, type BdashSnapshot } from "./types";

export const rowsOf = <T>(r: unknown): T[] => (Array.isArray(r) ? r : ((r as { rows?: unknown[] })?.rows ?? [])) as T[];

/** เที่ยงคืนไทยของวันนั้น เป็น timestamptz — ใช้ตัดช่วงบนคอลัมน์ created_at ให้ใช้ index ได้ */
export const bkkStart = (day: string): SQL => sql`(${day}::date::timestamp AT TIME ZONE 'Asia/Bangkok')`;
export const bkkDay = (col: SQL): SQL => sql`((${col}) AT TIME ZONE 'Asia/Bangkok')::date`;

/**
 * "วันที่มาใช้" ต่อคน = วันที่ระบบบันทึกการกระทำของคนนั้นไว้: ภารกิจ, ได้/ใช้ QI, รับ QI, แชร์, เปิดหน้าจ่าย, จ่าย,
 * check-in manifest, ใช้คูปองรางวัล. การเปิดแอปเฉยๆ ไม่มีบันทึก (owner 2026-10-13: นับแบบนี้และบอกบนหน้า).
 * qi:ops (ทีมแจกเอง) และ coins:migrate (ย้ายระบบ) ไม่ใช่การกระทำของสมาชิก จึงไม่นับ.
 */
export function activity(from: string, toExclusive: string): SQL {
  const a = bkkStart(from);
  const b = bkkStart(toExclusive);
  return sql`
    SELECT anon_id AS uid, ${bkkDay(sql`created_at`)} AS d FROM bazi_ledger_txn
     WHERE created_at >= ${a} AND created_at < ${b} AND reason NOT LIKE 'qi:ops%' AND reason NOT LIKE 'coins:migrate%'
    UNION ALL SELECT anon_id, ${bkkDay(sql`updated_at`)} FROM bazi_mission_progress WHERE updated_at >= ${a} AND updated_at < ${b}
    UNION ALL SELECT anon_id, ${bkkDay(sql`created_at`)} FROM bazi_qi_claim WHERE created_at >= ${a} AND created_at < ${b}
    UNION ALL SELECT user_id, ${bkkDay(sql`created_at`)} FROM share_snapshot WHERE created_at >= ${a} AND created_at < ${b}
    UNION ALL SELECT user_id, ${bkkDay(sql`created_at`)} FROM payment_quote WHERE created_at >= ${a} AND created_at < ${b}
    UNION ALL SELECT user_id, ${bkkDay(sql`created_at`)} FROM v2_payment WHERE created_at >= ${a} AND created_at < ${b}
    UNION ALL SELECT anon_id, ${bkkDay(sql`created_at`)} FROM bazi_manifest_checkin WHERE created_at >= ${a} AND created_at < ${b}
    UNION ALL SELECT anon_id, ${bkkDay(sql`redeemed_at`)} FROM activity_coupon_redemption WHERE redeemed_at >= ${a} AND redeemed_at < ${b}`;
}

/** ตาราง log การเรียก AI ที่ใช้โครงคอลัมน์เดียวกัน (llmUsageColumns) + ชื่อที่ทีมอ่านเข้าใจ (ชุดเดียวกับ /api/ops/analytics) */
export const AI_TABLES: ReadonlyArray<readonly [table: string, label: string]> = [
  ["open_webui_usage", "แชต"],
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
  ["pair_rephrase_usage", "งานหลังบ้าน (ปรับคำ)"],
  ["reading_draft_usage", "งานหลังบ้าน (ร่างคำทำนาย)"],
];

export const LOUISE_HAY_LABEL = "ถามหลุยส์ เฮย์";

export type Db = ReturnType<typeof createDbClient>;
/** อะไรก็ได้ที่ยิง SQL ได้ — db, transaction หรือตัววัดเวลาของ live.ts */
export type Exec = { execute: (q: SQL) => PromiseLike<unknown> };

/** กลุ่มคนที่สมัครสัปดาห์เดียวกัน (สมัครตั้งแต่ BDASH_RETENTION_FROM ถึง asOf): กลับมาใช้ (วันถัดไป / สัปดาห์ที่ 2 / 1 เดือนต่อมา) และจ่ายภายใน 35 วัน */
export async function queryCohorts(db: Exec, asOf: string): Promise<CohortSqlRow[]> {
  const dayAfter = addDays(asOf, 1);
  // "user".create_at เป็นข้อความเวลาไทย "YYYY-MM-DD HH:MI:SS" (วัดแล้ว: ถ้าอ่านเป็น UTC จะคลาดพอดี 7 ชม.).
  const rows = await db.execute(sql`
    WITH act AS (
      SELECT DISTINCT uid, d FROM (${activity(BDASH_RETENTION_FROM, dayAfter)}) x WHERE uid IS NOT NULL
    ),
    s AS (
      SELECT uid, d0 FROM (
        SELECT user_id AS uid, CASE WHEN create_at ~ '^\\d{4}-\\d\\d-\\d\\d' THEN (create_at::timestamp)::date END AS d0 FROM "user"
      ) u WHERE d0 BETWEEN ${BDASH_RETENTION_FROM}::date AND ${asOf}::date
    ),
    f AS (
      SELECT s.uid, s.d0,
             coalesce(bool_or(a.d = s.d0 + 1), false) AS d1,
             coalesce(bool_or(a.d BETWEEN s.d0 + 7 AND s.d0 + 13), false) AS d7,
             coalesce(bool_or(a.d BETWEEN s.d0 + 30 AND s.d0 + 36), false) AS d30
        FROM s LEFT JOIN act a ON a.uid = s.uid AND a.d > s.d0
       GROUP BY s.uid, s.d0
    ),
    p AS (
      SELECT user_id AS uid, min(${bkkDay(sql`created_at`)}) AS first_paid
        FROM v2_payment WHERE status = 'APPROVED' AND created_at < ${bkkStart(dayAfter)} GROUP BY 1
    )
    SELECT to_char(date_trunc('week', f.d0), 'YYYY-MM-DD') AS week, count(*) AS signups,
           count(*) FILTER (WHERE f.d1) AS d1, count(*) FILTER (WHERE f.d7) AS d7, count(*) FILTER (WHERE f.d30) AS d30,
           count(*) FILTER (WHERE p.first_paid BETWEEN f.d0 AND f.d0 + 35) AS paid35,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY p.first_paid - f.d0) FILTER (WHERE p.first_paid BETWEEN f.d0 AND f.d0 + 35) AS median_days
      FROM f LEFT JOIN p ON p.uid = f.uid
     GROUP BY 1 ORDER BY 1`);
  return rowsOf<CohortSqlRow>(rows);
}

/** กดจ่ายแล้วติดตรงไหน — แยกวิธีจ่าย × ผู้รับเงิน. หมดเวลา = status EXPIRED หรือ REJECT ด้วย code หมดเวลา. */
export async function queryPayments(db: Exec, from: string, to: string): Promise<PaymentSqlRow[]> {
  const rows = await db.execute(sql`
    WITH v AS (
      SELECT method, gateway, status, failure_code,
             (status = 'EXPIRED' OR (status = 'REJECT' AND failure_code IN ('gateway_expired', 'expired'))) AS is_expired
        FROM v2_payment WHERE created_at >= ${bkkStart(from)} AND created_at < ${bkkStart(addDays(to, 1))}
    )
    SELECT method, gateway, count(*) AS created,
           count(*) FILTER (WHERE status = 'APPROVED') AS approved,
           count(*) FILTER (WHERE status NOT IN ('APPROVED', 'PENDING') AND NOT is_expired) AS rejected,
           count(*) FILTER (WHERE is_expired) AS expired,
           count(*) FILTER (WHERE status = 'PENDING') AS waiting,
           mode() WITHIN GROUP (ORDER BY coalesce(failure_code, CASE WHEN status = 'EXPIRED' THEN 'expired' ELSE 'unknown' END))
             FILTER (WHERE status NOT IN ('APPROVED', 'PENDING')) AS top_failure
      FROM v GROUP BY 1, 2`);
  return rowsOf<PaymentSqlRow>(rows);
}

/** QI เข้า/ออกต่อวัน แยกที่มา */
export async function queryQiDays(db: Exec, from: string, to: string): Promise<QiSqlRow[]> {
  const rows = await db.execute(sql`
    SELECT to_char(${bkkDay(sql`created_at`)}, 'YYYY-MM-DD') AS day,
           coalesce(sum(qi_delta) FILTER (WHERE reason LIKE 'qi:buy%' AND qi_delta > 0), 0) AS buy,
           coalesce(sum(qi_delta) FILTER (WHERE reason LIKE 'mission:%' AND qi_delta > 0), 0) AS missions,
           coalesce(sum(qi_delta) FILTER (WHERE reason LIKE 'qi:earn%' AND qi_delta > 0), 0) AS daily,
           coalesce(sum(qi_delta) FILTER (WHERE reason LIKE 'referral%' AND qi_delta > 0), 0) AS referral,
           coalesce(sum(qi_delta) FILTER (WHERE reason LIKE 'qi:ops%'), 0) AS team,
           coalesce(sum(qi_delta) FILTER (WHERE qi_delta > 0 AND reason NOT LIKE 'qi:buy%' AND reason NOT LIKE 'mission:%'
                                            AND reason NOT LIKE 'qi:earn%' AND reason NOT LIKE 'referral%' AND reason NOT LIKE 'qi:ops%'
                                            AND reason NOT LIKE 'qi:refund%'), 0) AS other,
           -- คืน QI (qi:refund) = การใช้ที่ถูกยกเลิก จึงหักออกจากยอดใช้ ไม่นับเป็นการแจก
           coalesce(-sum(qi_delta) FILTER (WHERE qi_delta < 0 AND reason NOT LIKE 'qi:ops%'), 0)
             - coalesce(sum(qi_delta) FILTER (WHERE reason LIKE 'qi:refund%' AND qi_delta > 0), 0) AS spend
      FROM bazi_ledger_txn
     WHERE qi_delta <> 0 AND created_at >= ${bkkStart(from)} AND created_at < ${bkkStart(addDays(to, 1))}
     GROUP BY 1`);
  return rowsOf<QiSqlRow>(rows);
}

/** การถือ QI ของสมาชิกตอนนี้ */
export async function queryQiBalance(db: Exec): Promise<{ holders: number; median: number; p90: number }> {
  const balance = rowsOf<{ holders: unknown; median: unknown; p90: unknown }>(
    await db.execute(sql`
      SELECT count(*) AS holders,
             coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY qi), 0) AS median,
             coalesce(percentile_cont(0.9) WITHIN GROUP (ORDER BY qi), 0) AS p90
        FROM bazi_wallet WHERE qi > 0`),
  )[0];
  return {
    holders: Number(balance?.holders ?? 0),
    median: Math.round(Number(balance?.median ?? 0)),
    p90: Math.round(Number(balance?.p90 ?? 0)),
  };
}

/** จำนวนคนที่ระบบบันทึกการกระทำไว้ในช่วงนี้ (ตัวหารของ "ค่า AI ต่อคนที่ใช้งาน") */
export async function queryActiveMembers(db: Exec, from: string, to: string): Promise<number> {
  const active = rowsOf<{ members: unknown }>(
    await db.execute(sql`SELECT count(DISTINCT uid) AS members FROM (${activity(from, addDays(to, 1))}) x WHERE uid IS NOT NULL`),
  )[0];
  return Number(active?.members ?? 0);
}

/** ค่า AI — log ส่วนใหญ่ไม่ได้บอกว่าใครเรียก จนถึง mumate-bdash-v2-001 slice 1 (owner 2026-10-13: โชว์รวม/ต่อฟีเจอร์) */
export async function queryAi(db: Exec, from: string, to: string): Promise<AiSqlRow[]> {
  const window = sql`created_at >= ${bkkStart(from)} AND created_at < ${bkkStart(addDays(to, 1))} AND NOT used_own_key`;
  const aiParts = AI_TABLES.map(
    ([table, label]) => sql`
      SELECT ${label}::text AS feature, provider, model, count(*) AS calls, coalesce(sum(in_tokens), 0) AS tin, coalesce(sum(out_tokens), 0) AS tout
        FROM ${sql.identifier(table)} WHERE ${window} GROUP BY 2, 3`,
  );
  aiParts.push(sql`
    SELECT ${LOUISE_HAY_LABEL}::text AS feature, 'gemini' AS provider, model, count(*) AS calls,
           coalesce(sum(classify_in_tokens + gen_in_tokens), 0) AS tin, coalesce(sum(classify_out_tokens + gen_out_tokens), 0) AS tout
      FROM louise_hay_usage WHERE ${window} GROUP BY 3`);
  return rowsOf<AiSqlRow>(await db.execute(sql.join(aiParts, sql` UNION ALL `)));
}

export async function computeBdashSnapshot(db: Db, asOf: string): Promise<BdashSnapshot> {
  const from30 = addDays(asOf, -29);
  const from28 = addDays(asOf, -27);
  // query เรียงทีละตัว (ไม่ยิงพร้อมกัน) เพื่อไม่แย่ง connection ของสมาชิก
  const cohorts = await queryCohorts(db, asOf);
  const payments = await queryPayments(db, from30, asOf);
  const qi = await queryQiDays(db, from28, asOf);
  const qiBalance = await queryQiBalance(db);
  const ai = await queryAi(db, from30, asOf);
  const activeMembers = await queryActiveMembers(db, from30, asOf);

  return {
    version: 1,
    asOf,
    retentionFrom: BDASH_RETENTION_FROM,
    cohorts: shapeCohorts(cohorts, asOf),
    payments: shapePayments(payments),
    qiDaily: fillQiDays(qi, asOf),
    qiBalance,
    ai: { ...priceAi(ai), activeMembers },
  };
}
