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

import { STEM_TO_ELEMENT } from "@/lib/bazi/symbolic-engine.constants";

import { splitGanZhi } from "@/lib/bazi/symbolic-engine.birth";

import dayTableJson from "@/lib/bazi/data/almanac/day-pillar-table.json";
import dayMonthTableJson from "@/lib/bazi/data/almanac/day-month-table.json";
import monthTableJson from "@/lib/bazi/data/almanac/month-pillar-table.json";
import yearTableJson from "@/lib/bazi/data/almanac/year-pillar-table.json";
import spiritLegendJson from "@/lib/bazi/data/almanac/spirit-legend.json";
import gateLegendJson from "@/lib/bazi/data/almanac/gate-legend.json";
import hourGodLegendJson from "@/lib/bazi/data/almanac/hour-god-legend.json";
import stageLegendJson from "@/lib/bazi/data/almanac/stage-legend.json";
import jianchuLegendJson from "@/lib/bazi/data/almanac/jianchu-legend.json";
import dayStarsJson from "@/lib/bazi/data/almanac/day-stars.json";

import { solarTermFor } from "@/lib/bazi/almanac/solar-terms-data";
import { thaiLunarDay } from "@/lib/bazi/thai-lunar";
import { specialDaysFor } from "@/lib/bazi/almanac/special-days";

import type { AlmanacOverrides } from "@/lib/bazi/almanac/almanac-override-repository";

