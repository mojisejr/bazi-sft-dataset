/**
 * Engine ปฏิทินโหราศาสตร์ (ManvsDay almanac) — รองรับ "ทุกปี" (อดีต/อนาคต)
 *
 * เสาวัน/เดือน/ปี คำนวณจาก lunar-javascript (มิเรอร์ symbolic-engine.birth.ts) จึงได้ทุกปี
 * โดยขอบเขตเดือน BaZi อิงสารทจริง. ชั้นความหมายทั้งหมด lookup จากตารางที่สกัดไว้
 * (src/lib/bazi/data/almanac/*.json — สร้างด้วย scripts/extract-almanac-tables.py).
 *
 * เกือบทุกชั้น (gates/八神/สี/เวลา/เทพ/ทิศ/อุปถัมป์/คะแนน) ขึ้นกับคีย์ (เสาวัน × month-branch)
 * → อ่านจาก day-month-table ก่อน, fallback day-pillar-table (เดือน autumn 申酉戌亥 ที่ต้นฉบับไม่มี).
 * ทิศอสูร (วัน/เดือน/ปี) derive จากกฎ 三煞 ตาม branch → ได้ทุกปี.
 */
import { createRequire } from "node:module";

import {
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
  GENERATES,
  CONTROLS,
} from "@/lib/bazi/symbolic-engine.constants";

import { splitGanZhi } from "@/lib/bazi/symbolic-engine.birth";

import dayTableJson from "@/lib/bazi/data/almanac/day-pillar-table.json";
import dayMonthTableJson from "@/lib/bazi/data/almanac/day-month-table.json";
import monthTableJson from "@/lib/bazi/data/almanac/month-pillar-table.json";
import spiritLegendJson from "@/lib/bazi/data/almanac/spirit-legend.json";
import gateLegendJson from "@/lib/bazi/data/almanac/gate-legend.json";
import hourGodLegendJson from "@/lib/bazi/data/almanac/hour-god-legend.json";

import type {
  AlmanacDay,
  AlmanacMonth,
  AlmanacYear,
  AlmanacRecord,
  AsuraDirections,
  ColorInfo,
  GateInfo,
  LuckyHour,
  MonthInfo,
  PatronInfo,
  Pillar,
  SpiritInfo,
  StrengthScore,
} from "@/lib/bazi/almanac/types";

const require = createRequire(import.meta.url);

type SolarInstance = {
  getWeek(): number;
  getLunar(): { getEightChar(): EightCharLike };
};
type EightCharLike = {
  getYear(): string;
  getMonth(): string;
  getDay(): string;
};
type SolarConstructor = {
  fromYmdHms(y: number, m: number, d: number, h: number, mi: number, s: number): SolarInstance;
};

const { Solar } = require("lunar-javascript") as { Solar: SolarConstructor };

const DAY_TABLE = dayTableJson as unknown as Record<string, AlmanacRecord>;
const DAY_MONTH_TABLE = dayMonthTableJson as unknown as Record<string, AlmanacRecord>;
const MONTH_TABLE = monthTableJson as unknown as Record<
  string,
  { deity: string | null; caishen_dir: string | null; lap_dir: string | null }
>;
const SPIRIT_LEGEND = spiritLegendJson as Record<string, string[]>;
const GATE_LEGEND = gateLegendJson as Record<string, string>;
const HOUR_GOD_LEGEND = hourGodLegendJson as Record<
  string,
  { god: string | null; meaning: string | null; score: number | null; good: boolean }
>;

const WEEKDAYS_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"] as const;

const D_GROUP_INDEX = [2, 3, 4, 5]; // คอลัมน์กลุ่ม D (กำลังดิถีวัน)

// 三煞 (ทิศอสูร) ตามไตรภาคีกิ่ง → ทิศตรงข้ามธาตุไตรภาคี
const SANSHA_DIR: Record<string, string> = {
  申: "S", 子: "S", 辰: "S", // ไตรภาคีน้ำ → ใต้
  寅: "N", 午: "N", 戌: "N", // ไตรภาคีไฟ → เหนือ
  巳: "E", 酉: "E", 丑: "E", // ไตรภาคีทอง → ตะวันออก
  亥: "W", 卯: "W", 未: "W", // ไตรภาคีไม้ → ตะวันตก
};

function asuraOf(branch: string): string {
  const dir = SANSHA_DIR[branch];
  return dir ? `ทิศ ${dir}` : "";
}

