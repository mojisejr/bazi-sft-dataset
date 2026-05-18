import { describe, expect, test } from "vitest";

import {
  generateHybridSinsaeDraft,
  resolveHybridDimensionPlans,
} from "@/lib/bazi/hybrid-sinsae-draft-generator";
import {
  CalculatedStateSchema,
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type AnnotationDimensionName,
  type RawInputValue,
} from "@/lib/bazi/schema-types";

const SAMPLE_RAW_INPUT: RawInputValue = {
  birthDate: "1981-03-12",
  birthTime: "05:59",
  gender: "male",
  province: "Bangkok",
  calendarSystem: "solar",
  timezone: "Asia/Bangkok",
};

const SAMPLE_CALCULATED_STATE = CalculatedStateSchema.parse({
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
    monthStem: "劫财",
    hourStem: "食神",
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
      metaphor: "fertile cultivated soil that responds well to disciplined care",
    },
  ],
  elementAnalysis: {
    visibleCounts: {
      wood: 0,
      fire: 0,
      earth: 2,
      metal: 2,
      water: 1,
    },
    hiddenCounts: {
      wood: 1,
      fire: 2,
      earth: 3,
      metal: 2,
      water: 2,
    },
    totalCounts: {
      wood: 1,
      fire: 2,
      earth: 5,
      metal: 4,
      water: 3,
    },
    missingElements: [],
    dominantElements: ["earth"],
    elementStrengths: [
      {
        element: "earth",
        rooted: true,
        seasonalSupport: "seasonal-peak",
        strength: "strong",
      },
      {
        element: "wood",
        rooted: false,
        seasonalSupport: "seasonal-drained",
        strength: "weak",
      },
    ],
  },
  seasonalInteraction: {
    dayMasterStem: "己",
    dayMasterElement: "earth",
    monthBranch: "申",
    season: "autumn",
    phase: "peak",
    seasonLabel: "ฤดูใบไม้ร่วงช่วงต้น",
    metaphor: "ดินที่ต้องอาศัยไฟช่วยประคองก่อนจะจับรูปได้มั่นคง",
  },
  sixtyJiaziCorePersona: {
    code: "己巳",
    narrative: "Measured earth that grows through patience and timing.",
    precedenceNotes: ["Respect seasonal balance before reading annual timing."],
  },
  dayMasterStrengthProfile: {
    dayMaster: "己",
    strengthState: "strong",
    displayLabel: "ดวงแข็งแรง",
    narrative: "ดิถีมีกำลังและยืนได้ด้วยฐานของตัวเอง",
    qiLabel: "帝旺",
  },
  ageSnapshot: {
    thaiAge: 45,
    chineseAge: 46,
    referenceDate: "2026-04-24",
  },
  daYun: [
    {
      startAge: 42,
      endAge: 51,
      stem: "壬",
      branch: "子",
      isCurrent: true,
      currentPhase: "upper",
      upperPhase: {
        startAge: 42,
        endAge: 46,
        symbol: "壬",
        source: "stem",
      },
      lowerPhase: {
        startAge: 47,
        endAge: 51,
        symbol: "子",
        source: "branch",
      },
    },
  ],
  liuNian: {
    stem: "甲",
    branch: "午",
    hiddenStems: ["丁", "己"],
  },
  shenSha: [],
  compatibilityMatrixProfiles: [],
  baseChartReading: {
    readingOrderSteps: ["ดูดิถีก่อน", "ดูฤดูกาล", "ดูแรงหนุน"],
    summary: "เริ่มที่แกนดิถีและฤดูกาลก่อนมิติอื่น",
    badges: [],
    narrativeBlocks: [],
  },
});

