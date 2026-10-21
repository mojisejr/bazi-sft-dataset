// bdash — ส่วนที่ไม่แตะฐานข้อมูล: แปลงแถวจาก SQL เป็น payload (ทดสอบได้ใน tests/bdash-shape.test.ts).
import { priceCall, usdToThb } from "@/lib/llm-usage/pricing";

import type { BdashAiFeature, BdashCohort, BdashPaymentRow, BdashQiDay } from "./types";

/** YYYY-MM-DD + n วัน (ปฏิทินล้วน ไม่มีโซนเวลา) */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const num = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

export type CohortSqlRow = {
  week: string;
  signups: unknown;
  d1: unknown;
  d7: unknown;
  d30: unknown;
  paid35: unknown;
  median_days: unknown;
};

/**
 * ช่วง "กลับมาใช้" นับจากวันสมัคร (d0): วันถัดไป = d0+1 · สัปดาห์ที่ 2 = d0+7..d0+13 · 1 เดือนต่อมา = d0+30..d0+36.
 * กลุ่มหนึ่งสัปดาห์จะโชว์ตัวเลขช่วงใดก็ต่อเมื่อคนที่สมัครวันสุดท้ายของสัปดาห์ (จันทร์+6) ผ่านช่วงนั้นครบแล้ว
 * ไม่งั้นตัวเลขจะต่ำเกินจริง (ยังไม่ทันกลับมา) — จึงเป็น null แทน.
 */
export function shapeCohorts(rows: CohortSqlRow[], asOf: string): BdashCohort[] {
  return rows.map((r) => {
    const lastSignup = addDays(r.week, 6);
    const reached = (endOffset: number) => addDays(lastSignup, endOffset) <= asOf;
    const paid = num(r.paid35);
    return {
      week: r.week,
      signups: num(r.signups),
      d1: reached(1) ? num(r.d1) : null,
      d7: reached(13) ? num(r.d7) : null,
      d30: reached(36) ? num(r.d30) : null,
      paid35: paid,
      paid35Complete: reached(35),
      medianDaysToPay: paid > 0 ? numOrNull(r.median_days) : null,
    };
  });
}

export type PaymentSqlRow = {
  method: string | null;
  gateway: string | null;
  created: unknown;
  approved: unknown;
  rejected: unknown;
  expired: unknown;
  waiting: unknown;
  top_failure: string | null;
};

export function shapePayments(rows: PaymentSqlRow[]): BdashPaymentRow[] {
  return rows
    .map((r) => ({
      method: r.method ?? "-",
      gateway: r.gateway ?? "-",
      created: num(r.created),
      approved: num(r.approved),
      rejected: num(r.rejected),
      expired: num(r.expired),
      waiting: num(r.waiting),
      topFailure: r.top_failure ?? null,
    }))
    .sort((a, b) => b.created - a.created);
}

/** แถวจาก queryPayers — ไม่มี user_id (หน้าแสดงชื่ออย่างเดียว) */
export type PayerSqlRow = {
  name: string | null;
  times: unknown;
  satang: unknown;
  yearly: unknown;
  last_day: string;
  last_package: string;
  last_package_desc: string | null;
  member_end: string | null;
  buy_days: unknown;
  span_days: unknown;
};

export type QiSqlRow ={ day: string } & Record<"buy" | "missions" | "daily" | "referral" | "team" | "other" | "spend", unknown>;

/** 28 วันจนถึง asOf ครบทุกวัน — วันที่ไม่มีรายการใส่ 0 เพื่อให้เส้นกราฟไม่กระโดดข้ามวัน */
export function fillQiDays(rows: QiSqlRow[], asOf: string, days = 28): BdashQiDay[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: BdashQiDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(asOf, -i);
    const r = byDay.get(day);
    out.push({
      day,
      buy: num(r?.buy),
      missions: num(r?.missions),
      daily: num(r?.daily),
      referral: num(r?.referral),
      team: num(r?.team),
      other: num(r?.other),
      spend: num(r?.spend),
    });
  }
  return out;
}

export type AiSqlRow = { feature: string; provider: string; model: string; calls: unknown; tin: unknown; tout: unknown };

/** ต้นทุนคิดจากตารางราคาเดียวของ bazi (src/lib/llm-usage/pricing.ts) แล้วแปลงเป็นบาท */
export function priceAi(rows: AiSqlRow[]): { features: BdashAiFeature[]; totalThb: number } {
  const byFeature = new Map<string, BdashAiFeature>();
  for (const r of rows) {
    const usd = priceCall({ provider: r.provider, model: r.model, inTokens: num(r.tin), outTokens: num(r.tout) });
    const f = byFeature.get(r.feature) ?? { feature: r.feature, calls: 0, tokens: 0, thb: 0 };
    f.calls += num(r.calls);
    f.tokens += num(r.tin) + num(r.tout);
    f.thb += usdToThb(usd);
    byFeature.set(r.feature, f);
  }
  const features = [...byFeature.values()]
    .map((f) => ({ ...f, thb: Math.round(f.thb * 100) / 100 }))
    .filter((f) => f.calls > 0)
    .sort((a, b) => b.thb - a.thb);
  const totalThb = Math.round(features.reduce((s, f) => s + f.thb, 0) * 100) / 100;
  return { features, totalThb };
}