// ----- เวลามงคล: กฎ 黃道 (12 時辰) -----
const BRANCH_ORDER12 = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
const HOUR_RANGE: Record<string, string> = {
  子: "23:00-00:59", 丑: "1:00-2:59", 寅: "3:00-4:59", 卯: "5:00-6:59",
  辰: "7:00-8:59", 巳: "9:00-10:59", 午: "11:00-12:59", 未: "13:00-14:59",
  申: "15:00-16:59", 酉: "17:00-18:59", 戌: "19:00-20:59", 亥: "21:00-22:59",
};
// 青龍 起 時辰 ตามกิ่งวัน (derive จากต้นฉบับ ตรง 100%)
const QINGLONG_START: Record<string, string> = {
  子: "申", 午: "申", 丑: "戌", 未: "戌", 寅: "子", 申: "子",
  卯: "寅", 酉: "寅", 辰: "辰", 戌: "辰", 巳: "午", 亥: "午",
};
// ลำดับ 12 เทพยาม → B-code (青龍,明堂,天刑,朱雀,金匱,天德,白虎,玉堂,天牢,玄武,司命,勾陳)
const HOUR_GOD_CODES = ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "B11", "B12"];

/** 5 ยามมงคล (黃道) ของวัน ตามกิ่งวัน — คำนวณได้ทุกปี */
function luckyHoursByDayBranch(dayBranch: string): LuckyHour[] {
  const start = BRANCH_ORDER12.indexOf(QINGLONG_START[dayBranch] as (typeof BRANCH_ORDER12)[number]);
  if (start < 0) return [];
  const out: LuckyHour[] = [];
  for (let i = 0; i < 12; i += 1) {
    const code = HOUR_GOD_CODES[i];
    const info = HOUR_GOD_LEGEND[code];
    if (!info?.good) continue;
    const branch = BRANCH_ORDER12[(start + i) % 12];
    out.push({
      code,
      branch,
      range: HOUR_RANGE[branch],
      god: info.god ?? "",
      meaning: info.meaning ?? "",
    });
  }
  // เรียงตามลำดับ 時辰 (子→亥) ให้อ่านง่าย
  return out.sort((a, b) => BRANCH_ORDER12.indexOf(a.branch as (typeof BRANCH_ORDER12)[number]) - BRANCH_ORDER12.indexOf(b.branch as (typeof BRANCH_ORDER12)[number]));
}


function toPillar(ganzhi: string): Pillar {
  const { stem, branch } = splitGanZhi(ganzhi);
  return {
    stem,
    branch,
    ganzhi: `${stem}${branch}`,
    element: (STEM_TO_ELEMENT as Record<string, string>)[stem] ?? "",
  };
}

/**
 * เสาวัน/เดือน/ปี (BaZi) ของวันที่ตามปฏิทินสากล
 * - เสาวัน + วันในสัปดาห์: ประเมินตอนเที่ยง (กัน edge ยาม子)
 * - เสาเดือน/ปี: ประเมินตอน 00:00 (ต้นวัน) — ตรงกับ convention ของปฏิทินต้นฉบับ
 *   คือ "วันที่สารทตก ยังนับเป็นเดือนเก่า เปลี่ยนเดือนวันถัดไป" (verified 212/212)
 *   จึงแก้ปัญหาทิศอสูรเดือน/ปี ที่ขอบสารท โดยไม่ต้องพึ่งตาราง 2450-2600
 */
export function pillarsForDate(year: number, month: number, day: number) {
  const noon = Solar.fromYmdHms(year, month, day, 12, 0, 0);
  const startOfDay = Solar.fromYmdHms(year, month, day, 0, 0, 0).getLunar().getEightChar();
  return {
    weekday: WEEKDAYS_TH[noon.getWeek()] ?? "",
    dayPillar: toPillar(noon.getLunar().getEightChar().getDay()),
    monthPillar: toPillar(startOfDay.getMonth()),
    yearPillar: toPillar(startOfDay.getYear()),
  };
}

/** โมเดลฤดู 旺相休囚死: กำลังก้านวันเทียบธาตุประจำฤดู (month-branch) — fallback เดือน autumn */
function seasonalStrength(dayStem: string, monthBranch: string): number {
  const d = (STEM_TO_ELEMENT as Record<string, string>)[dayStem];
  const s = (BRANCH_TO_ELEMENT as Record<string, string>)[monthBranch];
  if (!d || !s) return 50;
  if (d === s) return 100; // 旺
  if ((GENERATES as Record<string, string>)[s] === d) return 80; // 相
  if ((GENERATES as Record<string, string>)[d] === s) return 40; // 休
  if ((CONTROLS as Record<string, string>)[d] === s) return 20; // 囚
  if ((CONTROLS as Record<string, string>)[s] === d) return 10; // 死
  return 50;
}

