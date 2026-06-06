import { afterEach, describe, expect, test, vi } from "vitest";

import { createCalculateBaziHandler } from "@/app/api/bazi/calculate/route";
import { CalculatedStateSchema, RawInputSchema } from "@/lib/bazi/schema-types";
import {
  resolveDisplayStemPairStage,
  resolveDisplayTwelveQiStage,
} from "@/lib/bazi/pillar-display";
import { isForwardDaYunDirection } from "@/lib/bazi/symbolic-engine.birth";
import {
  buildGeneralizedInteractionState,
  calculateBaziChart,
  resolveBranchInteractionEffects,
} from "@/lib/bazi/symbolic-engine";
import { TRACE_STEP_KEYS } from "@/lib/bazi/trace-keys";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

afterEach(() => {
  vi.useRealTimers();
});

describe("calculateBaziChart", () => {
  test("lets combinations neutralize clashes before reducing seasonal month support", () => {
    const resolved = resolveBranchInteractionEffects({
      year: { stem: "甲", branch: "子", hiddenStems: [] },
      month: { stem: "乙", branch: "午", hiddenStems: [] },
      day: { stem: "丙", branch: "丑", hiddenStems: [] },
      hour: { stem: "丁", branch: "申", hiddenStems: [] },
    });
    const unresolved = resolveBranchInteractionEffects({
      year: { stem: "甲", branch: "子", hiddenStems: [] },
      month: { stem: "乙", branch: "午", hiddenStems: [] },
      day: { stem: "丙", branch: "卯", hiddenStems: [] },
      hour: { stem: "丁", branch: "辰", hiddenStems: [] },
    });

    expect(resolved.activeCombinations).toContain("子丑");
    expect(resolved.neutralizedClashes).toContain("子午");
    expect(resolved.activeClashes).toEqual([]);
    expect(resolved.monthBranchSeasonalFactor).toBe(1);

    expect(unresolved.activeCombinations).toEqual([]);
    expect(unresolved.activeClashes).toContain("子午");
    expect(unresolved.monthBranchSeasonalFactor).toBe(0.6);
  });

  test("builds generalized interaction state for stem he, liu he, san he, half san he, and elemental interactions", () => {
    const pillars = {
      year: { stem: "己", branch: "丑", hiddenStems: [] },
      month: { stem: "乙", branch: "巳", hiddenStems: [] },
      day: { stem: "庚", branch: "酉", hiddenStems: [] },
      hour: { stem: "壬", branch: "申", hiddenStems: [] },
    };
    const resolution = resolveBranchInteractionEffects(pillars);
    const interactionState = buildGeneralizedInteractionState({
      pillars,
      dayMasterStem: "庚",
      twelveQiByBranch: {
        year: "墓",
        month: "长生",
        day: "帝旺",
        hour: "临官",
      },
      resolution,
    });

    expect(interactionState.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          familyKey: "heavenly-stem-he",
          label: "乙庚",
        }),
        expect.objectContaining({
          familyKey: "earthly-branch-liu-he",
          label: "巳申",
        }),
        expect.objectContaining({
          familyKey: "earthly-branch-san-he",
          label: "巳酉丑",
          transformElement: "metal",
        }),
        expect.objectContaining({
          familyKey: "earthly-branch-ban-san-he",
          transformElement: "metal",
        }),
        expect.objectContaining({
          familyKey: "element-generate",
          elementInteractionType: "generate",
        }),
        expect.objectContaining({
          familyKey: "element-control",
          elementInteractionType: "control",
        }),
      ]),
    );
    expect(interactionState.outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "supported",
          transformElement: "metal",
        }),
        expect.objectContaining({
          status: "detected",
          precedence: "secondary",
        }),
      ]),
    );
    expect(interactionState.qualifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lane: "twelve-qi",
          qualifierKey: "twelve-qi-stage",
          value: "帝旺",
        }),
      ]),
    );
  });

  test("detects san hui and uses it to neutralize clash on shared pillar", () => {
    const resolved = resolveBranchInteractionEffects({
      year: { stem: "甲", branch: "寅", hiddenStems: [] },
      month: { stem: "乙", branch: "申", hiddenStems: [] },
      day: { stem: "丙", branch: "卯", hiddenStems: [] },
      hour: { stem: "丁", branch: "辰", hiddenStems: [] },
    });

    expect(resolved.activeCombinations).toContain("寅卯辰");
    expect(resolved.neutralizedClashes).toContain("寅申");
    expect(resolved.activeClashes).toEqual([]);
    expect(resolved.interactionTiers["combination-寅卯辰"]).toBe("primary");
  });

  test("flips the year and month pillars when crossing the start-of-spring boundary", async () => {
    const repository = createTestKnowledgeRepository();
    const before = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "2024-02-04",
        birthTime: "15:20",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Hong_Kong",
      }),
      repository,
    );
    const after = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "2024-02-04",
        birthTime: "16:40",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Hong_Kong",
      }),
      repository,
    );

    expect(before.fourPillars.year).toMatchObject({ stem: "癸", branch: "卯" });
    expect(before.fourPillars.month).toMatchObject({ stem: "乙", branch: "丑" });
    expect(after.fourPillars.year).toMatchObject({ stem: "甲", branch: "辰" });
    expect(after.fourPillars.month).toMatchObject({ stem: "丙", branch: "寅" });
    expect(after.sixtyJiaziCorePersona?.precedenceNotes.some((note) => note.includes("立春"))).toBe(true);
  });

  test("returns a deterministic calculated state for a pinned sample chart", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));

    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1992-08-21",
        birthTime: "14:35",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Hong_Kong",
      }),
      repository,
    );

    expect(result.dayMaster).toBe("己");
    expect(result.strengthScore).toBe(3.5);
    expect(result.ageSnapshot).toEqual({
      referenceDate: "2026-06-15",
      thaiAge: 33,
      chineseAge: 34,
    });
    expect(result.tenGods.monthStem).toBe("劫财");
    expect(result.tenGods.hourStem).toBe("食神");
    expect(result.tenGods.mingGongStem).toBe("正财");
    expect(result.twelveQi.dayBranch).toBe("ตี้อ๋วง");
    expect(result.mingGong).toMatchObject({ stem: "壬", branch: "寅" });
    expect(result.mingGong).toMatchObject({
      tenGod: "正财",
      stemTranslation: "น้ำ",
      branchTranslation: "ขาล",
      sittingStage: "แป่",
      lookingStage: "ซี่",
    });
    expect(result.explainable.mingGong?.value).toMatchObject({ stem: "壬", branch: "寅" });
    expect(result.explainable.mingGong?.trace).toMatchObject({
      engine: "orthodox-override",
      ruleName: "MingGong_ZhongQi_Adjustment",
      stepKeys: [
        TRACE_STEP_KEYS.mingGong.readBranches,
        TRACE_STEP_KEYS.mingGong.resolveBoundary,
        TRACE_STEP_KEYS.mingGong.finalize,
      ],
    });
    expect(result.explainable.strengthScore?.value).toBe(3.5);
    expect(result.explainable.strengthScore?.trace).toMatchObject({
      engine: "orthodox-override",
      ruleName: "StrengthScore_WeightedSeasonalSupport",
      stepKeys: [
        TRACE_STEP_KEYS.strengthScore.weightStages,
        TRACE_STEP_KEYS.strengthScore.addRelations,
        TRACE_STEP_KEYS.strengthScore.applyPenalties,
      ],
    });
    expect(result.daYun).toHaveLength(9);
    expect(result.daYun[0]).toMatchObject({
      startAge: 4,
      endAge: 13,
      stem: "丁",
      branch: "未",
      upperStageDisplay: resolveDisplayStemPairStage("己", "丁"),
      lowerStageDisplay: resolveDisplayTwelveQiStage("己", "未"),
      upperPhase: {
        startAge: 4,
        endAge: 8,
        symbol: "丁",
        source: "stem",
        twelveQiDisplay: resolveDisplayStemPairStage("己", "丁"),
      },
      lowerPhase: {
        startAge: 9,
        endAge: 13,
        symbol: "未",
        source: "branch",
        twelveQiDisplay: resolveDisplayTwelveQiStage("己", "未"),
      },
    });
    expect(result.daYun.find((entry) => entry.isCurrent)).toMatchObject({
      startAge: 24,
      endAge: 33,
      stem: "乙",
      branch: "巳",
      isCurrent: true,
      currentPhase: "lower",
      upperStageDisplay: resolveDisplayStemPairStage("己", "乙"),
      lowerStageDisplay: resolveDisplayTwelveQiStage("己", "巳"),
      upperPhase: {
        startAge: 24,
        endAge: 28,
        symbol: "乙",
        source: "stem",
        twelveQiDisplay: resolveDisplayStemPairStage("己", "乙"),
        isCurrent: false,
      },
      lowerPhase: {
        startAge: 29,
        endAge: 33,
        symbol: "巳",
        source: "branch",
        twelveQiDisplay: resolveDisplayTwelveQiStage("己", "巳"),
        isCurrent: true,
      },
    });
    expect(result.liuNian).toMatchObject({
      stem: "丙",
      branch: "午",
      upperStageDisplay: resolveDisplayStemPairStage("己", "丙"),
      lowerStageDisplay: resolveDisplayTwelveQiStage("己", "午"),
    });
    expect(result.twelveQi).toEqual(
      expect.objectContaining({
        yearBranch: "หมกยก",
        monthBranch: "หมกยก",
        dayBranch: "ตี้อ๋วง",
        hourBranch: "กวงตั่ว",
        mingGongBranch: "ซี่",
        currentDaYunBranch: "ตี้อ๋วง",
        currentLiuNianBranch: "ลิ่มกัว",
      }),
    );
    expect(result.fourPillars.year).toMatchObject({
      tenGod: "正财",
      stemTranslation: "น้ำ",
      branchTranslation: "วอก",
      sittingStage: "เชี่ยงแซ",
      lookingStage: "หมกยก",
      upperStageDisplay: "หมกยก/เชี่ยงแซ",
      lowerStageDisplay: "หมกยก/เชี่ยงแซ",
    });
    expect(result.fourPillars.day).toMatchObject({
      tenGod: "ดิถี",
      stemTranslation: "ดิน",
      branchTranslation: "มะเส็ง",
      sittingStage: "ตี้อ๋วง",
      lookingStage: "ตี้อ๋วง",
      upperStageDisplay: undefined,
      lowerStageDisplay: "ตี้อ๋วง",
    });
    expect(result.shenSha).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          starName: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
          relatedPillar: "ปี",
        }),
        expect.objectContaining({
          starName: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
          relatedPillar: "เดือน",
        }),
      ]),
    );
    expect(result.dayMasterStrengthProfile).toMatchObject({
      dayMaster: "己",
      strengthState: "อ่อนแอ",
      sourceState: "อ่อนแอ",
      lookupState: "อ่อนแอ",
      displayBand: "ดวงอ่อน",
      displayLabel: "ดิถีอ่อน",
      narrative: expect.stringContaining("ดิถีดินหยินกำลังอ่อน"),
    });
    expect(result.sixtyJiaziCorePersona).toMatchObject({
      code: "己巳",
      narrative:
        "Builds influence patiently, then turns preparation into visible results when timing opens.",
      elementTone: "fire",
      twelveQiLabel: "帝旺",
    });
    expect(result.sixtyJiaziCorePersona?.semanticNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("fire"),
        expect.stringContaining("帝旺"),
      ]),
    );
    expect(result.sixtyJiaziCorePersona?.precedenceNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("巳申"),
      ]),
    );
    expect(result.sixtyJiaziCorePersona?.precedenceNoteSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "NARRATIVE_SUPPORTS_BUT_NOT_OVERRIDE",
        }),
        expect.objectContaining({
          key: "ACTIVE_COMBINATION_PRECEDENCE",
          params: expect.objectContaining({
            label: "巳申",
          }),
        }),
      ]),
    );
    expect(result.compatibilityMatrixProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: "love",
          pairKey: "12เชี่ยงแซความรัก",
          entries: expect.arrayContaining([
            expect.objectContaining({
              code: "A4",
              label: "ลิ่มกัว",
              counterpartBranch: "午",
            }),
            expect.objectContaining({
              code: "A5",
              label: "ตี้อ๋วง",
              counterpartBranch: "巳",
            }),
          ]),
        }),
        expect.objectContaining({
          domain: "work",
          pairKey: "12เชี่ยงแซการงาน",
          entries: expect.arrayContaining([
            expect.objectContaining({
              code: "B3",
              label: "กวงตั่ว",
              counterpartBranch: "未",
            }),
            expect.objectContaining({
              code: "B4",
              label: "ลิ่มกัว",
              counterpartBranch: "酉",
            }),
          ]),
        }),
      ]),
    );
    expect(result.elementMetaphors).toEqual([
      {
        element: "earth",
        metaphor: "fertile cultivated soil that nurtures, absorbs, and organizes",
      },
      {
        element: "fire",
        metaphor: "fire that bakes the soil into useful ground",
      },
    ]);
    expect(result.explainable.strengthScore?.trace?.rawVariables).toMatchObject({
      dayMasterStem: "己",
      monthBranchTwelveQiStage: "沐浴",
      qiAdjustments: expect.any(Array),
      relationAdjustments: expect.any(Array),
      result: 3.5,
    });
    expect(result.explainable.strengthScore?.trace?.rawVariables).not.toHaveProperty("hiddenContributions");
    expect(Array.isArray(result.explainable.strengthScore?.trace?.rawVariables?.visibleContributions)).toBe(true);
    expect(result.elementAnalysis.totalCounts).toEqual({
      wood: 1,
      fire: 2,
      earth: 6,
      metal: 4,
      water: 3,
    });
    expect(result.elementAnalysis.elementStrengths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: "earth",
          rooted: true,
          seasonalSupport: "seasonal-drained",
          strength: "strong",
        }),
        expect.objectContaining({
          element: "metal",
          rooted: true,
          seasonalSupport: "seasonal-peak",
          strength: "strong",
        }),
      ]),
    );
    expect(result.seasonalInteraction).toBeUndefined();
    expect(result.interactionState?.version).toBe("v3-phase-1");
    expect(result.interactionState?.entities.length).toBeGreaterThan(0);
    expect(result.interactionState?.qualifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lane: "twelve-qi",
          qualifierKey: "twelve-qi-stage",
        }),
      ]),
    );
  });

  test("emits generalized interaction state for the 1989 half-trine style runtime case", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1989-01-03",
        birthTime: "08:45",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    expect(result.fourPillars.year).toMatchObject({ stem: "戊", branch: "辰" });
    expect(result.fourPillars.month).toMatchObject({ stem: "甲", branch: "子" });
    expect(result.fourPillars.day).toMatchObject({ stem: "癸", branch: "亥" });
    expect(result.fourPillars.hour).toMatchObject({ stem: "丙", branch: "辰" });

    expect(result.interactionState?.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          familyKey: "heavenly-stem-he",
          label: "戊癸",
        }),
        expect.objectContaining({
          familyKey: "earthly-branch-ban-san-he",
          label: "子辰",
        }),
        expect.objectContaining({
          familyKey: "element-generate",
        }),
      ]),
    );
    expect(result.interactionState?.relations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          familyKey: "earthly-branch-san-he",
          label: "申子辰",
        }),
      ]),
    );
  });

  test("keeps historical Bangkok births on fixed regional offsets instead of political DST", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));

    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1966-09-29",
        birthTime: "11:44",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    expect(result.fourPillars.year).toMatchObject({ stem: "丙", branch: "午" });
    expect(result.fourPillars.month).toMatchObject({ stem: "丁", branch: "酉" });
    expect(result.fourPillars.day).toMatchObject({ stem: "辛", branch: "卯" });
    expect(result.fourPillars.hour).toMatchObject({ stem: "甲", branch: "午" });
  });

  test("keeps Bangkok local time when the hour pillar sits near a two-hour boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));

    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1980-04-05",
        birthTime: "08:23",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    expect(result.fourPillars.year).toMatchObject({ stem: "庚", branch: "申" });
    expect(result.fourPillars.month).toMatchObject({ stem: "庚", branch: "辰" });
    expect(result.fourPillars.day).toMatchObject({ stem: "戊", branch: "申" });
    expect(result.fourPillars.hour).toMatchObject({ stem: "丙", branch: "辰" });
    expect(`${result.fourPillars.hour.stem}${result.fourPillars.hour.branch}`).toBe("丙辰");
    expect(`${result.fourPillars.hour.stem}${result.fourPillars.hour.branch}`).not.toBe("丁巳");
    expect(result.tenGods.hourStem).toBe("偏印");
    expect(result.twelveQi.hourBranch).toBe("กวงตั่ว");
  });

  test("uses Zhong Qi month rollover when deriving Ming Gong for orthodox fixtures", async () => {
    const repository = createTestKnowledgeRepository();

    const novemberCase = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1977-11-27",
        birthTime: "00:26",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );
    const juneCase = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1949-06-25",
        birthTime: "12:00",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    expect(novemberCase.mingGong).toMatchObject({ stem: "乙", branch: "巳" });
    expect(juneCase.mingGong).toMatchObject({ stem: "戊", branch: "辰" });
    expect(novemberCase.explainable.mingGong?.trace?.rawVariables).toMatchObject({
      isPastZhongQi: true,
      monthBranch: "亥",
      adjustedMonthBranch: "子",
      result: "乙巳",
    });
    expect(juneCase.explainable.mingGong?.trace?.rawVariables).toMatchObject({
      isPastZhongQi: true,
      result: "戊辰",
    });
  });
});

