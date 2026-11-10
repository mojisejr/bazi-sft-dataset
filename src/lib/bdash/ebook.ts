// bdash ขาย E-Book (mumate-manychat-ebook-001 slice 4, plan 0.7): อ่านอย่างเดียวจากตารางของบอท E-Book
// (ebook_order = สลิปที่บอทตรวจ, ebook_funnel_event = ปุ่มที่ลูกค้ากดใน ManyChat) และการกรอกโค้ดแถมจาก activity_coupon.
// ไม่มีชื่อ เลขบัญชี หรือ subscriber id ในข้อมูลของหน้า — นับเป็นจำนวนอย่างเดียว.
// ไม่นับคนทักเข้า: ข้อความแรกของ flow ส่งต่อขั้นถัดไปไม่ได้ (ManyChat) หน้าจึงเริ่มนับที่กดซื้อ.
// ค่าแอด ต้นทุนต่อคนซื้อ และแอดที่วิ่งอยู่มาใน slice 5 (Meta).
import { sql, type SQL } from "drizzle-orm";

import { bkkDay, bkkStart, rowsOf, type Exec } from "./compute";
import { buckets, type BdashRange } from "./range";
import { addDays } from "./shape";

/** วันที่บอทเริ่มตรวจสลิปให้ลูกค้าทุกคน (EBOOK_OPEN=1 คืน 2026-11-10) — ก่อนหน้านี้แอดมินตรวจเอง ไม่อยู่ในตาราง */
export const EBOOK_FROM = "2026-11-10";
/** โค้ดแถม mumate plus 1 เดือนที่ส่งไปกับ E-Book */
export const EBOOK_COUPON = "ebookpuls95";
/** ราคาต่อเล่ม (บาท) — ใช้บอกจุดคุ้มทุนในข้อความเท่านั้น ยอดเงินอ่านจากสลิปจริง */
export const EBOOK_PRICE = 95;
/** ชั่วโมงที่ทีมแนะนำให้ปิดแอด (22:00–07:00) — แรเงาในกราฟตามชั่วโมง */
export const QUIET_HOURS: ReadonlySet<number> = new Set([22, 23, 0, 1, 2, 3, 4, 5, 6]);

export const REASON_TH: Record<string, string> = {
  not_now: "ยังไม่สะดวกโอนตอนนี้",
  think: "ขอคิดดูก่อน",
  price: "ราคายังไม่โดน",
  want_qr: "อยากจ่ายด้วย QR",
  question: "มีคำถามก่อนซื้อ",
  howto: "ดูวิธีโอนอีกครั้ง",
};
export const FAQ_TH: Record<string, string> = {
  beginner: "มือใหม่อ่านรู้เรื่องไหม",
  file: "ไฟล์แบบไหน",
  app: "แอปใช้ยังไง",
  delivery: "ได้ของยังไง",
  admin: "คุยกับแอดมิน",
};
const th = (map: Record<string, string>, v: string): string => map[v] ?? v;

// บอทบน staging เขียน env = 'staging' ลงฐานของ staging และ production เขียน 'production' ลงฐานจริง — กันแถวของเครื่องนักพัฒนาออก
const LIVE = sql`env <> 'development'`;
const windowOf = (col: SQL, range: Pick<BdashRange, "from" | "to">): SQL =>
  sql`${col} >= ${bkkStart(range.from)} AND ${col} < ${bkkStart(addDays(range.to, 1))}`;
/** เวลาที่เงินเข้า: เวลาบนสลิปที่ธนาคารยืนยัน ถ้าไม่มีใช้เวลาที่บอทได้รับสลิป */
const PAID_AT = sql`coalesce(slip_at, created_at)`;
const bucketOf = (col: SQL, range: Pick<BdashRange, "bucket">): SQL =>
  range.bucket === "day" ? bkkDay(col) : sql`date_trunc('week', (${col}) AT TIME ZONE 'Asia/Bangkok')::date`;

const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

export type EbookTotalsRow = {
  buyers: unknown; samplers: unknown; asked: unknown; answered: unknown;
  slip_people: unknown; paid_people: unknown; delivered_people: unknown;
  sold: unknown; baht: unknown; rejected: unknown; to_admin: unknown;
};
export async function queryTotals(db: Exec, range: BdashRange): Promise<EbookTotalsRow> {
  const ev = sql`FROM ebook_funnel_event WHERE ${LIVE} AND ${windowOf(sql`at`, range)}`;
  const ord = sql`FROM ebook_order WHERE ${LIVE}`;
  const r = await db.execute(sql`SELECT
    (SELECT count(DISTINCT subscriber_id) ${ev} AND step = 'buy') AS buyers,
    (SELECT count(DISTINCT subscriber_id) ${ev} AND step = 'sample') AS samplers,
    (SELECT count(DISTINCT subscriber_id) ${ev} AND step = 'reason_asked') AS asked,
    (SELECT count(DISTINCT subscriber_id) ${ev} AND step = 'reason') AS answered,
    (SELECT count(DISTINCT subscriber_id) ${ord} AND ${windowOf(sql`created_at`, range)}) AS slip_people,
    (SELECT count(DISTINCT subscriber_id) ${ord} AND status = 'paid' AND ${windowOf(PAID_AT, range)}) AS paid_people,
    (SELECT count(DISTINCT subscriber_id) ${ord} AND status = 'paid' AND delivered_at IS NOT NULL AND ${windowOf(PAID_AT, range)}) AS delivered_people,
    (SELECT count(*) ${ord} AND status = 'paid' AND ${windowOf(PAID_AT, range)}) AS sold,
    (SELECT coalesce(sum(amount), 0) ${ord} AND status = 'paid' AND ${windowOf(PAID_AT, range)}) AS baht,
    (SELECT count(*) ${ord} AND status = 'rejected' AND ${windowOf(sql`created_at`, range)}) AS rejected,
    (SELECT count(*) ${ord} AND status = 'admin' AND ${windowOf(sql`created_at`, range)}) AS to_admin`);
  return rowsOf<EbookTotalsRow>(r)[0];
}

