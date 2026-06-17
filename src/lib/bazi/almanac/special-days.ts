/**
 * คลังวันสำคัญ 6 หมวด (resolver) — วันพระจีน, ศาสนา, ราชการ, เทศกาลไทย/จีน
 *
 * ข้อมูล: src/lib/bazi/data/almanac/special-days.json (แก้ออนไลน์ได้ผ่าน rule-table override เฟส E)
 * ชนิดกฎ: gregorian, gregorian-range, nth-weekday, thai-lunar, thai-buddhist-holiday,
 *         chinese-lunar, chinese-lunar-recurring, solar-term
 * - thai-lunar / thai-buddhist-holiday: ใช้ปฏิทินจันทรคติไทยจริง (thai-lunar.ts)
 * - chinese-lunar*: ใช้จันทร์จีนจาก lunar-javascript (初一/十五 ฯลฯ)
 * - solar-term: ผูกกับขอบสารท (เช็งเม้ง 清明 / ตังโจ่ย 冬至)
 */
import { createRequire } from "node:module";

import specialDaysJson from "@/lib/bazi/data/almanac/special-days.json";
import { thaiBuddhistHolidayFor, gregorianToJDN } from "@/lib/bazi/thai-lunar";

import type { ThaiLunarInfo, SolarTermInfo } from "@/lib/bazi/almanac/types";

const require = createRequire(import.meta.url);
type LunarLike = { getMonth(): number; getDay(): number };
type SolarLike = { getLunar(): LunarLike };
type SolarCtor = { fromYmd(y: number, m: number, d: number): SolarLike };
const { Solar } = require("lunar-javascript") as { Solar: SolarCtor };

export type SpecialDayCategory =
  | "religion"
  | "government"
  | "festival-thai"
  | "festival-chinese"
  | "chinese-religious"
  | "thai-buddhist";

export type SpecialDay = {
  id: string;
  name: string;
  category: SpecialDayCategory;
};

export const SPECIAL_DAY_CATEGORY_LABEL: Record<SpecialDayCategory, string> = {
  religion: "วันสำคัญศาสนา",
  government: "วันสำคัญราชการ",
  "festival-thai": "เทศกาลไทย",
  "festival-chinese": "เทศกาลจีน",
  "chinese-religious": "วันพระจีน",
  "thai-buddhist": "วันพระไทย",
};

type Rule =
  | { type: "gregorian"; month: number; day: number }
  | { type: "gregorian-range"; month: number; dayStart: number; dayEnd: number }
  | { type: "nth-weekday"; month: number; weekday: number; nth: number }
  | { type: "thai-lunar"; lunarMonth: number; phase: "ขึ้น" | "แรม"; kham: number }
  | { type: "thai-buddhist-holiday" }
  | { type: "chinese-lunar"; lunarMonth: number; lunarDay: number }
  | { type: "chinese-lunar-recurring"; lunarDays: number[] }
  | { type: "solar-term"; name: string };

type Entry = { id: string; name: string; category: SpecialDayCategory; rule: Rule };

const REGISTRY = specialDaysJson as unknown as Entry[];

/** วันในสัปดาห์ 0=อาทิตย์..6=เสาร์ */
const dow = (y: number, m: number, d: number) => (gregorianToJDN(y, m, d) + 1) % 7;

type ChineseLunar = { month: number; day: number; isLeap: boolean };
function chineseLunarOf(year: number, month: number, day: number): ChineseLunar {
  const lunar = Solar.fromYmd(year, month, day).getLunar();
  const m = lunar.getMonth(); // ติดลบเมื่อเป็นเดือนอธิกมาสจีน
  return { month: Math.abs(m), day: lunar.getDay(), isLeap: m < 0 };
}

export type SpecialDayContext = {
  thaiLunar: ThaiLunarInfo;
  solarTerm: SolarTermInfo | null;
};

/** วันสำคัญทั้งหมดของวันที่ (ค.ศ.) — ส่ง registry เองได้ (เช่นจาก override) */
export function specialDaysFor(
  year: number,
  month: number,
  day: number,
  ctx: SpecialDayContext,
  registry: readonly { id: string; name: string; category: string; rule: unknown }[] = REGISTRY,
): SpecialDay[] {
  const out: SpecialDay[] = [];
  let cl: ChineseLunar | null = null;
  const getCL = () => (cl ??= chineseLunarOf(year, month, day));

  for (const entryRaw of registry) {
    const entry = entryRaw as unknown as Entry;
    const r = entry.rule;
    let matched = false;
    let name = entry.name;
    switch (r.type) {
      case "gregorian":
        matched = r.month === month && r.day === day;
        break;
      case "gregorian-range":
        matched = r.month === month && day >= r.dayStart && day <= r.dayEnd;
        break;
      case "nth-weekday":
        matched = r.month === month && dow(year, month, day) === r.weekday && Math.ceil(day / 7) === r.nth;
        break;
      case "thai-lunar":
        matched =
          !ctx.thaiLunar.isLeapMonth &&
          ctx.thaiLunar.lunarMonth === r.lunarMonth &&
          ctx.thaiLunar.phase === r.phase &&
          ctx.thaiLunar.kham === r.kham;
        break;
      case "thai-buddhist-holiday": {
        const h = thaiBuddhistHolidayFor(year, month, day);
        if (h) {
          matched = true;
          name = h;
        }
        break;
      }
      case "chinese-lunar": {
        const c = getCL();
        matched = !c.isLeap && c.month === r.lunarMonth && c.day === r.lunarDay;
        break;
      }
      case "chinese-lunar-recurring": {
        const c = getCL();
        matched = r.lunarDays.includes(c.day);
        break;
      }
      case "solar-term":
        matched = ctx.solarTerm?.name === r.name;
        break;
    }
    if (matched) out.push({ id: entry.id, name, category: entry.category });
  }
  return out;
}
