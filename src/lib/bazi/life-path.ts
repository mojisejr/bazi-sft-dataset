/**
 * "Life Path" (เส้นทางชีวิต) — สร้าง "เส้นกราฟคะแนนชีวิต" จาก state ที่ engine คำนวณ
 * ที่ 4 ความละเอียด (all / 5y / 1y / 1m) สำหรับจอ Life-Path (UI ใหม่).
 *
 * ⚠️ score เป็นค่า "derive" (placeholder) — ยังไม่มี seed `analytic_life` จาก BE
 * จึงประเมินจาก 12 เชี่ยงแซ (十二長生) ของแต่ละช่วง ตามหลักโป๊ยยี่มาตรฐาน
 * เป็น provisional (ซินแส/BE ปรับได้ภายหลัง). มี seed-override hook ด้านล่าง:
 * ถ้ามีไฟล์ data/life-path-scores.json (dump ของ analytic_life) จะ prefer score/description
 * ของ seed สำหรับ band ที่คำนวณคีย์ได้ (day_above_id × day_above_below_id × is_above).
 */

import fs from "node:fs";
import path from "node:path";

import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import { BRANCH_TO_ELEMENT, STEM_TO_ELEMENT } from "@/lib/bazi/symbolic-engine.constants";
import {
  extractChartFacts,
  favorableElements,
  type ChartFacts,
} from "@/lib/bazi/newdata-lookup";
import { resolveDisplayTwelveQiStage } from "@/lib/bazi/pillar-display";

export type LifePathStageWord =
  | "เริ่มใหม่"
  | "สะสม"
  | "ฟื้นฟู"
  | "ทดลอง"
  | "เก็บเกี่ยว"
  | "โชว์สกิล"
  | "ถดถอย";

export type LifePathPoint = {
  label: string;
  score: number;
  stage: LifePathStageWord;
  ageStart?: number;
  ageEnd?: number;
  isCurrent?: boolean;
  note?: string;
};

export type LifePath = {
  currentAge: number;
  favorableElementsTh: string[];
  series: {
    all: LifePathPoint[];
    "5y": LifePathPoint[];
    "1y": LifePathPoint[];
    "1m": LifePathPoint[];
  };
};

/**
 * แผนที่ 12 เชี่ยงแซ (ชื่อไทยที่ engine คายออกมา) → คะแนนฐาน 0..125.
 * จุดพีค (ตี้อ๋วง 帝旺 / ลิ่มกัว 臨官 / เชี่ยงแซ 長生) สูง · ช่วงถดถอย (ซวย 衰/แป่ 病/ซี่ 死/เจ๊าะ 絶) ต่ำ.
 * ⚠️ ค่าเหล่านี้เป็น placeholder จนกว่าจะมี seed analytic_life จาก BE.
 */
const QI_SCORE: Record<string, number> = {
  ตี้อ๋วง: 115, // 帝旺 peak
  ลิ่มกัว: 108, // 臨官
  เชี่ยงแซ: 100, // 長生
  กวงตั่ว: 95, // 冠帶
  หมอ: 70, // 沐浴
  เอี้ยง: 62, // 養
  ทอ: 55, // 胎
  ซวย: 45, // 衰
  หมกยก: 25, // 墓
  แป่: 35, // 病
  ซี่: 20, // 死
  เจ๊าะ: 15, // 絶
};
const DEFAULT_SCORE = 60;

/** แผนที่ 12 เชี่ยงแซ → 1 ใน 7 คำ stage ตามเฟสวงจรชีวิต (growth → peak → decline). */
const QI_STAGE: Record<string, LifePathStageWord> = {
  ทอ: "เริ่มใหม่", // 胎
  เอี้ยง: "สะสม", // 養
  เชี่ยงแซ: "ฟื้นฟู", // 長生
  หมอ: "ฟื้นฟู", // 沐浴
  กวงตั่ว: "ทดลอง", // 冠帶
  ลิ่มกัว: "เก็บเกี่ยว", // 臨官
  ตี้อ๋วง: "โชว์สกิล", // 帝旺
  ซวย: "ถดถอย", // 衰
  แป่: "ถดถอย", // 病
  ซี่: "ถดถอย", // 死
  หมกยก: "ถดถอย", // 墓
  เจ๊าะ: "ถดถอย", // 絶
};
const DEFAULT_STAGE: LifePathStageWord = "สะสม";

