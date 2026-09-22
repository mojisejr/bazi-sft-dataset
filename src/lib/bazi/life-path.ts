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
import { pillarsForDate } from "@/lib/bazi/almanac/almanac-engine";

/** ป้ายช่วง = "คำไทยของ 12 เชี่ยงแซ" ตามที่ซินแสนุ้ยกำหนด (2026-09-22) — ไม่ใช่คำที่ AI คิดเอง */
export type LifePathStageWord = string;

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

/** แผนที่ 12 เชี่ยงแซ → "คำไทย" ตามที่ซินแสนุ้ยกำหนด (2026-09-22) — 1 เชี่ยงแซ = 1 คำ (ไม่ยุบเป็น 7) */
const QI_STAGE: Record<string, LifePathStageWord> = {
  เชี่ยงแซ: "พัฒนา", // 長生
  หมกยก: "สะสาง", // 墓 (ซินแส: สะสาง/ลุ่มหลง)
  กวงตั่ว: "บัณฑิต", // 冠帶
  ลิ่มกัว: "ตำแหน่ง", // 臨官
  ตี้อ๋วง: "อำนาจ", // 帝旺
  ซวย: "เสื่อมถอย", // 衰
  แป่: "แปรเปลี่ยน", // 病
  ซี่: "สูญเสีย", // 死
  หมอ: "คงที่", // 沐浴
  เจ๊าะ: "สูญสิ้น", // 絶
  ทอ: "ก่อเกิด", // 胎
  เอี้ยง: "บ่มเพาะ", // 養
};
const DEFAULT_STAGE: LifePathStageWord = "คงที่";

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

// ── monthly (1y = 12 เดือนของปีนี้) — ซินแสนุ้ย: "1 ปี" ต้องโชว์ 12 เดือน ────────────
const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** 12 เดือนของปีปัจจุบัน — เชี่ยงแซจริงของเสาเดือน (กิ่งเดือน) เทียบดิถี. */
function buildMonthly(dayMaster: string, year: number, nowMonthIdx: number): LifePathPoint[] {
  return TH_MONTHS.map((label, i) => {
    // เสาเดือนจริงกลางเดือน (วันที่ 15) — เอากิ่งเดือนมาคิด 12 เชี่ยงแซเทียบดิถี
    let qi: string | null = null;
    try {
      const branch = pillarsForDate(year, i + 1, 15).monthPillar.branch;
      qi = resolveDisplayTwelveQiStage(dayMaster, branch) ?? null;
    } catch {
      qi = null;
    }
    return {
      label,
      score: clampScore(scoreOfQi(qi)),
      stage: stageOfQi(qi),
      isCurrent: i === nowMonthIdx,
    };
  });
}

// ── daily (1m = ~30 วันของเดือนนี้) — ซินแสนุ้ย: "1 เดือน" ต้องโชว์วันของเดือนนี้ ────────
/** วันของเดือนปัจจุบัน — เชี่ยงแซจริงของเสาวัน (กิ่งวัน) เทียบดิถี. */
function buildDaily(dayMaster: string, year: number, month: number, nowDay: number): LifePathPoint[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const out: LifePathPoint[] = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    let qi: string | null = null;
    try {
      const branch = pillarsForDate(year, month, d).dayPillar.branch;
      qi = resolveDisplayTwelveQiStage(dayMaster, branch) ?? null;
    } catch {
      qi = null;
    }
    out.push({
      label: String(d),
      score: clampScore(scoreOfQi(qi)),
      stage: stageOfQi(qi),
      isCurrent: d === nowDay,
    });
  }
  return out;
}

/** สร้าง Life-Path (4 ความละเอียด) จาก state ที่คำนวณแล้ว. */
export function buildLifePath(
  state: CalculatedStateValue,
  opts: { gender?: string; birthYear?: number; nowYear?: number; nowMonth?: number; nowDay?: number } = {},
): LifePath {
  const facts = extractChartFacts(state, opts.gender, opts.birthYear);
  const currentAge = state.ageSnapshot?.thaiAge ?? 0;
  const favTh = favorableElements(facts);

  const bands = buildBands(facts, currentAge);

  const now = new Date();
  const nowYear = opts.nowYear ?? now.getFullYear();
  const nowMonth = opts.nowMonth ?? now.getMonth() + 1; // 1-based
  const nowDay = opts.nowDay ?? now.getDate();
  // "1 ปี" = 12 เดือนของปีนี้ · "1 เดือน" = วันของเดือนนี้ (ซินแสนุ้ย 2026-09-22)
  const monthly = buildMonthly(facts.dayMaster, nowYear, Math.max(0, Math.min(11, nowMonth - 1)));
  const daily = buildDaily(facts.dayMaster, nowYear, nowMonth, nowDay);

  return {
    currentAge,
    favorableElementsTh: favTh,
    series: {
      all: bands,
      "5y": bands, // ความละเอียด 5 ปีเท่ากับ all
      "1y": monthly, // 12 เดือนของปีนี้
      "1m": daily, // วันของเดือนนี้
    },
  };
}
