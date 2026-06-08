import { z } from "zod";

import type { SupportedElement } from "@/lib/bazi/symbolic-engine.types";

// เกณฑ์ band ต่อเนื่องไม่มีช่องว่าง (รองรับคะแนนเศษจากโบนัสราก 通根/得地 + ฤดู 得令)
// ขอบล่างใช้ minExclusive = ขอบบนชั้นก่อนหน้า → คะแนนใด ๆ จัด band ได้เสมอ ไม่ตกช่องว่าง
// R5.2b (2026-06-08): ลดเพดาน very-weak 2 → -2 เพราะ engine "กดกำลังแรงเกิน 1 ขั้น"
//   ซินแสยืนยัน 1988 (score -1.25) + ภวรัญชน์ (0.25) = "ดวงอ่อน" (weak) ไม่ใช่ very-weak
//   ground truth แทบไม่เคยเป็น very-weak → สงวน very-weak ไว้เฉพาะดวงถูกถ่ายเท/พิฆาตรุนแรง (≤ -2)
//   ดู docs/r5-strength-useful-divergence-2026-06-08.md + memory strength-1988-divergence
export const OPERATOR_STRENGTH_CLASS_BANDS = [
  {
    id: "very-weak",
    label: "อ่อนเกินไป",
    displayLabel: "ดิถีอ่อนเกินไป",
    minExclusive: Number.NEGATIVE_INFINITY,
    maxInclusive: -2,
  },
  {
    id: "weak",
    label: "ดวงอ่อน",
    displayLabel: "ดิถีอ่อน",
    minExclusive: -2,
    maxInclusive: 3.75,
  },
  {
    id: "balanced",
    label: "สมดุล",
    displayLabel: "ดิถีสมดุล",
    minExclusive: 3.75,
    maxInclusive: 5.5,
  },
  {
    id: "strong",
    label: "ดวงแข็ง",
    displayLabel: "ดิถีแข็ง",
    minExclusive: 5.5,
    maxInclusive: 6.75,
  },
  {
    id: "very-strong",
    label: "แข็งเกินไป",
    displayLabel: "ดิถีแข็งเกินไป",
    minExclusive: 6.75,
    maxInclusive: Number.POSITIVE_INFINITY,
  },
] as const;

export const OperatorStrengthClassSchema = z.enum([
  "อ่อนเกินไป",
  "ดวงอ่อน",
  "สมดุล",
  "ดวงแข็ง",
  "แข็งเกินไป",
]);

export type OperatorStrengthClass = z.infer<typeof OperatorStrengthClassSchema>;

export const OPERATOR_STRENGTH_POSITION_WEIGHTS = {
  monthBranch: 1.75,
  dayBranch: 1.5,
  monthStem: 1.25,
  hourStem: 1,
  hourBranch: 1,
  yearStem: 0.75,
  yearBranch: 0.75,
} as const;

export const OPERATOR_SAME_ELEMENT_STEMS = {
  wood: ["甲", "乙"],
  fire: ["丙", "丁"],
  earth: ["戊", "己"],
  metal: ["庚", "辛"],
  water: ["壬", "癸"],
} as const satisfies Record<SupportedElement, readonly string[]>;

export const OPERATOR_SUPPORTING_STEMS = {
  wood: ["壬", "癸"],
  fire: ["甲", "乙"],
  earth: ["丙", "丁"],
  metal: ["戊", "己"],
  water: ["庚", "辛"],
} as const satisfies Record<SupportedElement, readonly string[]>;

export const OPERATOR_SAME_ELEMENT_BRANCHES = {
  wood: ["寅", "卯"],
  fire: ["巳", "午"],
  earth: ["丑", "辰", "未", "戌"],
  metal: ["申", "酉"],
  water: ["子", "亥"],
} as const satisfies Record<SupportedElement, readonly string[]>;

export const OPERATOR_SUPPORTING_BRANCHES = {
  wood: ["子", "亥"],
  fire: ["寅", "卯"],
  earth: ["巳", "午"],
  metal: ["丑", "辰", "未", "戌"],
  water: ["申", "酉"],
} as const satisfies Record<SupportedElement, readonly string[]>;