describe("hybrid sinsae draft generator", () => {
  test("classifies retrieval-template and ai-fallback dimensions from the plan-aligned packets", async () => {
    const plans = await resolveHybridDimensionPlans(SAMPLE_CALCULATED_STATE, {
      repoRoot: "/Users/non/dev/opilot/projects/bazi",
    });

    expect(plans).toHaveLength(REQUIRED_ANNOTATION_DIMENSION_NAMES.length);
    expect(plans.find((entry) => entry.dimensionName === "personality_psychology")?.source).toBe("retrieval-template");
    expect(plans.find((entry) => entry.dimensionName === "ten_gods_reaction")?.source).toBe("ai-fallback");
    expect(plans.filter((entry) => entry.source === "ai-fallback").map((entry) => entry.dimensionName)).toEqual([
      "chart_foundation",
      "balance_element",
      "ten_gods_reaction",
      "major_luck_cycles",
      "annual_star_energy",
      "red_flags",
      "actionable_advice",
      "core_prediction",
    ]);
  });

  test("builds a 15-dimension draft payload and triggers fallback only for planned dimensions", async () => {
    const fallbackCalls: AnnotationDimensionName[] = [];
    const result = await generateHybridSinsaeDraft({
      rawInput: SAMPLE_RAW_INPUT,
      calculatedState: SAMPLE_CALCULATED_STATE,
      repoRoot: "/Users/non/dev/opilot/projects/bazi",
      dependencies: {
        generateFallbackDimension: async ({ retrievalPacket }) => {
          fallbackCalls.push(retrievalPacket.dimensionName);

          return {
            dimension_name: retrievalPacket.dimensionName,
            thought_process: `อ่านมิติ ${retrievalPacket.dimensionName} จาก engine truth และ fallback packet อย่างจำกัด`,
            final_prediction: `สรุป ${retrievalPacket.dimensionName} โดยไม่สร้าง chart facts เพิ่ม`,
            supporting_signals: [
              `dimension=${retrievalPacket.dimensionName}`,
              `tier=${retrievalPacket.tier}`,
            ],
          };
        },
      },
    });

    expect(result.annotationData.dimensions).toHaveLength(REQUIRED_ANNOTATION_DIMENSION_NAMES.length);
    expect(new Set(result.annotationData.dimensions.map((entry) => entry.dimension_name)).size).toBe(
      REQUIRED_ANNOTATION_DIMENSION_NAMES.length,
    );
    expect(fallbackCalls).toEqual([
      "chart_foundation",
      "balance_element",
      "ten_gods_reaction",
      "major_luck_cycles",
      "annual_star_energy",
      "red_flags",
      "actionable_advice",
      "core_prediction",
    ]);
    expect(
      result.annotationData.dimensions.find((entry) => entry.dimension_name === "personality_psychology")?.thought_process,
    ).toContain("engine truth");
  });

  test("keeps raw input and calculated state immutable while passing fallback only the engine-bound packet", async () => {
    const originalRawInput = structuredClone(SAMPLE_RAW_INPUT);
    const originalCalculatedState = structuredClone(SAMPLE_CALCULATED_STATE);
    const receivedPackets: Array<{
      dimensionName: AnnotationDimensionName;
      evidenceCount: number;
      dayMaster: string;
    }> = [];

    await generateHybridSinsaeDraft({
      rawInput: SAMPLE_RAW_INPUT,
      calculatedState: SAMPLE_CALCULATED_STATE,
      repoRoot: "/Users/non/dev/opilot/projects/bazi",
      dependencies: {
        generateFallbackDimension: async ({ calculatedState, retrievalPacket }) => {
          receivedPackets.push({
            dimensionName: retrievalPacket.dimensionName,
            evidenceCount: retrievalPacket.evidence.length,
            dayMaster: calculatedState.dayMaster,
          });

          return {
            dimension_name: retrievalPacket.dimensionName,
            thought_process: `ยึด ${calculatedState.dayMaster} เป็น truth แล้วค่อยอธิบาย ${retrievalPacket.dimensionName}`,
            final_prediction: `อ่าน ${retrievalPacket.dimensionName} จาก packet ที่ส่งมาเท่านั้น`,
            supporting_signals: [`dayMaster=${calculatedState.dayMaster}`],
          };
        },
      },
    });

    expect(SAMPLE_RAW_INPUT).toEqual(originalRawInput);
    expect(SAMPLE_CALCULATED_STATE).toEqual(originalCalculatedState);
    expect(receivedPackets.every((entry) => entry.dayMaster === SAMPLE_CALCULATED_STATE.dayMaster)).toBe(true);
    expect(receivedPackets.find((entry) => entry.dimensionName === "ten_gods_reaction")?.evidenceCount).toBe(0);
  });
});