export type ChoiceSqlRow = { value: string; people: unknown };
/** ปุ่มเหตุผลใน FU1 หรือข้อ FAQ ที่กด — นับคน (คนเดียวกดปุ่มเดิมซ้ำนับครั้งเดียว) */
export async function queryChoices(db: Exec, range: BdashRange, step: "reason" | "faq"): Promise<ChoiceSqlRow[]> {
  const r = await db.execute(sql`SELECT value, count(DISTINCT subscriber_id) AS people FROM ebook_funnel_event
    WHERE ${LIVE} AND step = ${step} AND value IS NOT NULL AND value <> 'menu' AND ${windowOf(sql`at`, range)}
    GROUP BY 1 ORDER BY 2 DESC, 1`);
  return rowsOf<ChoiceSqlRow>(r);
}

export type DaySqlRow = { day: string; sold: unknown; baht: unknown; buyers: unknown };
export async function queryDays(db: Exec, range: BdashRange): Promise<DaySqlRow[]> {
  const r = await db.execute(sql`
    WITH s AS (SELECT ${bucketOf(PAID_AT, range)} AS day, count(*) AS sold, coalesce(sum(amount), 0) AS baht
               FROM ebook_order WHERE ${LIVE} AND status = 'paid' AND ${windowOf(PAID_AT, range)} GROUP BY 1),
         b AS (SELECT ${bucketOf(sql`at`, range)} AS day, count(DISTINCT subscriber_id) AS buyers
               FROM ebook_funnel_event WHERE ${LIVE} AND step = 'buy' AND ${windowOf(sql`at`, range)} GROUP BY 1)
    SELECT to_char(coalesce(s.day, b.day), 'YYYY-MM-DD') AS day, coalesce(s.sold, 0) AS sold, coalesce(s.baht, 0) AS baht, coalesce(b.buyers, 0) AS buyers
    FROM s FULL JOIN b ON b.day = s.day ORDER BY 1`);
  return rowsOf<DaySqlRow>(r);
}

export type HourSqlRow = { hour: unknown; buys: unknown; sold: unknown };
/** รวมทุกวันในช่วง: กดซื้อกี่ครั้ง และเงินเข้ากี่ใบ ในแต่ละชั่วโมงของวัน (เวลาไทย) */
export async function queryHours(db: Exec, range: BdashRange): Promise<HourSqlRow[]> {
  const hour = (col: SQL) => sql`extract(hour FROM (${col}) AT TIME ZONE 'Asia/Bangkok')::int`;
  const r = await db.execute(sql`
    WITH b AS (SELECT ${hour(sql`at`)} AS hour, count(*) AS buys FROM ebook_funnel_event
               WHERE ${LIVE} AND step = 'buy' AND ${windowOf(sql`at`, range)} GROUP BY 1),
         s AS (SELECT ${hour(PAID_AT)} AS hour, count(*) AS sold FROM ebook_order
               WHERE ${LIVE} AND status = 'paid' AND ${windowOf(PAID_AT, range)} GROUP BY 1)
    SELECT coalesce(b.hour, s.hour) AS hour, coalesce(b.buys, 0) AS buys, coalesce(s.sold, 0) AS sold
    FROM b FULL JOIN s ON s.hour = b.hour ORDER BY 1`);
  return rowsOf<HourSqlRow>(r);
}

export type CouponSqlRow = { found: unknown; redeemed: unknown };
/** คนที่กรอกโค้ดแถมในช่วงนี้ — โค้ดเดียวกันทุกคน จึงบอกได้แค่จำนวน */
export async function queryCoupon(db: Exec, range: BdashRange): Promise<CouponSqlRow> {
  const r = await db.execute(sql`SELECT
    (SELECT count(*) FROM activity_coupon WHERE lower(code) = ${EBOOK_COUPON}) AS found,
    (SELECT count(*) FROM activity_coupon_redemption x JOIN activity_coupon c ON c.id = x.coupon_id
      WHERE lower(c.code) = ${EBOOK_COUPON} AND ${windowOf(sql`x.redeemed_at`, range)}) AS redeemed`);
  return rowsOf<CouponSqlRow>(r)[0];
}