function buildStrength(rec: AlmanacRecord | null, dayStem: string, monthBranch: string): StrengthScore {
  let values: number[];
  let max: number[];
  let exact: boolean;
  if (rec && rec.scores && rec.scores.some((v) => v > 0)) {
    values = rec.scores;
    max = rec.max;
    exact = true;
  } else {
    const s = seasonalStrength(dayStem, monthBranch);
    values = [0, 0, s, s, s, s, s, s, s, s, s, s];
    max = [0, 0, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
    exact = false;
  }
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const sumMax = sum(max) || 1;
  const dSum = D_GROUP_INDEX.reduce((a, i) => a + (values[i] ?? 0), 0);
  const dMax = D_GROUP_INDEX.reduce((a, i) => a + (max[i] ?? 0), 0) || 1;
  return {
    values,
    max,
    ratioTotal: Math.round((sum(values) / sumMax) * 100) / 100,
    ratioDay: Math.round((dSum / dMax) * 100) / 100,
    exact,
  };
}

function toColors(pair: [string | null, string | null] | null | undefined): ColorInfo | null {
  if (!pair || !pair[0]) return null;
  return { element: pair[0], colors: pair[1] ?? "" };
}

function toPatrons(raw: AlmanacRecord["patrons"]): PatronInfo[] {
  if (!raw) return [];
  return raw
    .filter((p) => p && p[0])
    .map((p) => ({ branch: p[0] ?? "", number: typeof p[1] === "number" ? p[1] : null, zodiac: p[2] ?? "" }));
}

function toGates(raw: AlmanacRecord["gates"]): GateInfo[] {
  if (!raw) return [];
  return raw
    .filter((g) => g && g[0])
    .map((g) => ({ name: g[0] ?? "", direction: g[1] ?? "", meaning: GATE_LEGEND[g[0] ?? ""] ?? null }));
}

function toSpirits(raw: AlmanacRecord["spirits"]): SpiritInfo[] {
  if (!raw) return [];
  return raw
    .filter((s): s is string => Boolean(s))
    .map((name) => ({ name, keywords: SPIRIT_LEGEND[name] ?? [] }));
}

/** ประกอบข้อมูลปฏิทิน 1 วัน */
export function buildAlmanacDay(year: number, month: number, day: number): AlmanacDay {
  const { weekday, dayPillar, monthPillar, yearPillar } = pillarsForDate(year, month, day);
  const m = DAY_MONTH_TABLE[`${dayPillar.ganzhi}|${monthPillar.branch}`] ?? null; // ตรงตามฤดู (exact)
  const d = DAY_TABLE[dayPillar.ganzhi] ?? null; // fallback
  const rec = m ?? d;

  const colors = [toColors(rec?.color_primary), toColors(rec?.color_secondary)].filter(
    (c): c is ColorInfo => c !== null,
  );

  const monthRec = MONTH_TABLE[monthPillar.ganzhi];
  const monthInfo: MonthInfo = {
    deity: monthRec?.deity ?? null,
    caishenDir: monthRec?.caishen_dir ?? null,
    lapDir: monthRec?.lap_dir ?? null,
  };

  const asura: AsuraDirections = {
    day: asuraOf(dayPillar.branch),
    month: asuraOf(monthPillar.branch),
    year: asuraOf(yearPillar.branch),
  };

  return {
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    yearBE: year + 543,
    weekday,
    dayPillar,
    monthPillar,
    yearPillar,
    officer: rec?.officer ?? null,
    officerDesc: rec?.officer_desc ?? null,
    deities: (rec?.deities && rec.deities.length
      ? rec.deities
      : [rec?.deity].filter((x): x is string => Boolean(x))),
    deity: rec?.deity ?? null,
    deityKey: rec?.deity_key ?? null,
    colors,
    luckyDirection: rec?.lucky_dir ?? null,
    asura,
    patrons: toPatrons(rec?.patrons),
    gates: toGates(rec?.gates),
    spirits: toSpirits(rec?.spirits),
    // เวลามงคล: คำนวณกฎ 黃道 จากกิ่งวัน (ถูกต้องทุกปี ไม่พึ่งตารางสกัด)
    luckyHours: luckyHoursByDayBranch(dayPillar.branch),
    monthInfo,
    strength: buildStrength(m, dayPillar.stem, monthPillar.branch),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** ปฏิทิน 1 เดือน (ปฏิทินสากล) ของปี ค.ศ. */
export function buildAlmanacMonth(year: number, month: number): AlmanacMonth {
  const days: AlmanacDay[] = [];
  for (let dd = 1; dd <= daysInMonth(year, month); dd += 1) {
    days.push(buildAlmanacDay(year, month, dd));
  }
  return { yearBE: year + 543, month, days };
}

/** ปฏิทินทั้งปี — รับปี พ.ศ. (เช่น 2569) เหมือนชื่อไฟล์ต้นฉบับ */
export function buildAlmanacYear(yearBE: number): AlmanacYear {
  const yearCE = yearBE - 543;
  const months: AlmanacMonth[] = [];
  for (let m = 1; m <= 12; m += 1) {
    months.push(buildAlmanacMonth(yearCE, m));
  }
  return { yearBE, months };
}
