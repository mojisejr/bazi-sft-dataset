// bdash — คำพูดและตัวเลขที่หน้า /bdash แสดง (ไม่แตะฐานข้อมูล · ทดสอบใน tests/bdash-shape.test.ts).
// ภาษาไทยง่ายๆ ตามที่ owner อนุมัติบน mock (2026-10-13): หัวข้อเป็นคำถาม, บอกว่ายิ่งสูงหรือยิ่งต่ำยิ่งดี.
import { addDays, type PayerSqlRow } from "./shape";
import type { BdashCohort, BdashPayer, BdashPayerSummary, BdashPaymentRow, BdashQiDay, BdashSnapshot } from "./types";

const TH_MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-10-12" → "12 ต.ค." */
export function thDate(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${TH_MON[m - 1]}`;
}

/** "2027-10-12" → "12 ต.ค. 70" (ปี พ.ศ. สองหลัก — วันหมดสมาชิกอยู่คนละปีได้) */
export function thDateYy(day: string): string {
  return `${thDate(day)} ${String((Number(day.slice(0, 4)) + 543) % 100).padStart(2, "0")}`;
}

export const pct = (v: number | null): string => (v === null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(1)}%`);
export const int = (v: number): string => Math.round(v).toLocaleString("en-US");
export const baht = (v: number): string => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export const METHOD_TH: Record<string, string> = { promptpay: "PromptPay", card: "บัตรเครดิต/เดบิต" };

/** failure_code → เหตุผลที่ทีมอ่านเข้าใจ (code ที่ไม่รู้จักแสดงตามเดิม) */
export function failureTh(code: string | null): string {
  if (!code) return "—";
  if (code === "gateway_expired" || code === "expired") return "QR/ลิงก์หมดเวลา";
  if (code === "payment_rejected") return "ธนาคาร/บัตรปฏิเสธ";
  if (code === "unknown") return "ไม่ทราบสาเหตุ";
  return code;
}

/** แพ็กที่ขายอยู่ → ชื่อสั้นที่ทีมอ่านเข้าใจ · แพ็กอื่นใช้ description ใน payment_package · ไม่มีอีกใช้รหัส */
export const PACKAGE_TH: Record<string, string> = {
  V2_PRO_YEARLY: "Pro รายปี",
  V2_PRO_MONTHLY: "Pro รายเดือน",
  V2_PLUS_YEARLY: "Plus รายปี",
  V2_PLUS_MONTHLY: "Plus รายเดือน",
  QI_60: "ชี่ 90",
  QI_200: "ชี่ 300",
  QI_500: "ชี่ 900",
  QI_1200: "ชี่ 2,100",
  SINSAE_30: "จองซินแส 30 นาที",
  SINSAE_60: "จองซินแส 60 นาที",
  SINSAE_90: "จองซินแส 90 นาที",
  BOOK_PDF: "หนังสือ PDF",
  BOOK_PHYSICAL: "หนังสือเล่ม",
};

export const packageTh = (code: string, description: string | null): string => PACKAGE_TH[code] ?? (description?.trim() || code);

/** ชื่อบนจอยาวได้แค่นี้ (นับเป็นตัวอักษรที่เห็น ไม่ตัดสระ/วรรณยุกต์ไทยออกจากตัวของมัน) — CSS ตัดเพิ่มอีกชั้นเมื่อจอแคบ */
export const NAME_MAX = 20;
const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });

/**
 * ชื่อที่ bdash แสดงได้: ชื่ออย่างเดียว (owner 2026-10-21). ถ้าคนตั้งชื่อเป็นอีเมลหรือเบอร์โทร ไม่แสดง
 * เพราะ bdash ต้องไม่มีอีเมลหรือเบอร์ (นับเลขติดกันตั้งแต่ 6 ตัว ข้ามช่องว่างและขีด).
 */
