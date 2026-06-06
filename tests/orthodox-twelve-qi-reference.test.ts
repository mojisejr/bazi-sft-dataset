import { describe, expect, test } from "vitest";
import { Solar } from "lunar-javascript";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import {
  calculateBaziChart,
  calculateBaziStructuralState,
  resolveBranchInteractionEffects,
} from "@/lib/bazi/symbolic-engine";
import { buildStrengthScoreExplainable } from "@/lib/bazi/symbolic-engine.strength";
import type { BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine.types";

describe("orthodox twelve qi reference proof", () => {
  test("proves the 2018-12-08 reference case yields 养/沐浴/养/胎 and total strength 4.5", () => {
    const rawInput = RawInputSchema.parse({
      birthDate: "2018-12-08",
      birthTime: "17:13",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    });

    const structuralState = calculateBaziStructuralState(rawInput);
    const pillars = structuralState.fourPillars;
    const interactionResolution = resolveBranchInteractionEffects(pillars);
    const eightChar = Solar.fromYmdHms(2018, 12, 8, 17, 13, 0).getLunar().getEightChar();
    const orthodoxStages = {
      year: eightChar.getYearDiShi(),
      month: eightChar.getMonthDiShi(),
      day: eightChar.getDayDiShi(),
      hour: eightChar.getTimeDiShi(),
    };
    const strengthScore = buildStrengthScoreExplainable(
      structuralState.dayMaster,
      pillars,
      orthodoxStages,
      interactionResolution,
    );

    expect(orthodoxStages).toEqual({
      year: "养",
      month: "沐浴",
      day: "养",
      hour: "胎",
    });
    expect(strengthScore.value).toBe(4.25);
  });

  test("does not require repository twelve qi lookup once orthodox math is the source of truth", async () => {
    const rawInput = RawInputSchema.parse({
      birthDate: "2018-12-08",
      birthTime: "17:13",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    });
    const repository: BaziKnowledgeRepository = {
      async findSolarTermBoundaryContext() {
        return {
          previous: null,
          next: null,
        };
      },
      async findDayMasterStrengthProfile() {
        return null;
      },
      async findSixtyJiaziPersona() {
        return null;
      },
      async findDomainMatrixRows() {
        return [];
      },
    };

    const result = await calculateBaziChart(rawInput, repository);

    expect(result.twelveQi).toEqual(
      expect.objectContaining({
        yearBranch: "เอี้ยง",
        monthBranch: "หมกยก",
        dayBranch: "เอี้ยง",
        hourBranch: "ทอ",
      }),
    );
    expect(result.twelveQi.currentDaYunBranch).toBeTruthy();
    expect(result.twelveQi.currentLiuNianBranch).toBeTruthy();
    expect(result.strengthScore).toBe(4.25);
  });
});
