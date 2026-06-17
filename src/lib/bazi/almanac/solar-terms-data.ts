/**
 * ขอบสารท (24 節氣) สำหรับไฮไลต์ในปฏิทินโหราศาสตร์
 *
 * - ในช่วง พ.ศ. 2450–2601 (ค.ศ. 1907–2058): ใช้ "ปฏิทิน 150 ปี" ที่สกัดไว้
 *   (src/lib/bazi/data/almanac/solar-terms-2450-2600.json — มีทั้งเวลาสารทใหญ่/สารทเล็ก)
 *   ผ่าน scripts/extract-solar-terms.py
 * - นอกช่วง: fallback คำนวณจาก lunar-javascript (solar-terms.ts) รองรับ ค.ศ. 1900–2100
 *
 * 節 (major) = สารทใหญ่/วันเปลี่ยนเดือน BaZi ; 中氣 (minor) = สารทเล็ก (กลางเดือน)
 */
import { splitGanZhi } from "@/lib/bazi/symbolic-engine.birth";
import { buildGregorianYearSolarTerms } from "@/lib/bazi/solar-terms";

import solarTermsJson from "@/lib/bazi/data/almanac/solar-terms-2450-2600.json";

export type SolarTermKind = "major" | "minor";

export type SolarTermMark = {
  /** major = 節 (สารทใหญ่/เปลี่ยนเดือน), minor = 中氣 (สารทเล็ก) */
  kind: SolarTermKind;
  /** ชื่อสารทจีน เช่น 立秋 */
  name: string;
  /** ชื่อไทย/ทับศัพท์ เช่น "ลี่ชิว (เริ่มฤดูใบไม้ร่วง)" */
  nameTh: string;
  /** เวลา HH:MM ที่สารทตก */
  time: string;
  /** true เมื่อเป็นวันเปลี่ยนเดือน BaZi (節) */
  isMonthChange: boolean;
};

// 節 (สารทใหญ่) เริ่มเดือน BaZi ของกิ่งเดือน
const MAJOR_BY_BRANCH: Record<string, string> = {
  寅: "立春", 卯: "惊蛰", 辰: "清明", 巳: "立夏", 午: "芒种", 未: "小暑",
  申: "立秋", 酉: "白露", 戌: "寒露", 亥: "立冬", 子: "大雪", 丑: "小寒",
};
// 中氣 (สารทเล็ก) กลางเดือน BaZi ของกิ่งเดือน
const MINOR_BY_BRANCH: Record<string, string> = {
  寅: "雨水", 卯: "春分", 辰: "谷雨", 巳: "小满", 午: "夏至", 未: "大暑",
  申: "处暑", 酉: "秋分", 戌: "霜降", 亥: "小雪", 子: "冬至", 丑: "大寒",
};

const MAJOR_TERMS = new Set(Object.values(MAJOR_BY_BRANCH));

/** ชื่อไทย/ทับศัพท์ + คำอธิบายของ 24 สารท (ใช้แสดงผล + อ้างใน special-days) */
export const SOLAR_TERM_TH: Record<string, string> = {
  立春: "ลี่ชุน (เริ่มใบไม้ผลิ)", 雨水: "หวี่สุ่ย (ฝนใส)",
  惊蛰: "จิงเจ๋อ (สัตว์ตื่นจำศีล)", 春分: "ชุนเฟิน (วสันตวิษุวัต)",
  清明: "ชิงหมิง (เช็งเม้ง)", 谷雨: "กู่หวี่ (ฝนข้าว)",
  立夏: "ลี่เซี่ย (เริ่มฤดูร้อน)", 小满: "เสี่ยวหมั่น",
  芒种: "หมางจ้ง", 夏至: "เซี่ยจื้อ (ครีษมายัน)",
  小暑: "เสี่ยวสู่", 大暑: "ต้าสู่",
  立秋: "ลี่ชิว (เริ่มใบไม้ร่วง)", 处暑: "ฉู่สู่",
  白露: "ไป๋ลู่", 秋分: "ชิวเฟิน (ศารทวิษุวัต)",
  寒露: "หานลู่", 霜降: "ซวงเจี้ยง",
  立冬: "ลี่ตง (เริ่มฤดูหนาว)", 小雪: "เสี่ยวเสวี่ย",
  大雪: "ต้าเสวี่ย", 冬至: "ตงจื้อ (เหมายัน/ตังโจ่ย)",
  小寒: "เสี่ยวหาน", 大寒: "ต้าหาน",
};

