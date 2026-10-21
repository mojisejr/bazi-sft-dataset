// bdash การ์ด C (mumate-bdash-v2-001 slice 2): ฟีเจอร์ละแถว — คนใช้, ใช้กี่ครั้ง (ต่อคน), กี่ % ของคนเหล่านั้นเคยจ่ายเงิน,
// ค่า AI — และกราฟความเคลื่อนไหวที่สลับดู คนใช้ / ค่า AI / % เป็นลูกค้า. "คนใช้" = คนที่ระบบบันทึกว่าใช้จริง (log การเรียก AI
// ที่มี member id ตั้งแต่ slice 1) ไม่ใช่การเปิดหน้า. member id ใช้นับในเซิร์ฟเวอร์เท่านั้น หน้าเห็นแค่ยอดรวม.
import { sql, type SQL } from "drizzle-orm";

import { QI_SPEND_BY_CODE } from "@/lib/bazi/qi/catalog";
import { freeLimitOf, qiCostOf } from "@/lib/bazi/qi/quota";
import { priceCall, usdToThb } from "@/lib/llm-usage/pricing";

import { AI_TABLES, bkkDay, bkkStart, LOUISE_HAY_LABEL, rowsOf, type Exec } from "./compute";
import { bucketEnd, buckets, type BdashRange, type Bucket } from "./range";
import { addDays } from "./shape";

/** วันแรกที่ log การเรียก AI บันทึก member id (slice 1 ขึ้น production 2026-10-21 14:08 น.) — ก่อนนี้นับคนไม่ได้ */
export const PEOPLE_FROM = "2026-10-21";

/** ตารางที่บันทึกว่าใครใช้ (slice 1 + หลุยส์ เฮย์ ที่เก็บ anon_id มาแต่เดิม) — ฟีเจอร์อื่นมีแต่ครั้งและค่า AI */
const TRACKED = new Set([
  "open_webui_usage",
  "reading_topic_usage",
  "divine_cards_usage",
  "oracle_cards_usage",
  "fortune_sage_usage",
  "phone_reading_usage",
  "almanac_usage",
]);
/** งานของทีมเอง ไม่มีสมาชิกเกี่ยว */
const BACKOFFICE = new Set(["pair_rephrase_usage", "reading_draft_usage"]);

/** แชตบันทึก 2 แถวต่อคำถาม (triage + reply) — นับครั้งที่ใช้จากแถวคำตอบเท่านั้น ส่วนค่า AI รวมทั้งสองแถว */
const usesOf = (table: string): SQL => (table === "open_webui_usage" ? sql`label IS DISTINCT FROM 'triage'` : sql`true`);

const cardRule = `โควตาไพ่ร่วม ฟรีวันละ ${freeLimitOf("card", "free")} · ${qiCostOf("card")} QI`;
/** กติกาสั้นๆ ใต้ชื่อฟีเจอร์ (ค่ามาจากโค้ดชุดเดียวกับที่แอปใช้ — เปลี่ยนกติกาแล้วตรงนี้เปลี่ยนตาม) */
const RULES: Record<string, string> = {
  แชต: `ฟรีวันละ ${freeLimitOf("chat", "free")} · ${qiCostOf("chat")} QI ต่อคำถาม`,
  ไพ่ออราเคิล: cardRule,
  ไพ่เทวะ: cardRule,
  เซียมซี: cardRule,
  ทำนายเบอร์: `${QI_SPEND_BY_CODE.get("phone_reading")?.qi ?? 0} QI ต่อครั้ง`,
};

/**
 * วันที่ทีมเปลี่ยนกติกา — เส้นประบนกราฟ. ทีมบอกว่าเปลี่ยนอะไรเมื่อไร แล้วเพิ่มที่นี่ทีละ PR
 * (วันที่ = วันที่ขึ้น production ไม่ใช่วันที่ merge).
 */
export const RULE_CHANGES: ReadonlyArray<{ day: string; label: string }> = [
  // bazi c0f8369 "ฟรีเปิดไพ่ 1 ครั้ง/วัน" ขึ้น production รอบ 2026-10-20
  { day: "2026-10-20", label: "ไพ่ฟรี 2→1" },
];