function scoreOfQi(qi: string | null | undefined): number {
  if (!qi) return DEFAULT_SCORE;
  return QI_SCORE[qi] ?? DEFAULT_SCORE;
}
function stageOfQi(qi: string | null | undefined): LifePathStageWord {
  if (!qi) return DEFAULT_STAGE;
  return QI_STAGE[qi] ?? DEFAULT_STAGE;
}
function clampScore(n: number): number {
  return Math.max(0, Math.min(125, Math.round(n)));
}

// ── seed-override hook (BE analytic_life dump) ──────────────────────────────
// ไฟล์ (ถ้ามี) = array ของ { day_above_id, day_above_below_id, is_above, score, description, ... }
// คีย์: day_above_id = index ก้านดิถี (1..10) · day_above_below_id = index ก้าน(upper)/กิ่ง(lower) 1-based
//       is_above = เฟสเป็นราศีบน (ก้าน) ไหม  — best-effort, absence = derive-only.
type SeedRow = {
  day_above_id: number;
  day_above_below_id: number;
  is_above: boolean | number;
  score: number;
  description?: string;
};
let seedCache: SeedRow[] | null | undefined;
function loadSeed(): SeedRow[] | null {
  if (seedCache !== undefined) return seedCache;
  try {
    const file = path.join(process.cwd(), "src/lib/bazi/data/life-path-scores.json");
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    seedCache = Array.isArray(parsed) ? (parsed as SeedRow[]) : null;
  } catch {
    seedCache = null; // ไม่มีไฟล์ = derive อย่างเดียว (ไม่ block)
  }
  return seedCache;
}

const STEM_KEYS = Object.keys(STEM_TO_ELEMENT); // canonical order 甲..癸
const BRANCH_KEYS = Object.keys(BRANCH_TO_ELEMENT); // canonical order 子..亥

/** หา seed row ที่ match (คืน null ถ้าไม่มีไฟล์/ไม่ match). */
function seedLookup(
  dayMaster: string,
  symbol: string,
  isAbove: boolean,
): { score: number; description?: string } | null {
  const seed = loadSeed();
  if (!seed) return null;
  const dayAboveId = STEM_KEYS.indexOf(dayMaster) + 1;
  const belowId = isAbove
    ? STEM_KEYS.indexOf(symbol) + 1
    : BRANCH_KEYS.indexOf(symbol) + 1;
  if (dayAboveId <= 0 || belowId <= 0) return null;
  const row = seed.find(
    (r) =>
      r.day_above_id === dayAboveId &&
      r.day_above_below_id === belowId &&
      Boolean(r.is_above) === isAbove,
  );
  if (!row) return null;
  return { score: clampScore(row.score), description: row.description };
}

// ── 5-year bands (all / 5y) ─────────────────────────────────────────────────
type PhaseWindow = {
  startAge: number;
  endAge: number;
  qi: string | null;
  symbol: string;
  isAbove: boolean;
};

/** แตกวัยจรทั้งชีวิตเป็น phase 5 ปี (ก้าน→กิ่ง) เรียงตามอายุ. */
function collectPhases(facts: ChartFacts): PhaseWindow[] {
  const out: PhaseWindow[] = [];
  for (const d of facts.daYun) {
    for (const ph of d.phases) {
      out.push({
        startAge: ph.startAge,
        endAge: ph.endAge,
        qi: ph.qi,
        symbol: ph.symbol,
        isAbove: ph.source === "stem",
      });
    }
  }
  out.sort((a, b) => a.startAge - b.startAge);
  return out;
}

function phaseCoveringAge(phases: PhaseWindow[], age: number): PhaseWindow | null {
  return phases.find((p) => age >= p.startAge && age <= p.endAge) ?? null;
}

