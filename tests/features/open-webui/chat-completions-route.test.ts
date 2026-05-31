import { describe, expect, test } from "vitest";

import { buildOpenWebUiExecutionContext } from "@/app/api/v1/chat/completions/route";
import { CalculatedStateSchema } from "@/lib/bazi/schema-types";

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
  daYun: [
    {
      startAge: 42,
      endAge: 51,
      stem: "辛",
      branch: "酉",
      isCurrent: true,
      currentPhase: "upper",
      upperStageDisplay: "冠带",
      lowerStageDisplay: "临官",
    },
  ],
  liuNian: { stem: "丙", branch: "午", hiddenStems: ["丁", "己"] },
  shenSha: [],
  elementAnalysis: {
    visibleCounts: { wood: 0, fire: 0, earth: 2, metal: 2, water: 1 },
    hiddenCounts: { wood: 1, fire: 2, earth: 3, metal: 2, water: 2 },
    totalCounts: { wood: 1, fire: 2, earth: 5, metal: 4, water: 3 },
    missingElements: [],
    dominantElements: ["earth"],
    elementStrengths: [],
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
  dayMasterStrengthProfile: {
    dayMaster: "己",
    strengthState: "strong",
    displayLabel: "ดวงแข็งแรง",
    narrative: "ดิถีมีกำลังและยืนได้ด้วยฐานของตัวเอง",
    qiLabel: "帝旺",
  },
  sixtyJiaziCorePersona: {
    code: "己巳",
    narrative: "Measured earth that grows through patience and timing.",
    precedenceNotes: ["Respect seasonal balance before reading annual timing."],
  },
  compatibilityMatrixProfiles: [
    {
      domain: "love",
      pairKey: "day-branch",
      entries: [
        {
          code: "harmonic",
          label: "คู่ที่คุยกันรู้เรื่อง",
          counterpartBranch: "酉",
          narrative: "สัมพันธ์ดีเมื่อค่อย ๆ สร้างความไว้ใจ",
        },
      ],
    },
  ],
  baseChartReading: {
    roleBadges: [],
    stemInteractionBadges: [],
    branchInteractionBadges: [],
    markerBadges: [],
    groups: [],
    legendItems: [],
    readingOrderSteps: ["ดูดิถีก่อน"],
  },
});

const SAMPLE_CHAT_RESULT = {
  baziConsult: {
    rawInput: {
      birthDate: "1992-08-12",
      birthTime: "09:15",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    },
    calculatedState: SAMPLE_CALCULATED_STATE,
  },
} as const;

describe("buildOpenWebUiExecutionContext", () => {
  test("attaches a narrowed truth packet only for Bazi consult traffic", () => {
    const executionContext = buildOpenWebUiExecutionContext(SAMPLE_CHAT_RESULT, {
      intent: "wealth",
      requiresBaziConsult: true,
      confidence: 0.94,
    });

    expect(executionContext.intentClassification?.intent).toBe("wealth");
    expect(executionContext.baziConsult?.truthPacket).toContain('"intent": "wealth"');
    expect(executionContext.baziConsult?.truthPacket).toContain('"financeTenGodHighlights"');
  });

  test("keeps non-Bazi traffic stateless by bypassing truth-packet attachment", () => {
    const executionContext = buildOpenWebUiExecutionContext(SAMPLE_CHAT_RESULT, {
      intent: "chit_chat",
      requiresBaziConsult: false,
      confidence: 0.2,
    });

    expect(executionContext.intentClassification?.intent).toBe("chit_chat");
    expect(executionContext.baziConsult?.rawInput.birthDate).toBe("1992-08-12");
    expect(executionContext.baziConsult?.truthPacket).toBeNull();
  });
});