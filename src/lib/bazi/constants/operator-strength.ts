import { z } from "zod";

import type { SupportedElement } from "@/lib/bazi/symbolic-engine.types";

type OperatorStrengthClassBand =
  | {
      id: string;
      label: string;
      displayLabel: string;
      minInclusive: number;
      maxInclusive: number;
    }
  | {
      id: string;
      label: string;
      displayLabel: string;
      minExclusive: number;
      maxInclusive: number;
    };

function hasMinInclusive(
  candidate: OperatorStrengthClassBand,
): candidate is Extract<OperatorStrengthClassBand, { minInclusive: number }> {
  return Object.prototype.hasOwnProperty.call(candidate, "minInclusive");
}

// เกณฑ์ band ต่อเนื่องไม่มีช่องว่าง (รองรับคะแนนเศษจากโบนัสราก 通根/得地 + ฤดู 得令)
// ขอบล่างใช้ minExclusive = ขอบบนชั้นก่อนหน้า → คะแนนใด ๆ จัด band ได้เสมอ ไม่ตกช่องว่าง
// 2026-06-25: คืนเกณฑ์ band ตามสเปกซินแสข้อ 8.1 (เจ้าของระบบสั่งปรับ) — แทนที่ R5.2b calibration
//   ที่มา: knownlage/distilled/เกณฑ์ความแข็งอ่อน_ดวง5แบบ/2026-04-23_strength-evaluation-step.md ข้อ 8.1
//     <2 อ่อนมาก · 2.25–3.75 อ่อน · 4–5.5 สมดุล · 5.75–6.75 แข็ง · >7 แข็งมาก
//   หมายเหตุ: สูตรคะแนน (ข้อ 7–8) = engine ปัจจุบันอยู่แล้ว (ไม่นับ 通根/得令) → คะแนน = สเกลตำรา
//   คะแนนเป็นทวีคูณ 0.25 เสมอ → ตั้ง "จุดตัด" ที่กึ่งกลางกริด (.875/.625) ให้ขอบจำนวนเต็มตกถูกฝั่ง
//     (เช่น score 2 = "อ่อน" ตรง ground truth ซินแส 己 ปี 1981)
//   ⚠ ทับการอ่านมือ 2 ดวง: 1993 (0.25) / 1988 (1.0) ซินแสเคยอ่าน "อ่อน" → ตามสเปกเป็น "อ่อนมาก"
export const OPERATOR_STRENGTH_CLASS_BANDS = [
  {
    id: "very-weak",
    label: "อ่อนเกินไป",
    displayLabel: "ดิถีอ่อนเกินไป",
    minExclusive: Number.NEGATIVE_INFINITY,
    maxInclusive: 1.875, // < 2
  },
  {
    id: "weak",
    label: "ดวงอ่อน",
    displayLabel: "ดิถีอ่อน",
    minExclusive: 1.875,
    maxInclusive: 3.875, // 2–3.75
  },
  {
    id: "balanced",
    label: "สมดุล",
    displayLabel: "ดิถีสมดุล",
    minExclusive: 3.875,
    maxInclusive: 5.625, // 4–5.5
  },
  {
    id: "strong",
    label: "ดวงแข็ง",
    displayLabel: "ดิถีแข็ง",
    minExclusive: 5.625,
    maxInclusive: 6.875, // 5.75–6.75
  },
  {
    id: "very-strong",
    label: "แข็งเกินไป",
    displayLabel: "ดิถีแข็งเกินไป",
    minExclusive: 6.875,
    maxInclusive: Number.POSITIVE_INFINITY, // >7
  },
] as const satisfies readonly OperatorStrengthClassBand[];

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
    const lowerPass = hasMinInclusive(candidate)
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