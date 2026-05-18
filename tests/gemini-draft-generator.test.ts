import { describe, expect, test } from "vitest";

import {
  buildCompactCalculatedState,
  buildSystemInstruction,
  extractReferenceCaseExcerpt,
  GeneratedDraftAnnotationDataSchema,
  selectReferenceCaseExamplePaths,
} from "@/lib/bazi/gemini-draft-generator";
import {
  CalculatedStateSchema,
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
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
    precedenceNoteSignals: [
      {
        key: "ACTIVE_COMBINATION_PRECEDENCE",
        params: {
          label: "巳申",
        },
      },
    ],
  },
  ageSnapshot: {
    thaiAge: 45,
    chineseAge: 46,
    referenceDate: "2026-04-24",
  },
  dayMasterStrengthProfile: {
    dayMaster: "己",
    strengthState: "strong",
    displayLabel: "ดวงแข็งแรง",
    narrative: "ดิถีมีกำลังและยืนได้ด้วยฐานของตัวเอง",
    qiLabel: "帝旺",
  },
  interactionState: {
    version: "v3-phase-1",
    entities: [],
    relations: [],
    outcomes: [],
    qualifiers: [],
  },
  baseChartReading: {
    roleBadges: [],
    stemInteractionBadges: [],
    branchInteractionBadges: [],
    markerBadges: [],
    groups: [],
    legendItems: [],
    readingOrderSteps: ["ดูดิถีก่อน", "ดูฤดูกาล", "ดูแรงหนุน"],
  },
});

describe("gemini draft generator helpers", () => {
  test("extracts only the relevant reference excerpt", () => {
    const markdown = `# DNA

เกิดวันที่ 12 มีนาคม พ.ศ.2524 เวลา 05.59 น.

คุณเป็นคนเกิดวันธาตุดินพลังหยิน มีความจริงจังและรอบคอบ

## สภาพธรรมชาติตามพื้นที่ดวง

ส่วนนี้ไม่ควรถูกดึงมา`;

    const excerpt = extractReferenceCaseExcerpt(markdown, 400);

    expect(excerpt).toContain("เกิดวันที่ 12 มีนาคม พ.ศ.2524 เวลา 05.59 น.");
    expect(excerpt).toContain("คุณเป็นคนเกิดวันธาตุดินพลังหยิน");
    expect(excerpt).not.toContain("สภาพธรรมชาติตามพื้นที่ดวง");
  });

  test("selects deterministic rotating reference paths", () => {
    const selected = selectReferenceCaseExamplePaths(SAMPLE_RAW_INPUT, [
      "/tmp/case1.md",
      "/tmp/case2.md",
      "/tmp/case3.md",
    ]);

    expect(selected.length).toBe(2);
    expect(selected).toEqual(selectReferenceCaseExamplePaths(SAMPLE_RAW_INPUT, [
      "/tmp/case1.md",
      "/tmp/case2.md",
      "/tmp/case3.md",
    ]));
  });

  test("requires complete non-empty generated dimensions", () => {
    expect(() =>
      GeneratedDraftAnnotationDataSchema.parse({
        version: "1.6",
        reviewSummary: "สรุปภาพรวมของดวงนี้อย่างกระชับ",
        dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
          dimension_name: dimensionName,
          thought_process: `วิเคราะห์ ${dimensionName}`,
          final_prediction: `สรุป ${dimensionName}`,
          supporting_signals: ["dayMaster=己", "monthBranch=卯"],
        })),
      }),
    ).not.toThrow();

    expect(() =>
      GeneratedDraftAnnotationDataSchema.parse({
        version: "1.6",
        reviewSummary: "สรุปภาพรวมของดวงนี้อย่างกระชับ",
        dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
          dimension_name: dimensionName,
          thought_process: dimensionName === "chart_foundation" ? "" : "มีข้อมูล",
          final_prediction: "สรุปผล",
          supporting_signals: ["dayMaster=己"],
        })),
      }),
    ).toThrow();
  });

  test("builds compact state with Thai context signals for Gemini", () => {
    const compact = buildCompactCalculatedState(SAMPLE_CALCULATED_STATE);

    expect(compact.ageSnapshot).toEqual({
      thaiAge: 45,
      chineseAge: 46,
      referenceDate: "2026-04-24",
    });

    expect(compact.thaiContextSignals).toEqual(
      expect.objectContaining({
        seasonalInteraction: {
          seasonLabel: "ฤดูใบไม้ร่วงช่วงต้น",
          metaphor: "ดินที่ต้องอาศัยไฟช่วยประคองก่อนจะจับรูปได้มั่นคง",
        },
        dominantElements: [{ element: "earth", elementLabelThai: "ดิน" }],
        missingElements: [],
      }),
    );

    expect(compact.thaiContextSignals.elementStrengths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: "earth",
          elementLabelThai: "ดิน",
          totalCount: 5,
          strength: "strong",
          strengthLabelThai: "กำลังเด่น",
          rooted: true,
          rootLabelThai: "มีราก",
          seasonalSupport: "seasonal-peak",
          seasonalSupportLabelThai: "ฤดูหนุนสูง",
        }),
        expect.objectContaining({
          element: "wood",
          elementLabelThai: "ไม้",
          strength: "weak",
          strengthLabelThai: "กำลังอ่อน",
          rooted: false,
          rootLabelThai: "ไร้ราก",
          seasonalSupport: "seasonal-drained",
          seasonalSupportLabelThai: "ฤดูถ่ายแรง",
        }),
      ]),
    );

    expect(compact.thaiContextSignals.contextRuleNotes).toContain(
      "ฮะ 巳申 ทำงานก่อน และมีน้ำหนักเหนือความปะทะที่แตะกิ่งเดียวกัน",
    );
    expect(compact.dayMasterStrengthProfile).toEqual(
      expect.objectContaining({
        dayMaster: "己",
        displayLabel: "ดวงแข็งแรง",
      }),
    );
    expect(compact.interactionSignals).toEqual(
      expect.objectContaining({
        relations: [],
        outcomes: [],
        qualifiers: [],
      }),
    );
    expect(compact.baseChartReading).toEqual(
      expect.objectContaining({
        summary: "ดูดิถีก่อน",
        readingOrderSteps: ["ดูดิถีก่อน", "ดูฤดูกาล", "ดูแรงหนุน"],
      }),
    );
  });

  test("system instruction tells Gemini to trust Thai context signals over count-only intuition", () => {
    const instruction = buildSystemInstruction();

    expect(instruction).toContain("Mumate");
    expect(instruction).toContain("ageSnapshot");
    expect(instruction).toContain("thaiContextSignals");
    expect(instruction).toContain("Do not reduce elemental balance to counts alone");
    expect(instruction).toContain("precedenceNoteSignals");
    expect(instruction).toContain("dayMasterStrengthProfile first");
    expect(instruction).toContain("baseChartReading second");
    expect(instruction).toContain("interactionSignals");
  });
});