const bucketOf = (bucket: Bucket): SQL =>
  bucket === "day" ? bkkDay(sql`created_at`) : sql`date_trunc('week', created_at AT TIME ZONE 'Asia/Bangkok')::date`;

/** วันแรกที่ต้องอ่านคนใช้ เพื่อให้ % เป็นลูกค้าของช่องแรกเฉลี่ยย้อนได้ครบ 4 สัปดาห์ */
export function peopleQueryFrom(range: Pick<BdashRange, "from" | "bucket">): string {
  return range.bucket === "day" ? addDays(range.from, -27) : addDays(buckets({ ...range, to: range.from }).at(0) ?? range.from, -21);
}

export type AiBucketRow = { feature: string; bucket: string; provider: string; model: string; calls: unknown; uses: unknown; tin: unknown; tout: unknown };
export type PeopleRow = { feature: string; bucket: string; uid: string; n: unknown; first_paid: string | null };

/** ครั้งและค่า AI ต่อฟีเจอร์ต่อช่องเวลา (ไม่รวมการใช้คีย์ของผู้ใช้เอง — ต้นทุนไม่ตกที่ระบบ) */
export async function queryAiBuckets(db: Exec, range: BdashRange): Promise<AiBucketRow[]> {
  const window = sql`created_at >= ${bkkStart(range.from)} AND created_at < ${bkkStart(addDays(range.to, 1))} AND NOT used_own_key`;
  const b = bucketOf(range.bucket);
  const parts = AI_TABLES.map(
    ([table, label]) => sql`
      SELECT ${label}::text AS feature, to_char(${b}, 'YYYY-MM-DD') AS bucket, provider, model, count(*) AS calls,
             count(*) FILTER (WHERE ${usesOf(table)}) AS uses, coalesce(sum(in_tokens), 0) AS tin, coalesce(sum(out_tokens), 0) AS tout
        FROM ${sql.identifier(table)} WHERE ${window} GROUP BY 2, 3, 4`,
  );
  parts.push(sql`
    SELECT ${LOUISE_HAY_LABEL}::text AS feature, to_char(${b}, 'YYYY-MM-DD') AS bucket, 'gemini' AS provider, model, count(*) AS calls,
           count(*) AS uses, coalesce(sum(classify_in_tokens + gen_in_tokens), 0) AS tin, coalesce(sum(classify_out_tokens + gen_out_tokens), 0) AS tout
      FROM louise_hay_usage WHERE ${window} GROUP BY 2, 4`);
  return rowsOf<AiBucketRow>(await db.execute(sql.join(parts, sql` UNION ALL `)));
}

function peopleParts(window: SQL, extra: SQL): SQL[] {
  const parts = AI_TABLES.filter(([table]) => TRACKED.has(table)).map(
    ([table, label]) => sql`
      SELECT ${label}::text AS feature, ${extra} AS bucket, anon_id AS uid, count(*) FILTER (WHERE ${usesOf(table)}) AS n
        FROM ${sql.identifier(table)} WHERE ${window} GROUP BY 2, 3`,
  );
  parts.push(sql`
    SELECT ${LOUISE_HAY_LABEL}::text AS feature, ${extra} AS bucket, anon_id AS uid, count(*) AS n
      FROM louise_hay_usage WHERE ${window} GROUP BY 2, 3`);
  return parts;
}

const FIRST_PAID = sql`SELECT user_id, min(${bkkDay(sql`created_at`)}) AS first_paid FROM v2_payment WHERE status = 'APPROVED' GROUP BY 1`;