// ── รูปของข้อมูลที่หน้าใช้ ──

export type FunnelStep = { key: string; label: string; hint: string; people: number; drop: number | null; worst: boolean };
export type Choice = { label: string; people: number };
export type EbookDay = { day: string; sold: number; baht: number; buyers: number };
export type EbookHour = { hour: number; buys: number; sold: number; quiet: boolean };
export type EbookCard = {
  sold: number;
  baht: number;
  buyers: number;
  samplers: number;
  slipPeople: number;
  paidPeople: number;
  /** คนส่งสลิป ÷ คนกดซื้อ (null ถ้าไม่มีคนกดซื้อ) */
  payRate: number | null;
  rejected: number;
  toAdmin: number;
  funnel: FunnelStep[];
  asked: number;
  answered: number;
  reasons: Choice[];
  faq: Choice[];
  days: EbookDay[];
  hours: EbookHour[];
  coupon: { sent: number; redeemed: number | null };
  /** ช่วงนี้เริ่มก่อนวันที่บอทเปิด — ตัวเลขก่อนวันนั้นไม่มีในหน้านี้ */
  partial: boolean;
};

const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export function shapeFunnel(steps: ReadonlyArray<{ key: string; label: string; hint: string; people: number }>): FunnelStep[] {
  const out = steps.map((s, i) => {
    const prev = i === 0 ? null : steps[i - 1].people;
    // ขั้นถัดไปมากกว่าขั้นก่อนได้ (เช่น ส่งสลิปโดยไม่ได้กดซื้อในช่วงนี้) — แบบนั้นไม่นับว่าหลุด
    const drop = prev === null || prev === 0 ? null : Math.max(0, 1 - s.people / prev);
    return { ...s, drop, worst: false };
  });
  const worst = Math.max(0, ...out.map((s) => s.drop ?? 0));
  if (worst > 0) out.forEach((s) => (s.worst = s.drop === worst));
  return out;
}

export function shapeEbook(
  range: BdashRange,
  t: EbookTotalsRow,
  reasons: ChoiceSqlRow[],
  faq: ChoiceSqlRow[],
  days: DaySqlRow[],
  hours: HourSqlRow[],
  coupon: CouponSqlRow,
): EbookCard {
  const buyers = n(t.buyers);
  const slipPeople = n(t.slip_people);
  const paidPeople = n(t.paid_people);
  const delivered = n(t.delivered_people);
  const byDay = new Map(days.map((d) => [d.day, d]));
  const byHour = new Map(hours.map((h) => [n(h.hour), h]));
  return {
    sold: n(t.sold),
    baht: n(t.baht),
    buyers,
    samplers: n(t.samplers),
    slipPeople,
    paidPeople,
    payRate: ratio(slipPeople, buyers),
    rejected: n(t.rejected),
    toAdmin: n(t.to_admin),
    funnel: shapeFunnel([
      { key: "buy", label: "กดสั่งซื้อ", hint: "เห็นเลขบัญชี", people: buyers },
      { key: "slip", label: "ส่งสลิป", hint: "บอทได้รับรูปสลิป", people: slipPeople },
      { key: "paid", label: "ธนาคารยืนยัน", hint: "ยอดและบัญชีถูก", people: paidPeople },
      { key: "delivered", label: "ได้ของ", hint: "บอทส่งไฟล์และโค้ดแล้ว", people: delivered },
    ]),
    asked: n(t.asked),
    answered: n(t.answered),
    reasons: reasons.map((r) => ({ label: th(REASON_TH, r.value), people: n(r.people) })),
    faq: faq.map((r) => ({ label: th(FAQ_TH, r.value), people: n(r.people) })),
    days: buckets(range).map((day) => {
      const d = byDay.get(day);
      return { day, sold: n(d?.sold), baht: n(d?.baht), buyers: n(d?.buyers) };
    }),
    hours: Array.from({ length: 24 }, (_, hour) => {
      const h = byHour.get(hour);
      return { hour, buys: n(h?.buys), sold: n(h?.sold), quiet: QUIET_HOURS.has(hour) };
    }),
    coupon: { sent: delivered, redeemed: n(coupon.found) > 0 ? n(coupon.redeemed) : null },
    partial: range.from < EBOOK_FROM,
  };
}

/** อ่านทั้งหน้า — query เรียงทีละตัว ไม่ยิงพร้อมกัน (แนวเดียวกับเมนูอื่น) */
export async function readEbook(q: (name: string) => Exec, range: BdashRange): Promise<EbookCard> {
  const totals = await queryTotals(q("ebook_totals"), range);
  const reasons = await queryChoices(q("ebook_reasons"), range, "reason");
  const faq = await queryChoices(q("ebook_faq"), range, "faq");
  const days = await queryDays(q("ebook_days"), range);
  const hours = await queryHours(q("ebook_hours"), range);
  const coupon = await queryCoupon(q("ebook_coupon"), range);
  return shapeEbook(range, totals, reasons, faq, days, hours, coupon);
}