export const OPERATOR_FAVORABLE_STEMS = Object.fromEntries(
  Object.entries(OPERATOR_SAME_ELEMENT_STEMS).map(([element, stems]) => [
    element,
    [...stems, ...OPERATOR_SUPPORTING_STEMS[element as SupportedElement]],
  ]),
) as Readonly<Record<SupportedElement, string[]>>;

export const OPERATOR_FAVORABLE_BRANCHES = Object.fromEntries(
  Object.entries(OPERATOR_SAME_ELEMENT_BRANCHES).map(([element, branches]) => [
    element,
    [...branches, ...OPERATOR_SUPPORTING_BRANCHES[element as SupportedElement]],
  ]),
) as Readonly<Record<SupportedElement, string[]>>;

export const OPERATOR_GOOD_QI_LABELS = ["เชี่ยงแซ", "กวงตั่ว", "ลิ่มกัว", "ตี้อ๋วง", "ทอ", "เอี้ยง"] as const;

export const OPERATOR_BAD_QI_LABELS = ["หมกยก", "ซวย", "แป่", "ซี่", "เจ๊าะ"] as const;

export const OPERATOR_GOOD_QI_BONUSES = {
  dayMonthBranchZone: 0.25,
  hourMonthStemZone: 0.25,
  yearZone: 0.25,
} as const;

export const OPERATOR_BAD_QI_PENALTIES = {
  dayMonthBranchZone: 0.25,
  hourZone: 0.25,
  yearZone: 0.25,
} as const;

// โบนัสดิถี "แข็งมาก" (从强/印比ครอบงำ) — เพิ่มเมื่อธาตุพวกพ้อง (比劫) + ธาตุอุปถัมภ์ (印)
// ครอบงำผังจนเกือบไร้ธาตุถ่ายเท/ข่ม (食傷財官) เพื่อยก band ดิถีแข็ง → แข็งมากตามตำรา
// เปิดเฉพาะดวงที่ฐานคะแนนอยู่ในแดน "แข็ง" แล้ว (>= STRONG ขอบล่าง) จึงไม่กระทบดวงสมดุล/อ่อน
// (โบนัสตั้งให้แรงพอยก 从强格 ขึ้นแดน "แข็งมาก" เพราะคะแนนหลักไม่นับ 通根 แล้ว)
export const OPERATOR_DOMINANCE = {
  /** ฐานคะแนนขั้นต่ำที่จะพิจารณาโบนัสครอบงำ (= ขอบล่าง band "แข็ง") */
  minBaseScore: 5.5,
  /** สัดส่วนธาตุพวกพ้อง+อุปถัมภ์ขั้นต่ำ และโบนัสที่ได้ (เรียงจากเข้มไปเบา) */
  tiers: [
    { minSupportiveShare: 0.7, bonus: 1.75 },
    { minSupportiveShare: 0.6, bonus: 1.0 },
  ],
} as const;

export const OPERATOR_RELATION_PENALTIES = {
  dayBranchVsDayMasterPo: 0.25,
  monthBranchVsDayMasterPo: 0.25,
  monthBranchVsDayBranchConflict: 0.25,
  dayBranchVsHourBranchConflict: 0.25,
} as const;

// การผั่ว (破) ตามตำราเคี้ยงคุง = ความสัมพันธ์ "ราศีบน(ก้าน) × ราศีล่าง(กิ่ง)" เฉพาะคู่
// (ไม่ใช่กิ่ง-กิ่ง) ใช้ตรวจ "ดิถีผั่วกับราศีล่างหลักวัน/หลักเดือน" เพื่อหักคะแนนกำลังดิถี
export const OPERATOR_PO_STEM_BRANCH: Record<string, readonly string[]> = {
  甲: ["午"],
  乙: ["巳"],
  丙: ["辰"],
  丁: ["卯"],
  戊: ["寅"],
  己: ["丑", "亥"],
  庚: ["子", "戌"],
  辛: ["酉"],
  壬: ["申"],
  癸: ["未"],
} as const;

export function classifyOperatorStrengthScore(score: number) {
  const band = OPERATOR_STRENGTH_CLASS_BANDS.find((candidate) => {
    const lowerPass = "minInclusive" in candidate
      ? score >= candidate.minInclusive
      : score > candidate.minExclusive;
    const upperPass = score <= candidate.maxInclusive;

    return lowerPass && upperPass;
  });

  if (!band) {
    throw new Error(`Unsupported operator strength score: ${score}`);
  }

  return band;
}