/** คนใช้ต่อฟีเจอร์ต่อช่องเวลา พร้อมวันที่คนนั้นจ่ายเงินสำเร็จครั้งแรก (สำหรับกราฟ) — id อยู่ในเซิร์ฟเวอร์เท่านั้น */
export async function queryPeople(db: Exec, range: BdashRange): Promise<PeopleRow[]> {
  const window = sql`anon_id IS NOT NULL AND created_at >= ${bkkStart(peopleQueryFrom(range))} AND created_at < ${bkkStart(addDays(range.to, 1))}`;
  const parts = peopleParts(window, sql`to_char(${bucketOf(range.bucket)}, 'YYYY-MM-DD')`);
  return rowsOf<PeopleRow>(
    await db.execute(sql`
      WITH u AS (${sql.join(parts, sql` UNION ALL `)}), p AS (${FIRST_PAID})
      SELECT u.feature, u.bucket, u.uid, u.n, to_char(p.first_paid, 'YYYY-MM-DD') AS first_paid
        FROM u LEFT JOIN p ON p.user_id = u.uid`),
  );
}

export type PeopleTotalRow = { feature: string; people: unknown; n: unknown; paid: unknown };

/** คนใช้ทั้งช่วงต่อฟีเจอร์ (นับซ้ำคนเดียวครั้งเดียว), ครั้งที่คนเหล่านั้นใช้ และกี่คนเคยจ่ายเงินสำเร็จถึงวันสุดท้ายของช่วง */
export async function queryPeopleTotals(db: Exec, range: BdashRange): Promise<PeopleTotalRow[]> {
  const window = sql`anon_id IS NOT NULL AND created_at >= ${bkkStart(range.from)} AND created_at < ${bkkStart(addDays(range.to, 1))}`;
  const parts = peopleParts(window, sql`''`);
  return rowsOf<PeopleTotalRow>(
    await db.execute(sql`
      WITH u AS (${sql.join(parts, sql` UNION ALL `)}), p AS (${FIRST_PAID})
      SELECT u.feature, count(DISTINCT u.uid) AS people, sum(u.n) AS n,
             count(DISTINCT u.uid) FILTER (WHERE p.first_paid <= ${range.to}::date) AS paid
        FROM u LEFT JOIN p ON p.user_id = u.uid GROUP BY 1`),
  );
}

export type FeatureRow = {
  feature: string;
  rule: string | null;
  /** false = ฟีเจอร์นี้ยังไม่บันทึกว่าใครใช้ (มีแต่ครั้งและค่า AI) */
  tracked: boolean;
  backoffice: boolean;
  people: number | null;
  uses: number;
  usesPerPerson: number | null;
  /** สัดส่วนของคนใช้ที่เคยจ่ายเงินสำเร็จ (ถึงวันสุดท้ายของช่วง) */
  paidShare: number | null;
  thb: number;
};

export type FeatureSeries = { feature: string; people: (number | null)[]; thb: number[]; paidShare: (number | null)[] };

export type FeatureCard = {
  rows: FeatureRow[];
  totalThb: number;
  buckets: string[];
  /** ฟีเจอร์บนกราฟ (สูงสุด 4 — คนใช้มากสุด หรือค่า AI มากสุดถ้ายังไม่มีคนใช้ในช่วงนี้) */
  series: FeatureSeries[];
  markers: { day: string; label: string }[];
  /** ช่วงนี้เริ่มก่อนวันที่นับคนได้ */
  peoplePartial: boolean;
};

const num = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));

const featureMeta = (() => {
  const m = new Map<string, { tracked: boolean; backoffice: boolean }>();
  for (const [table, label] of AI_TABLES) m.set(label, { tracked: TRACKED.has(table), backoffice: BACKOFFICE.has(table) });
  m.set(LOUISE_HAY_LABEL, { tracked: true, backoffice: false });
  return m;
})();