describe("CalculatedStateSchema", () => {
  test("accepts legacy calculated state payloads while defaulting phase 1 scaffold collections", () => {
    const parsed = CalculatedStateSchema.parse({
      fourPillars: {
        year: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
        month: { stem: "戊", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
        day: { stem: "己", branch: "巳", hiddenStems: ["丙", "庚", "戊"] },
        hour: { stem: "辛", branch: "未", hiddenStems: ["己", "丁", "乙"] },
      },
      dayMaster: "己",
      strengthScore: 3.07,
      tenGods: {
        yearStem: "正财",
        yearBranch: "伤官,正财,劫财",
        monthStem: "劫财",
        monthBranch: "伤官,正财,劫财",
        dayStem: "比肩",
        dayBranch: "正印,伤官,劫财",
        hourStem: "食神",
        hourBranch: "比肩,偏印,七杀",
      },
      twelveQi: {
        yearBranch: "沐浴",
        monthBranch: "沐浴",
        dayBranch: "帝旺",
        hourBranch: "冠带",
      },
      elementMetaphors: [
        {
          element: "earth",
          metaphor: "fertile cultivated soil that nurtures, absorbs, and organizes",
        },
      ],
    });

    expect(parsed.daYun).toEqual([]);
    expect(parsed.shenSha).toEqual([]);
    expect(parsed.compatibilityMatrixProfiles).toEqual([]);
    expect(parsed.explainable).toEqual({});
    expect(parsed.elementAnalysis.totalCounts).toEqual({
      wood: 0,
      fire: 0,
      earth: 0,
      metal: 0,
      water: 0,
    });
    expect(parsed.elementAnalysis.elementStrengths).toEqual([]);
    expect(parsed.seasonalInteraction).toBeUndefined();
    expect(parsed.mingGong).toBeUndefined();
    expect(parsed.liuNian).toBeUndefined();
    expect(parsed.sixtyJiaziCorePersona?.semanticNotes ?? []).toEqual([]);
    expect(parsed.sixtyJiaziCorePersona?.precedenceNoteSignals ?? []).toEqual([]);
  });
});

describe("createCalculateBaziHandler", () => {
  test("returns a schema-valid calculated state payload", async () => {
    const handler = createCalculateBaziHandler({
      repository: createTestKnowledgeRepository(),
    });
    const response = await handler(
      new Request("http://localhost/api/bazi/calculate", {
        method: "POST",
        body: JSON.stringify({
          birthDate: "1992-08-21",
          birthTime: "14:35",
          gender: "female",
          province: "Bangkok",
          calendarSystem: "solar",
          timezone: "Asia/Hong_Kong",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as { calculatedState: unknown };
    expect(() => CalculatedStateSchema.parse(body.calculatedState)).not.toThrow();
  });

  test("returns 400 when the request body is invalid", async () => {
    const handler = createCalculateBaziHandler({
      repository: createTestKnowledgeRepository(),
    });
    const response = await handler(
      new Request("http://localhost/api/bazi/calculate", {
        method: "POST",
        body: JSON.stringify({
          birthDate: "1992/08/21",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
  });
});

describe("isForwardDaYunDirection", () => {
  function mockLunar(yearGanIndex: number) {
    return { getYearGanIndexExact: () => yearGanIndex };
  }

  test("male + Yang year stem (甲=index 0) → forward", () => {
    expect(isForwardDaYunDirection(mockLunar(0), "male")).toBe(true);
  });

  test("male + Yin year stem (乙=index 1) → backward", () => {
    expect(isForwardDaYunDirection(mockLunar(1), "male")).toBe(false);
  });

  test("female + Yang year stem (丙=index 2) → backward", () => {
    expect(isForwardDaYunDirection(mockLunar(2), "female")).toBe(false);
  });

  test("female + Yin year stem (丁=index 3) → forward", () => {
    expect(isForwardDaYunDirection(mockLunar(3), "female")).toBe(true);
  });

  test("male + Yang year stem (庚=index 6) → forward", () => {
    expect(isForwardDaYunDirection(mockLunar(6), "male")).toBe(true);
  });

  test("female + Yin year stem (癸=index 9) → forward", () => {
    expect(isForwardDaYunDirection(mockLunar(9), "female")).toBe(true);
  });
});