export function payerName(raw: string | null): string {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "ไม่มีชื่อ";
  if (s.includes("@") || /\d{6,}/.test(s.replace(/[\s\-().+]/g, ""))) return "ไม่แสดงชื่อ";
  const g = [...graphemes.segment(s)].map((x) => x.segment);
  return g.length > NAME_MAX ? `${g.slice(0, NAME_MAX - 1).join("").trimEnd()}…` : s;
}

/** แถวจาก SQL → สรุปและรายชื่อ. ชื่อผ่าน payerName ที่นี่ ชื่อดิบจึงไม่ไปถึงหน้า */
export function shapePayers(rows: PayerSqlRow[]): { summary: BdashPayerSummary; payers: BdashPayer[] } {
  const n = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
  const again = rows.filter((r) => n(r.buy_days) >= 2);
  const gaps = again.reduce((s, r) => s + n(r.buy_days) - 1, 0);
  return {
    summary: {
      payers: rows.length,
      payments: rows.reduce((s, r) => s + n(r.times), 0),
      once: rows.length - again.length,
      again: again.length,
      avgGapDays: gaps > 0 ? again.reduce((s, r) => s + n(r.span_days), 0) / gaps : null,
      yearly: rows.reduce((s, r) => s + n(r.yearly), 0),
    },
    payers: rows.map((r) => ({
      name: payerName(r.name),
      times: n(r.times),
      baht: n(r.satang) / 100,
      lastDay: r.last_day,
      lastPackage: packageTh(r.last_package, r.last_package_desc),
      memberEnd: r.member_end,
    })),
  };
}

/** QI ที่ระบบแจกเอง (ภารกิจ + กิจกรรมรายวัน + ชวนเพื่อน + อื่นๆ) — ไม่รวมที่ซื้อ และที่ทีมแจกมือ (แสดงแยก) */
export const qiFree = (d: BdashQiDay): number => d.missions + d.daily + d.referral + d.other;

export type BdashKpis = {
  d7Latest: number | null;
  d7Week: string | null;
  d7Delta: number | null;
  conv35: number | null;
  /** วันที่กลุ่มแรกจะครบ 5 สัปดาห์ (ถ้ายังไม่มีกลุ่มไหนครบ) */
  conv35FirstReady: string | null;
  paySuccess: number | null;
  expiredShare: number | null;
  aiPerActive: number | null;
};

const rate = (c: BdashCohort, n: number | null) => (n === null ? null : ratio(n, c.signups));

/** ตัวเลขที่ KPI ต้องใช้ — มาจาก snapshot หรือจากการอ่านสดตามช่วงก็ได้ */
export type KpiInput = Pick<BdashSnapshot, "cohorts" | "payments"> & { ai: { totalThb: number; activeMembers: number } };

export function kpis(s: KpiInput): BdashKpis {
  const withD7 = s.cohorts.filter((c) => c.d7 !== null && c.signups > 0);
  const last = withD7.at(-1);
  const prev = withD7.at(-2);
  const d7Latest = last ? rate(last, last.d7) : null;
  const d7Prev = prev ? rate(prev, prev.d7) : null;

  const done = s.cohorts.filter((c) => c.paid35Complete);
  const doneSignups = done.reduce((n, c) => n + c.signups, 0);
  const first = s.cohorts[0];

  const sum = (k: keyof Pick<BdashPaymentRow, "created" | "approved" | "expired">) => s.payments.reduce((n, p) => n + p[k], 0);
  const created = sum("created");

  return {
    d7Latest,
    d7Week: last?.week ?? null,
    d7Delta: d7Latest !== null && d7Prev !== null ? d7Latest - d7Prev : null,
    conv35: done.length ? ratio(done.reduce((n, c) => n + c.paid35, 0), doneSignups) : null,
    conv35FirstReady: done.length || !first ? null : addDays(first.week, 6 + 35),
    paySuccess: ratio(sum("approved"), created),
    expiredShare: ratio(sum("expired"), created),
    aiPerActive: ratio(s.ai.totalThb, s.ai.activeMembers),
  };
}