type RawEntry = {
  month_pillar: string;
  start_day: string | null; start_month: string | null; start_time: string | null;
  small_start_day: string | null; small_start_month: string | null; small_start_time: string | null;
};

const RAW = solarTermsJson as unknown as Record<string, Record<string, RawEntry>>;

const pad2 = (n: number | string) => String(n).padStart(2, "0");
const dateKey = (y: number, m: number | string, d: number | string) => `${y}-${pad2(m)}-${pad2(d)}`;

function mark(name: string, kind: SolarTermKind, time: string): SolarTermMark {
  return { kind, name, nameTh: SOLAR_TERM_TH[name] ?? name, time, isMonthChange: kind === "major" };
}

// ----- ตารางจากไฟล์ 150 ปี (สร้างครั้งเดียวตอนโหลดโมดูล) -----
const FILE_MAP = new Map<string, SolarTermMark>();
let FILE_MIN_CE = Infinity;
let FILE_MAX_CE = -Infinity;
for (const [be, months] of Object.entries(RAW)) {
  const ce = Number(be) - 543;
  if (!Number.isFinite(ce)) continue;
  FILE_MIN_CE = Math.min(FILE_MIN_CE, ce);
  FILE_MAX_CE = Math.max(FILE_MAX_CE, ce);
  for (const e of Object.values(months)) {
    const branch = e.month_pillar ? splitGanZhi(e.month_pillar).branch : "";
    if (e.start_day && e.start_month && MAJOR_BY_BRANCH[branch]) {
      FILE_MAP.set(dateKey(ce, e.start_month, e.start_day), mark(MAJOR_BY_BRANCH[branch], "major", e.start_time ?? ""));
    }
    if (e.small_start_day && e.small_start_month && MINOR_BY_BRANCH[branch]) {
      const k = dateKey(ce, e.small_start_month, e.small_start_day);
      if (!FILE_MAP.has(k)) FILE_MAP.set(k, mark(MINOR_BY_BRANCH[branch], "minor", e.small_start_time ?? ""));
    }
  }
}

// ----- fallback คำนวณ (นอกช่วงไฟล์) memoize ต่อปี ค.ศ. -----
const COMPUTED = new Map<number, Map<string, SolarTermMark>>();
function computedYear(year: number): Map<string, SolarTermMark> {
  const cached = COMPUTED.get(year);
  if (cached) return cached;
  const map = new Map<string, SolarTermMark>();
  try {
    for (const term of buildGregorianYearSolarTerms(year)) {
      // boundaryAtLocal = "YYYY-MM-DD HH:MM:SS"
      const [datePart, timePart = "00:00:00"] = term.boundaryAtLocal.split(" ");
      const [, m, d] = datePart.split("-");
      const time = timePart.slice(0, 5);
      const kind: SolarTermKind = MAJOR_TERMS.has(term.name) ? "major" : "minor";
      map.set(dateKey(year, m, d), mark(term.name, kind, time));
    }
  } catch {
    /* lunar-javascript รองรับ 1900–2100 เท่านั้น — นอกช่วงคืน map ว่าง */
  }
  COMPUTED.set(year, map);
  return map;
}

/** ขอบสารทของวันที่ (ค.ศ.) — null ถ้าไม่ใช่วันสารท */
export function solarTermFor(year: number, month: number, day: number): SolarTermMark | null {
  if (year >= FILE_MIN_CE && year <= FILE_MAX_CE) {
    return FILE_MAP.get(dateKey(year, month, day)) ?? null;
  }
  return computedYear(year).get(dateKey(year, month, day)) ?? null;
}