export function shapeFeatureCard(range: BdashRange, ai: AiBucketRow[], people: PeopleRow[], totals: PeopleTotalRow[]): FeatureCard {
  const axis = buckets(range);
  const index = new Map(axis.map((b, i) => [b, i]));

  // ครั้งและค่า AI
  const thbBy = new Map<string, number[]>();
  const usesBy = new Map<string, number>();
  for (const r of ai) {
    const i = index.get(r.bucket);
    if (i === undefined) continue;
    const thb = usdToThb(priceCall({ provider: r.provider, model: r.model, inTokens: num(r.tin), outTokens: num(r.tout) }));
    const arr = thbBy.get(r.feature) ?? axis.map(() => 0);
    arr[i] += thb;
    thbBy.set(r.feature, arr);
    usesBy.set(r.feature, (usesBy.get(r.feature) ?? 0) + num(r.uses));
  }

  // คนใช้ต่อช่อง (เซ็ตของ id) สำหรับกราฟ · ยอดทั้งช่วงมาจาก queryPeopleTotals
  const firstPaid = new Map<string, string | null>();
  const perBucket = new Map<string, Map<string, Set<string>>>(); // feature → bucket → ids
  for (const r of people) {
    firstPaid.set(r.uid, r.first_paid);
    const byB = perBucket.get(r.feature) ?? new Map<string, Set<string>>();
    const ids = byB.get(r.bucket) ?? new Set<string>();
    ids.add(r.uid);
    byB.set(r.bucket, ids);
    perBucket.set(r.feature, byB);
  }
  const total = new Map(totals.map((t) => [t.feature, { people: num(t.people), n: num(t.n), paid: num(t.paid) }]));
  const paidBy = (ids: Iterable<string>, until: string) => {
    let n = 0;
    let paid = 0;
    for (const id of ids) {
      n++;
      const fp = firstPaid.get(id);
      if (fp && fp <= until) paid++;
    }
    return n === 0 ? null : paid / n;
  };

  const names = new Set<string>([...thbBy.keys(), ...total.keys()]);
  const rows: FeatureRow[] = [...names].map((feature) => {
    const meta = featureMeta.get(feature) ?? { tracked: false, backoffice: false };
    const t = total.get(feature);
    const people = meta.tracked ? (t?.people ?? 0) : null;
    const thb = (thbBy.get(feature) ?? []).reduce((s, v) => s + v, 0);
    return {
      feature,
      rule: RULES[feature] ?? null,
      tracked: meta.tracked,
      backoffice: meta.backoffice,
      people,
      uses: usesBy.get(feature) ?? 0,
      usesPerPerson: people && t ? t.n / people : null,
      paidShare: people && t ? t.paid / people : null,
      thb: Math.round(thb * 100) / 100,
    };
  });
  rows.sort((a, b) => (b.people ?? -1) - (a.people ?? -1) || b.thb - a.thb || b.uses - a.uses);

  // กราฟ: ฟีเจอร์ที่คนใช้มากสุด 4 ตัว (ยังไม่มีคนใช้ = ค่า AI มากสุด) — สีเดิมทั้งสามมุมมอง
  const withPeople = rows.filter((r) => (r.people ?? 0) > 0);
  const chosen = (withPeople.length ? withPeople : [...rows].sort((a, b) => b.thb - a.thb)).slice(0, 4).map((r) => r.feature);
  const span = range.bucket === "day" ? 28 : 4; // % เป็นลูกค้า เฉลี่ยย้อน 4 สัปดาห์
  const series: FeatureSeries[] = chosen.map((feature) => {
    const meta = featureMeta.get(feature);
    const byB = perBucket.get(feature) ?? new Map<string, Set<string>>();
    const step = range.bucket === "day" ? 1 : 7;
    return {
      feature,
      people: axis.map((b) => (meta?.tracked ? (byB.get(b)?.size ?? 0) : null)),
      thb: (thbBy.get(feature) ?? axis.map(() => 0)).map((v) => Math.round(v * 100) / 100),
      paidShare: axis.map((b) => {
        const ids = new Set<string>();
        for (let k = 0; k < span; k++) for (const id of byB.get(addDays(b, -k * step)) ?? []) ids.add(id);
        return paidBy(ids, bucketEnd(b, range));
      }),
    };
  });

  return {
    rows,
    totalThb: Math.round(rows.reduce((s, r) => s + r.thb, 0) * 100) / 100,
    buckets: axis,
    series,
    markers: RULE_CHANGES.filter((m) => m.day >= range.from && m.day <= range.to),
    peoplePartial: range.from < PEOPLE_FROM,
  };
}