import type {
  AlmanacDay,
  AlmanacMonth,
  AlmanacYear,
  AlmanacRecord,
  AsuraDirections,
  ColorInfo,
  DayStar,
  GateInfo,
  LuckyHour,
  MonthInfo,
  PatronInfo,
  Pillar,
  SpiritInfo,
  StrengthScore,
  YearInfo,
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
  { deity: string | null; caishen_dir: string | null; lap_dir: string | null; asura_dir?: string | null; spirit_dirs?: [string, string][] }
>;
const YEAR_TABLE = yearTableJson as unknown as Record<
  string,
  { asura_dir?: string | null; caishen_dir?: string | null; lap_dir?: string | null; deity?: string | null; spirit_dirs?: [string, string][] }
>;
const GATE_SET = new Set("開休生傷杜景死驚");
const SPIRIT_SET = new Set("天地玄虎合陰蛇符陳雀");
const SPIRIT_LEGEND = spiritLegendJson as Record<string, string[]>;
const GATE_LEGEND = gateLegendJson as Record<string, string>;
const HOUR_GOD_LEGEND = hourGodLegendJson as Record<
  string,
  { god: string | null; meaning: string | null; score: number | null; good: boolean }
>;
const STAGE_LEGEND = stageLegendJson as Record<string, { name: string; score: number }>;
const JIANCHU_LEGEND = jianchuLegendJson as Record<
  string,
  { name: string; score: number | string; meaning?: string; activity?: string }
>;
type DayStarRow = {
  id: string;
  name: string;
  polarity: "good" | "bad";
  activity: string | null;
  /** ตัวกระตุ้นต่อกิ่งเดือน: ก้านวัน / กิ่งวัน / หรือเสาวันเต็ม (กิ่ง+ก้าน เช่น 戊寅 = 天赦) */
  triggers: Record<string, string[]>;
  note?: string | null;
};
const DAY_STARS = dayStarsJson as DayStarRow[];

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

// ----- กฎคะแนนทางการ (ฤกษ์ยามเคี้ยงคุง) สำหรับเดือน autumn ที่ต้นฉบับ ปฏิทิน2569 ไม่มี -----
const YANG_STEMS = new Set(["甲", "丙", "戊", "庚", "壬"]);
// 长生 起 กิ่ง ต่อก้าน (จับหยี่เซี่ยงแซ ยืนยัน)
const CHANGSHENG_START: Record<string, string> = {
  甲: "亥", 乙: "午", 丙: "寅", 丁: "酉", 戊: "寅",
  己: "酉", 庚: "巳", 辛: "子", 壬: "申", 癸: "卯",
};
const bIdx = (b: string) => BRANCH_ORDER12.indexOf(b as (typeof BRANCH_ORDER12)[number]);

function resolveScore(v: number | string | null | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.includes("/")) {
    const parts = v.split("/").map(Number).filter((n) => !Number.isNaN(n));
    return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0; // '30/70' -> 50
  }
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

/** 十二長生 stage score ของ (ก้าน @ กิ่ง) — A1=長生..A12=養 */
export function lifeStageScore(stem: string, branch: string): number {
  const start = bIdx(CHANGSHENG_START[stem]);
  if (start < 0) return 0;
  const step = YANG_STEMS.has(stem) ? 1 : -1;
  const idx = (((bIdx(branch) - start) * step) % 12 + 12) % 12; // 0=長生..11=養
  return resolveScore(STAGE_LEGEND[`A${idx + 1}`]?.score);
}

/** 黃道 B-score ของ (ฐานกิ่ง → เป้ากิ่ง) — 青龍 起 ที่ QINGLONG_START(ฐาน) */
export function huangdaoScore(baseBranch: string, targetBranch: string): number {
  const start = bIdx(QINGLONG_START[baseBranch]);
  if (start < 0) return 0;
  const idx = ((bIdx(targetBranch) - start) % 12 + 12) % 12; // 0=青龍(B1)..11=勾陳(B12)
  return resolveScore(HOUR_GOD_LEGEND[`B${idx + 1}`]?.score);
}

/** 建除 C-index ของ (กิ่งเดือน → กิ่งวัน) — 0=建(C1)..11=閉(C12) */
function jianchuIndex(monthBranch: string, dayBranch: string): number {
  return ((bIdx(dayBranch) - bIdx(monthBranch)) % 12 + 12) % 12;
}

/** 建除 C-score ของ (กิ่งเดือน → กิ่งวัน) — 建 ที่กิ่งเดือน */
function jianchuScore(monthBranch: string, dayBranch: string): number {
  return resolveScore(JIANCHU_LEGEND[`C${jianchuIndex(monthBranch, dayBranch) + 1}`]?.score);
}

/** 建除 ชื่อ + ความหมาย ของ (กิ่งเดือน → กิ่งวัน) */
function jianchuInfo(monthBranch: string, dayBranch: string): { name: string; meaning: string } | null {
  const rec = JIANCHU_LEGEND[`C${jianchuIndex(monthBranch, dayBranch) + 1}`];
  if (!rec) return null;
  return { name: rec.name, meaning: rec.meaning ?? "" };
}

/**
 * ดาวประจำวัน (ชุดใหม่ day-stars) ที่เข้าเกณฑ์ของวัน
 * คีย์ตามกิ่งเดือน → ตัวกระตุ้นซึ่งจับได้ 3 แบบ: ก้านวัน / กิ่งวัน / เสาวันเต็ม (กิ่ง+ก้าน เช่น 戊寅)
 */
function dayStarsFor(
  stars: DayStarRow[],
  monthBranch: string,
  dayStem: string,
  dayBranch: string,
  dayGanzhi: string,
): DayStar[] {
  const out: DayStar[] = [];
  for (const star of stars) {
    const trig = star.triggers[monthBranch];
    if (trig && (trig.includes(dayStem) || trig.includes(dayBranch) || trig.includes(dayGanzhi))) {
      out.push({ name: star.name, activity: star.activity, polarity: star.polarity });
    }
  }
  return out;
}

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

/**
 * คะแนน D-group (O,P,Q,R) จากกฎทางการ — ใช้กับเดือน autumn ที่ ปฏิทิน2569 ไม่มีค่าสกัด
 * O=長生(ก้านวัน@กิ่งวัน), P=黃道(กิ่งเดือน→กิ่งวัน), Q=黃道(กิ่งปี→กิ่งวัน), R=建除(กิ่งเดือน→กิ่งวัน)
 * (O มี ±5 ปรับมือของซินแสซึ่งไม่อยู่ในไฟล์ → P/Q/R เป๊ะ, O ใช้ stage legend)
 */
function ruleDGroup(p: { dayStem: string; dayBranch: string; monthBranch: string; yearBranch: string }): number[] {
  return [
    lifeStageScore(p.dayStem, p.dayBranch),
    huangdaoScore(p.monthBranch, p.dayBranch),
    huangdaoScore(p.yearBranch, p.dayBranch),
    jianchuScore(p.monthBranch, p.dayBranch),
  ];
}

function buildStrength(
  rec: AlmanacRecord | null,
  p: { dayStem: string; dayBranch: string; monthBranch: string; yearBranch: string },
): StrengthScore {
  let values: number[];
  let max: number[];
  let exact: boolean;
  if (rec && rec.scores && rec.scores.some((v) => v > 0)) {
    values = rec.scores;
    max = rec.max;
    exact = true;
  } else {
    // เดือน autumn: คำนวณ D-group จากกฎทางการ (E แม่น); DM/M/Y ยังไม่มีกฎครบ -> 0
    const d = ruleDGroup(p);
    values = [0, 0, d[0], d[1], d[2], d[3], 0, 0, 0, 0, 0, 0];
    max = [0, 0, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0];
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

/** ประกอบข้อมูลปฏิทิน 1 วัน (overrides = แก้กฎ/รายวันจาก DB; ไม่ส่ง = ใช้กฎฐาน) */
export function buildAlmanacDay(
  year: number,
  month: number,
  day: number,
  overrides?: AlmanacOverrides,
): AlmanacDay {
  const { weekday, dayPillar, monthPillar, yearPillar } = pillarsForDate(year, month, day);
  const m = DAY_MONTH_TABLE[`${dayPillar.ganzhi}|${monthPillar.branch}`] ?? null; // ตรงตามฤดู (exact)
  const d = DAY_TABLE[dayPillar.ganzhi] ?? null; // fallback
  const rec = m ?? d;
  // กัน gates/spirits เพี้ยน (บางเสาคอลัมน์เลื่อนตอนสกัด) → fallback ไป day-pillar-table
  const gatesOk = (g: AlmanacRecord["gates"]) => !!g && g.length > 0 && g.every((x) => x && x[0] && GATE_SET.has(x[0]));
  const spiritsOk = (s: AlmanacRecord["spirits"]) => !!s && s.length > 0 && s.every((x) => x && SPIRIT_SET.has(x));
  const gateRec = gatesOk(m?.gates) ? m : (gatesOk(d?.gates) ? d : rec);
  const spiritRec = spiritsOk(m?.spirits) ? m : (spiritsOk(d?.spirits) ? d : rec);

  const colors = [toColors(rec?.color_primary), toColors(rec?.color_secondary)].filter(
    (c): c is ColorInfo => c !== null,
  );

  const monthRec = MONTH_TABLE[monthPillar.ganzhi];
  const monthInfo: MonthInfo = {
    deity: monthRec?.deity ?? null,
    caishenDir: monthRec?.caishen_dir ?? null,
    lapDir: monthRec?.lap_dir ?? null,
    asuraDir: monthRec?.asura_dir ?? (asuraOf(monthPillar.branch) || null),
    spiritDirs: monthRec?.spirit_dirs ?? null,
  };

  // ระดับปี: อสูรปีคำนวณได้ทุกปี (三煞); ไฉ่ซิ้ง/โชคลาภ/เทพประจำปี = lookup (มีเท่าที่กรอกใน year-pillar-table)
  const yearRec = YEAR_TABLE[yearPillar.ganzhi];
  const yearInfo: YearInfo = {
    pillar: yearPillar.ganzhi,
    asuraDir: asuraOf(yearPillar.branch) || null,
    caishenDir: yearRec?.caishen_dir ?? null,
    lapDir: yearRec?.lap_dir ?? null,
    deity: yearRec?.deity ?? null,
    spiritDirs: yearRec?.spirit_dirs ?? null,
  };

  const asura: AsuraDirections = {
    day: asuraOf(dayPillar.branch),
    month: asuraOf(monthPillar.branch),
    year: asuraOf(yearPillar.branch),
  };

  const solarTerm = solarTermFor(year, month, day);
  const thaiLunar = thaiLunarDay(year, month, day);
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const specialDays = specialDaysFor(year, month, day, { thaiLunar, solarTerm }, overrides?.specialDays);

  const day_: AlmanacDay = {
    date: dateStr,
    yearBE: year + 543,
    weekday,
    dayPillar,
    monthPillar,
    yearPillar,
    officer: rec?.officer ?? null,
    officerDesc: rec?.officer_desc ?? null,
    jianchu: jianchuInfo(monthPillar.branch, dayPillar.branch),
    deities: (rec?.deities && rec.deities.length
      ? rec.deities
      : [rec?.deity].filter((x): x is string => Boolean(x))),
    deity: rec?.deity ?? null,
    deityKey: rec?.deity_key ?? null,
    colors,
    luckyDirection: rec?.lucky_dir ?? null,
    asura,
    patrons: toPatrons(rec?.patrons),
    gates: toGates(gateRec?.gates),
    spirits: toSpirits(spiritRec?.spirits),
    // เวลามงคล: คำนวณกฎ 黃道 จากกิ่งวัน (ถูกต้องทุกปี ไม่พึ่งตารางสกัด)
    luckyHours: luckyHoursByDayBranch(dayPillar.branch),
    monthInfo,
    yearInfo,
    // ดาวประจำวัน (ชุดใหม่): คีย์ตามกิ่งเดือน → ตัวกระตุ้นของวัน (กิ่ง/ก้าน/เสาวันเต็ม)
    dayStars: dayStarsFor(overrides?.dayStars ?? DAY_STARS, monthPillar.branch, dayPillar.stem, dayPillar.branch, dayPillar.ganzhi),
    // ขอบสารท (ปฏิทิน 150 ปี): null = ไม่ใช่วันสารท
    solarTerm,
    // จันทรคติไทย (ขึ้น/แรม ค่ำ เดือน + วันพระ)
    thaiLunar,
    // วันสำคัญ 6 หมวด
    specialDays,
    // หมายเหตุที่ผู้ใช้แก้รายวัน (override) — null ถ้าไม่มี
    note: null,
    strength: buildStrength(m, {
      dayStem: dayPillar.stem,
      dayBranch: dayPillar.branch,
      monthBranch: monthPillar.branch,
      yearBranch: yearPillar.branch,
    }),
  };

  // แก้รายวันแบบ generic: patch ทับ "ฟิลด์ใดก็ได้" ของวันนั้น (officer/deities/colors/…)
  const patch = overrides?.dayPatches?.[dateStr];
  if (patch) Object.assign(day_, patch);
  return day_;
}

/** ตรวจคุณภาพ "ยามเดียว" (黃道) ของวัน+เวลาที่เลือก — ตาม กฎ 黃道 จากกิ่งวัน */
export type HourQuality = {
  date: string;
  hour: number;
  dayPillar: string;
  hourBranch: string;
  range: string;
  god: string;
  meaning: string;
  score: number;
  good: boolean;
};

export function checkHour(year: number, month: number, day: number, hour24: number): HourQuality {
  const { dayPillar } = pillarsForDate(year, month, day);
  // 時辰: 23:00-00:59=子, 1-2:59=丑, ... -> index = floor((hour+1)/2) % 12
  const hb = BRANCH_ORDER12[Math.floor(((hour24 % 24) + 1) / 2) % 12];
  const start = bIdx(QINGLONG_START[dayPillar.branch]);
  const idx = ((bIdx(hb) - start) % 12 + 12) % 12;
  const info = HOUR_GOD_LEGEND[`B${idx + 1}`];
  return {
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    hour: hour24,
    dayPillar: dayPillar.ganzhi,
    hourBranch: hb,
    range: HOUR_RANGE[hb],
    god: info?.god ?? "",
    meaning: info?.meaning ?? "",
    score: resolveScore(info?.score),
    good: Boolean(info?.good),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** ปฏิทิน 1 เดือน (ปฏิทินสากล) ของปี ค.ศ. */
export function buildAlmanacMonth(year: number, month: number, overrides?: AlmanacOverrides): AlmanacMonth {
  const days: AlmanacDay[] = [];
  for (let dd = 1; dd <= daysInMonth(year, month); dd += 1) {
    days.push(buildAlmanacDay(year, month, dd, overrides));
  }
  return { yearBE: year + 543, month, days };
}

/** ปฏิทินทั้งปี — รับปี พ.ศ. (เช่น 2569) เหมือนชื่อไฟล์ต้นฉบับ */
export function buildAlmanacYear(yearBE: number, overrides?: AlmanacOverrides): AlmanacYear {
  const yearCE = yearBE - 543;
  const months: AlmanacMonth[] = [];
  for (let m = 1; m <= 12; m += 1) {
    months.push(buildAlmanacMonth(yearCE, m, overrides));
  }
  return { yearBE, months };
}
