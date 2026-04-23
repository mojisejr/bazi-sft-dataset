import { z } from "zod";

const OPERATOR_LAGNA_STEM_SEQUENCE = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;

export const OPERATOR_LAGNA_BRANCH_NUMBERS = {
  子: 1,
  丑: 2,
  寅: 3,
  卯: 4,
  辰: 5,
  巳: 6,
  午: 7,
  未: 8,
  申: 9,
  酉: 10,
  戌: 11,
  亥: 12,
} as const;

export const OPERATOR_LAGNA_TERM_BASES = [8, 20, 32] as const;

export const OPERATOR_LAGNA_BRANCH_SEQUENCE = [
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
  "子",
  "丑",
] as const;

export const OperatorLagnaTermHalfSchema = z.enum(["major-term", "minor-term"]);

export type OperatorLagnaTermHalf = z.infer<typeof OperatorLagnaTermHalfSchema>;

export const OPERATOR_LAGNA_STARTING_STEM_BY_YEAR_STEM = {
  甲: "丙",
  己: "丙",
  乙: "戊",
  庚: "戊",
  丙: "庚",
  辛: "庚",
  丁: "壬",
  壬: "壬",
  戊: "甲",
  癸: "甲",
} as const;

function shiftStem(stem: string, steps: number) {
  const stemIndex = OPERATOR_LAGNA_STEM_SEQUENCE.indexOf(
    stem as (typeof OPERATOR_LAGNA_STEM_SEQUENCE)[number],
  );

  if (stemIndex < 0) {
    throw new Error(`Unsupported lagna stem: ${stem}`);
  }

  return OPERATOR_LAGNA_STEM_SEQUENCE[(stemIndex + steps) % OPERATOR_LAGNA_STEM_SEQUENCE.length];
}

export const OPERATOR_LAGNA_PILLAR_BY_YEAR_STEM_AND_BRANCH = Object.fromEntries(
  Object.entries(OPERATOR_LAGNA_STARTING_STEM_BY_YEAR_STEM).map(([yearStem, startStem]) => [
    yearStem,
    Object.fromEntries(
      OPERATOR_LAGNA_BRANCH_SEQUENCE.map((branch, index) => [
        branch,
        `${shiftStem(startStem, index)}${branch}`,
      ]),
    ),
  ]),
) as Readonly<
  Record<
    keyof typeof OPERATOR_LAGNA_STARTING_STEM_BY_YEAR_STEM,
    Record<(typeof OPERATOR_LAGNA_BRANCH_SEQUENCE)[number], string>
  >
>;

export function resolveOperatorLagnaTermBase(total: number) {
  if (total <= 0 || total > OPERATOR_LAGNA_TERM_BASES[OPERATOR_LAGNA_TERM_BASES.length - 1]) {
    throw new Error(`Unsupported lagna branch total: ${total}`);
  }

  return OPERATOR_LAGNA_TERM_BASES.find((candidate) => total <= candidate) ?? null;
}

export function lookupOperatorLagnaPillar(yearStem: string, lagnaBranch: string) {
  const branchLookup = OPERATOR_LAGNA_PILLAR_BY_YEAR_STEM_AND_BRANCH[
    yearStem as keyof typeof OPERATOR_LAGNA_PILLAR_BY_YEAR_STEM_AND_BRANCH
  ];

  if (!branchLookup) {
    throw new Error(`Unsupported operator lagna year stem: ${yearStem}`);
  }

  const pillar = branchLookup[lagnaBranch as keyof typeof branchLookup];

  if (!pillar) {
    throw new Error(`Unsupported operator lagna branch: ${lagnaBranch}`);
  }

  return pillar;
}