function buildBands(
  facts: ChartFacts,
  currentAge: number,
  cap = 90,
): LifePathPoint[] {
  const phases = collectPhases(facts);
  const lastEnd = phases.length ? Math.min(cap, Math.max(...phases.map((p) => p.endAge))) : cap;
  const points: LifePathPoint[] = [];

  // band 0 = 0-5, band k(>=1) = (5k+1)-(5k+5)
  for (let start = 0; start <= lastEnd; start = start === 0 ? 6 : start + 5) {
    const end = start === 0 ? 5 : start + 4;
    const mid = Math.floor((start + end) / 2);
    // ใช้ phase ที่ครอบกลาง band · fallback upperState/lowerState ของวัยจรที่ครอบ
    const ph = phaseCoveringAge(phases, mid) ?? phaseCoveringAge(phases, start) ?? phaseCoveringAge(phases, end);
    let qi = ph?.qi ?? null;
    if (!qi) {
      const stage = facts.daYun.find((d) => mid >= d.startAge && mid <= d.endAge);
      qi = stage?.upperState ?? stage?.lowerState ?? null;
    }

    let score = scoreOfQi(qi);
    let note: string | undefined;
    // seed-override (best-effort) — prefer exact BE score/description ถ้าคำนวณคีย์ได้
    if (ph) {
      const seed = seedLookup(facts.dayMaster, ph.symbol, ph.isAbove);
      if (seed) {
        score = seed.score;
        note = seed.description;
      }
    }

    points.push({
      label: `${start}-${end}`,
      score: clampScore(score),
      stage: stageOfQi(qi),
      ageStart: start,
      ageEnd: end,
      isCurrent: currentAge >= start && currentAge <= end,
      ...(note ? { note } : {}),
    });
  }
  return points;
}

// ── annual (1y) ─────────────────────────────────────────────────────────────
type YearInfo = { year: number; age: number | null; qi: string | null };

function collectYears(state: CalculatedStateValue, facts: ChartFacts): YearInfo[] {
  return (state.liuNianSeries ?? []).map((y) => ({
    year: y.year,
    age: y.age ?? null,
    qi: y.twelveQiDisplay ?? resolveDisplayTwelveQiStage(facts.dayMaster, y.branch) ?? null,
  }));
}

function buildAnnual(years: YearInfo[], currentAge: number): LifePathPoint[] {
  // หน้าต่าง currentAge-4 .. currentAge+12
  const lo = currentAge - 4;
  const hi = currentAge + 12;
  return years
    .filter((y) => y.age != null && y.age >= lo && y.age <= hi)
    .map((y) => ({
      label: String(y.year),
      score: clampScore(scoreOfQi(y.qi)),
      stage: stageOfQi(y.qi),
      ageStart: y.age ?? undefined,
      ageEnd: y.age ?? undefined,
      isCurrent: y.age === currentAge,
    }));
}

// ── monthly (1m) ────────────────────────────────────────────────────────────
const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** 12 เดือนของปีปัจจุบัน — แกว่งเบา ๆ รอบคะแนนปีปัจจุบัน (derive placeholder). */
function buildMonthly(base: number, nowMonthIdx: number): LifePathPoint[] {
  return TH_MONTHS.map((label, i) => {
    // แกว่ง ±8 แบบไซน์เบา ๆ ให้เส้นไม่แบน (deterministic)
    const wobble = Math.round(8 * Math.sin((i / 12) * Math.PI * 2));
    return {
      label,
      score: clampScore(base + wobble),
      stage: stageOfQi(null), // เดือนไม่มี 12 เชี่ยงแซแยก — ใช้ค่ากลาง
      isCurrent: i === nowMonthIdx,
    };
  });
}

/** สร้าง Life-Path (4 ความละเอียด) จาก state ที่คำนวณแล้ว. */
export function buildLifePath(
  state: CalculatedStateValue,
  opts: { gender?: string; birthYear?: number; nowYear?: number; nowMonth?: number } = {},
): LifePath {
  const facts = extractChartFacts(state, opts.gender, opts.birthYear);
  const currentAge = state.ageSnapshot?.thaiAge ?? 0;
  const favTh = favorableElements(facts);

  const bands = buildBands(facts, currentAge);
  const years = collectYears(state, facts);
  const annual = buildAnnual(years, currentAge);

  // ฐานคะแนนรายเดือน = คะแนนปีปัจจุบัน (ไม่มีก็ใช้ band ปัจจุบัน)
  const curYearPt = annual.find((p) => p.isCurrent);
  const curBandPt = bands.find((p) => p.isCurrent);
  const monthlyBase = curYearPt?.score ?? curBandPt?.score ?? DEFAULT_SCORE;
  const nowMonthIdx = (opts.nowMonth ?? new Date().getMonth() + 1) - 1;
  const monthly = buildMonthly(monthlyBase, Math.max(0, Math.min(11, nowMonthIdx)));

  return {
    currentAge,
    favorableElementsTh: favTh,
    series: {
      all: bands,
      "5y": bands, // ความละเอียด 5 ปีเท่ากับ all
      "1y": annual,
      "1m": monthly,
    },
  };
}
