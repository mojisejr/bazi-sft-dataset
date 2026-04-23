import { describe, expect, test } from "vitest";

import {
  classifyOperatorStrengthScore,
  lookupOperatorLagnaPillar,
  OPERATOR_BAD_QI_LABELS,
  OPERATOR_FAVORABLE_BRANCHES,
  OPERATOR_FAVORABLE_STEMS,
  OPERATOR_GOOD_QI_BONUSES,
  OPERATOR_GOOD_QI_LABELS,
  OPERATOR_LAGNA_BRANCH_NUMBERS,
  OPERATOR_STRENGTH_POSITION_WEIGHTS,
  resolveOperatorLagnaTermBase,
} from "@/lib/bazi/constants";

describe("Phase 2 operator constants", () => {
  test("captures the lagna worksheet lookup contract for the 2018-12-08 sinsae case", () => {
    expect(OPERATOR_LAGNA_BRANCH_NUMBERS.酉).toBe(10);
    expect(OPERATOR_LAGNA_BRANCH_NUMBERS.子).toBe(1);
    expect(resolveOperatorLagnaTermBase(11)).toBe(20);
    expect(lookupOperatorLagnaPillar("戊", "申")).toBe("庚申");
  });

  test("keeps the operator strength weights and favorable groups as distilled truth tables", () => {
    expect(OPERATOR_STRENGTH_POSITION_WEIGHTS).toMatchObject({
      monthBranch: 1.75,
      dayBranch: 1.5,
      monthStem: 1.25,
      hourStem: 1,
      hourBranch: 1,
      yearStem: 0.75,
      yearBranch: 0.75,
    });
    expect(OPERATOR_FAVORABLE_STEMS.wood).toEqual(["甲", "乙", "壬", "癸"]);
    expect(OPERATOR_FAVORABLE_BRANCHES.wood).toEqual(["寅", "卯", "子", "亥"]);
    expect(OPERATOR_GOOD_QI_BONUSES).toMatchObject({
      dayMonthBranchZone: 0.25,
      hourMonthStemZone: 0.25,
      yearZone: 0.25,
    });
    expect(OPERATOR_GOOD_QI_LABELS).toContain("ตี้อ้วง");
    expect(OPERATOR_BAD_QI_LABELS).toContain("ซวย");
  });

  test("classifies the five operator strength bands without reusing the old hidden-stem model", () => {
    expect(classifyOperatorStrengthScore(1.99)).toMatchObject({
      id: "very-weak",
      label: "อ่อนเกินไป",
    });
    expect(classifyOperatorStrengthScore(2.25)).toMatchObject({
      id: "weak",
      label: "ดวงอ่อน",
    });
    expect(classifyOperatorStrengthScore(4.5)).toMatchObject({
      id: "balanced",
      label: "สมดุล",
      displayLabel: "ดิถีสมดุล",
    });
    expect(classifyOperatorStrengthScore(5.75)).toMatchObject({
      id: "strong",
      label: "ดวงแข็ง",
    });
    expect(classifyOperatorStrengthScore(7.01)).toMatchObject({
      id: "very-strong",
      label: "แข็งเกินไป",
    });
  });
});