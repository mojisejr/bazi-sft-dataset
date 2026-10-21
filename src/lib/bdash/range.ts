// bdash ช่วงเวลา (mumate-bdash-v2-001 slice 2): 7 / 30 / 90 วัน หรือเลือกเอง — ใช้ช่วงเดียวกันทุกเมนู และอยู่ในลิงก์
// (?range=30 หรือ ?from=YYYY-MM-DD&to=YYYY-MM-DD) จึงคัดลอกลิงก์ไปให้คนอื่นแล้วเห็นช่วงเดียวกัน. ไม่แตะฐานข้อมูล.
import { addDays } from "./shape";

export const PRESETS = [7, 30, 90] as const;
export type Preset = (typeof PRESETS)[number];
export const DEFAULT_PRESET: Preset = 30;
/** เลือกเองได้ยาวสุดเท่านี้ — ยาวกว่านี้อ่านสดไม่ทันเวลาที่กันไว้ */
export const MAX_DAYS = 366;
/** ข้อมูลที่ bdash อ่านเริ่มจากระบบจ่ายเงินชุดใหม่ (v2_payment) — เลือกก่อนวันนี้ไม่มีอะไรให้ดู */
export const EARLIEST = "2026-08-25";
/** ช่วงยาวกว่านี้ กราฟเปลี่ยนจากรายวันเป็นรายสัปดาห์ */
export const DAILY_UP_TO = 31;

export type Bucket = "day" | "week";

export type BdashRange = {
  /** "7" | "30" | "90" หรือ "custom" */
  key: `${Preset}` | "custom";
  from: string;
  /** วันสุดท้าย (รวมวันนี้) */
  to: string;
  days: number;
  bucket: Bucket;
  /** ส่วน query ของลิงก์ เช่น "range=30" — ต่อท้าย path ของทุกเมนู */
  query: string;
  /** ค่าที่ใส่มาใช้ไม่ได้ จึงกลับไปช่วงเริ่มต้น — บอกคนดูว่าเกิดอะไรขึ้น */
  note: string | null;
};

type Params = Record<string, string | string[] | undefined>;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
const isDay = (v: string | undefined): v is string => !!v && DAY_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && addDays(v, 0) === v;

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

function preset(n: Preset, today: string, note: string | null = null): BdashRange {
  const from = addDays(today, -(n - 1));
  return { key: `${n}`, from, to: today, days: n, bucket: n > DAILY_UP_TO ? "week" : "day", query: `range=${n}`, note };
}

/** อ่านช่วงจาก query ของลิงก์ · today = วันไทยของวันนี้ */
export function parseRange(params: Params, today: string): BdashRange {
  const r = one(params.range);
  const from = one(params.from);
  const to = one(params.to);

  if (from !== undefined || to !== undefined) {
    if (!isDay(from) || !isDay(to)) return preset(DEFAULT_PRESET, today, "วันที่ที่เลือกอ่านไม่ออก จึงแสดง 30 วันล่าสุดแทน");
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    const a = lo < EARLIEST ? EARLIEST : lo > today ? today : lo;
    const b = hi > today ? today : hi < a ? a : hi;
    const days = daysBetween(a, b);
    if (days > MAX_DAYS) return preset(DEFAULT_PRESET, today, `เลือกได้ยาวสุด ${MAX_DAYS} วัน จึงแสดง 30 วันล่าสุดแทน`);
    return { key: "custom", from: a, to: b, days, bucket: days > DAILY_UP_TO ? "week" : "day", query: `from=${a}&to=${b}`, note: null };
  }

  const n = Number(r);
  if (r !== undefined && (PRESETS as readonly number[]).includes(n)) return preset(n as Preset, today);
  return preset(DEFAULT_PRESET, today, r === undefined ? null : "ช่วงที่เลือกไม่มีในรายการ จึงแสดง 30 วันล่าสุดแทน");
}

/** path ของเมนูพร้อมช่วงปัจจุบัน — ช่วงตามไปทุกเมนู */
export const withRange = (path: string, range: Pick<BdashRange, "query">): string => `${path}?${range.query}`;

/** วันจันทร์ของสัปดาห์ (ปฏิทินล้วน) */
export function weekOf(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = อาทิตย์
  return addDays(day, -((dow + 6) % 7));
}

/** ทุกช่องของแกนเวลาในช่วงนี้ เรียงจากเก่าไปใหม่ — วันละช่อง หรือสัปดาห์ละช่อง (เริ่มวันจันทร์) */
export function buckets(range: Pick<BdashRange, "from" | "to" | "bucket">): string[] {
  const out: string[] = [];
  if (range.bucket === "day") {
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) out.push(d);
  } else {
    for (let w = weekOf(range.from); w <= range.to; w = addDays(w, 7)) out.push(w);
  }
  return out;
}

/** วันสุดท้ายของช่อง (สัปดาห์ = อาทิตย์ แต่ไม่เกินวันสุดท้ายของช่วง) */
export const bucketEnd = (b: string, range: Pick<BdashRange, "to" | "bucket">): string => {
  const end = range.bucket === "day" ? b : addDays(b, 6);
  return end > range.to ? range.to : end;
};