/** "+2.3 จุด" / "−1.0 จุด" — ส่วนต่างของสองเปอร์เซ็นต์ */
export function points(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  return `${sign}${Math.abs(delta * 100).toFixed(1)} จุด`;
}

/** "21 ก.ย. – 20 ต.ค. 2569" (ปี พ.ศ.; ข้ามปีจึงใส่ปีทั้งสองฝั่ง) */
export function thRange(from: string, to: string): string {
  const y = (d: string) => Number(d.slice(0, 4)) + 543;
  if (from === to) return `${thDate(to)} ${y(to)}`;
  return y(from) === y(to) ? `${thDate(from)} – ${thDate(to)} ${y(to)}` : `${thDate(from)} ${y(from)} – ${thDate(to)} ${y(to)}`;
}

/**
 * รวมผู้รับเงินเข้าด้วยกัน เหลือแถวละวิธีจ่าย (owner 2026-10-21: จ่ายผ่าน Beam อย่างเดียวแล้ว ไม่ต้องแยก Omise บน bdash).
 * รายการเก่าที่ผ่าน Omise (ถึง 2026-09-09) ยังนับรวมในวิธีจ่ายของมัน เพราะเป็นเงินที่เข้ามาจริง.
 * สาเหตุที่ไม่สำเร็จบ่อยสุด = ของแถวที่ไม่สำเร็จมากที่สุด.
 */
export function byMethod(payments: BdashPaymentRow[]): BdashPaymentRow[] {
  const out = new Map<string, BdashPaymentRow>();
  const worst = new Map<string, number>();
  for (const p of payments) {
    const failed = p.created - p.approved - p.waiting;
    const acc = out.get(p.method);
    if (!acc) {
      out.set(p.method, { ...p, gateway: "all" });
      worst.set(p.method, failed);
      continue;
    }
    acc.created += p.created;
    acc.approved += p.approved;
    acc.rejected += p.rejected;
    acc.expired += p.expired;
    acc.waiting += p.waiting;
    if (failed > (worst.get(p.method) ?? 0) && p.topFailure) {
      worst.set(p.method, failed);
      acc.topFailure = p.topFailure;
    }
  }
  return [...out.values()].sort((a, b) => b.created - a.created);
}

/** วิธีจ่ายที่ควรดู: กดจ่ายอย่างน้อย 5 ครั้ง สำเร็จต่ำกว่า 70% — เลือกอันที่ไม่สำเร็จมากสุด พร้อมเหตุหลัก */
export function paymentToWatch(payments: BdashPaymentRow[]): { method: string; reason: "expired" | "rejected"; n: number; created: number } | null {
  const weak = payments
    .filter((p) => p.created >= 5 && p.approved / p.created < 0.7)
    .sort((a, b) => b.expired + b.rejected - (a.expired + a.rejected));
  const p = weak[0];
  if (!p) return null;
  const reason = p.expired >= p.rejected ? "expired" : "rejected";
  return { method: METHOD_TH[p.method] ?? p.method, reason, n: reason === "expired" ? p.expired : p.rejected, created: p.created };
}

/** QI รายวัน → รายสัปดาห์ (วันจันทร์) เมื่อช่วงยาว */
export function qiByWeek(days: BdashQiDay[]): BdashQiDay[] {
  const out = new Map<string, BdashQiDay>();
  for (const d of days) {
    const dow = new Date(`${d.day}T00:00:00Z`).getUTCDay();
    const w = addDays(d.day, -((dow + 6) % 7));
    const acc = out.get(w) ?? { day: w, buy: 0, missions: 0, daily: 0, referral: 0, team: 0, other: 0, spend: 0 };
    acc.buy += d.buy;
    acc.missions += d.missions;
    acc.daily += d.daily;
    acc.referral += d.referral;
    acc.team += d.team;
    acc.other += d.other;
    acc.spend += d.spend;
    out.set(w, acc);
  }
  return [...out.values()];
}
