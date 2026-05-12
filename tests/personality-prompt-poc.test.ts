import { describe, expect, test } from "vitest";

import {
  buildDraftAnnotationDataFromPersonality,
  buildPersonalityFocusPayload,
  buildPersonalityPocSystemInstruction,
  buildPersonalityPocUserPrompt,
} from "@/lib/bazi/personality-prompt-poc";
import { CalculatedStateSchema, type RawInputValue } from "@/lib/bazi/schema-types";

const SAMPLE_RAW_INPUT: RawInputValue = {
  birthDate: "1989-01-03",
  birthTime: "08:45",
  gender: "male",
  province: "Bangkok",
  calendarSystem: "solar",
  timezone: "Asia/Bangkok",
};

const SAMPLE_CALCULATED_STATE = CalculatedStateSchema.parse({
  fourPillars: {
    year: { stem: "戊", branch: "辰", hiddenStems: ["戊", "乙", "癸"] },
    month: { stem: "甲", branch: "子", hiddenStems: ["癸"] },
    day: { stem: "己", branch: "巳", hiddenStems: ["丙", "庚", "戊"] },
    hour: { stem: "戊", branch: "辰", hiddenStems: ["戊", "乙", "癸"] },
  },
  dayMaster: "己",
  strengthScore: 3.25,
  tenGods: {
    yearStem: "劫财",
    monthStem: "正官",
    hourStem: "劫财",
  },
  twelveQi: {
    yearBranch: "衰",
    monthBranch: "绝",
    dayBranch: "帝旺",
    hourBranch: "衰",
  },
  elementAnalysis: {
    visibleCounts: {
      wood: 1,
      fire: 0,
      earth: 2,
      metal: 0,
      water: 1,
    },
    hiddenCounts: {
      wood: 2,
      fire: 1,
      earth: 3,
      metal: 1,
      water: 2,
    },
    totalCounts: {
      wood: 3,
      fire: 1,
      earth: 5,
      metal: 1,
      water: 3,
    },
    missingElements: [],
    dominantElements: ["earth"],
    elementStrengths: [
      {
        element: "earth",
        rooted: true,
        seasonalSupport: "seasonal-support",
        strength: "strong",
      },
      {
        element: "fire",
        rooted: true,
        seasonalSupport: "seasonal-drained",
        strength: "weak",
      },
    ],
  },
  seasonalInteraction: {
    dayMasterStem: "己",
    dayMasterElement: "earth",
    monthBranch: "子",
    season: "winter",
    phase: "peak",
    seasonLabel: "ฤดูหนาวกลางฤดู",
    metaphor: "ดินเย็นที่ต้องอาศัยไฟค่อย ๆ อุ่นก่อนจะแสดงพลังได้เต็มที่",
  },
  dayMasterStrengthProfile: {
    dayMaster: "己",
    strengthState: "แข็งแรง/สมดุล",
    sourceState: "แข็งแรง/สมดุล",
    lookupState: "แข็งแรง/สมดุล",
    displayLabel: "ดิถีค่อนข้างมั่นคง",
    narrative: "ดิถีดินหยินมีแกนตัวตนชัด รับแรงกดดันได้ แต่จะดื้อเงียบเมื่อรู้สึกว่าถูกบีบมากเกินไป",
    qiLabel: "帝旺",
    scoreText: "3.25",
  },
  sixtyJiaziCorePersona: {
    code: "己巳",
    narrative: "เป็นดินที่เก็บพลังและแสดงผลเมื่อจังหวะเปิด จึงดูนิ่งภายนอกแต่มีแรงขับภายในสูง",
    precedenceNotes: ["ใช้แกนดิถีเป็นตัวตั้ง ก่อนค่อยแต้มสีจาก 60 Jiazi"],
  },
  interactionState: {
    version: "v3-phase-1",
    entities: [{ id: "day", type: "pillar", symbol: "己巳", label: "日柱" }],
    relations: [],
    outcomes: [],
    qualifiers: [],
  },
});

describe("personality prompt poc helpers", () => {
  test("builds a focused payload without interaction noise", () => {
    const payload = buildPersonalityFocusPayload(SAMPLE_CALCULATED_STATE);

    expect(Object.keys(payload)).toEqual([
      "dayMasterStrengthProfile",
      "sixtyJiaziCorePersona",
      "elementAnalysis",
      "seasonalInteraction",
    ]);
    expect(payload.dayMasterStrengthProfile?.displayLabel).toBe("ดิถีค่อนข้างมั่นคง");
    expect("interactionState" in payload).toBe(false);
  });

  test("wraps the personality response into a schema-valid draft payload", () => {
    const annotationData = buildDraftAnnotationDataFromPersonality({
      reviewSummary: "นิสัยพื้นฐานมีแกนมั่นคงและควบคุมตัวเองสูง",
      personality: {
        thought_process: "ยึดแกนดิถีเป็นหลัก แล้วใช้ 60 Jiazi กับฤดูกาลเป็นตัวแต้มอารมณ์ของดวง",
        final_prediction: "เป็นคนเก็บอาการ คิดลึก และไม่ชอบเสียการควบคุม แต่เมื่อมั่นใจแล้วจะเดินหน้าแบบเงียบ ๆ และต่อเนื่อง",
        supporting_signals: [
          "dayMasterStrengthProfile=ดิถีค่อนข้างมั่นคง",
          "sixtyJiaziCorePersona=己巳",
          "seasonalInteraction=ฤดูหนาวกลางฤดู",
        ],
      },
    });

    expect(annotationData.dimensions).toHaveLength(15);
    expect(
      annotationData.dimensions.find((dimension) => dimension.dimension_name === "personality_psychology"),
    ).toMatchObject({
      final_prediction: expect.stringContaining("เก็บอาการ"),
    });
  });

  test("states the hierarchy clearly in the system instruction and user prompt", () => {
    const instruction = buildPersonalityPocSystemInstruction();
    const prompt = buildPersonalityPocUserPrompt(SAMPLE_RAW_INPUT, SAMPLE_CALCULATED_STATE);

    expect(instruction).toContain("dayMasterStrengthProfile first");
    expect(instruction).toContain("Ignore interactionState");
    expect(prompt).toContain("personality_psychology dimension only");
    expect(prompt).toContain("dayMasterStrengthProfile -> sixtyJiaziCorePersona -> elementAnalysis -> seasonalInteraction");
    expect(prompt).toContain("Focused personality payload");
  });
});
