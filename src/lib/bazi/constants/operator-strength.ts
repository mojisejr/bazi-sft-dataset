import { z } from "zod";

import type { SupportedElement } from "@/lib/bazi/symbolic-engine.types";

export const OPERATOR_STRENGTH_CLASS_BANDS = [
  {
    id: "very-weak",
    label: "อ่อนเกินไป",
    displayLabel: "ดิถีอ่อนเกินไป",
    minExclusive: Number.NEGATIVE_INFINITY,
    maxInclusive: 2,
  },
  {
    id: "weak",
    label: "ดวงอ่อน",
    displayLabel: "ดิถีอ่อน",
    minInclusive: 2.25,
    maxInclusive: 3.75,
  },
  {
    id: "balanced",
    label: "สมดุล",
    displayLabel: "ดิถีสมดุล",
    minInclusive: 4,
    maxInclusive: 5.5,
  },
  {
    id: "strong",
    label: "ดวงแข็ง",
    displayLabel: "ดิถีแข็ง",
    minInclusive: 5.75,
    maxInclusive: 6.75,
  },
  {
    id: "very-strong",
    label: "แข็งเกินไป",
    displayLabel: "ดิถีแข็งเกินไป",
    minInclusive: 7,
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

export const OPERATOR_GOOD_QI_LABELS = ["กวงตั่ว", "ลิ่มกัว", "ตี้อ๋วง", "ทอ", "เอี้ยง"] as const;

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

export const OPERATOR_RELATION_PENALTIES = {
  dayBranchVsDayMasterPo: 0.25,
  monthBranchVsDayMasterPo: 0.25,
  monthBranchVsDayBranchConflict: 0.25,
  dayBranchVsHourBranchConflict: 0.25,
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