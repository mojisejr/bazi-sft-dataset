import { describe, expect, test } from "vitest";

import {
  buildDraftAnnotationDataFromPersonality,
  buildPersonalityFocusPayload,
  PersonalityPocResponseSchema,
  formatPersonalityPocGeneratedReport,
  formatPersonalityPocPreflightReport,
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
          bridge_blocks: [
            {
              title: "ดิถีวางแกนตัวตน",
              signal: "ดิถีค่อนข้างมั่นคงและรับแรงกดดันได้",
              explanation: "คุณเป็นคนที่มีแกนในชัด เวลาตัดสินใจแล้วไม่เปลี่ยนง่าย",
              personality_impact: "จึงทำให้มักควบคุมอารมณ์และทิศทางชีวิตด้วยตัวเอง",
            },
            {
              title: "กะจื่อวันเติมแรงขับ",
              signal: "ฐานวัน己巳ทำให้ภายนอกนิ่งแต่ข้างในมีแรงส่ง",
              explanation: "พอมาเจอฐานวันแบบนี้ จึงไม่ใช่คนนิ่งเฉย แต่เป็นคนนิ่งแล้วค่อยขยับเมื่อเห็นจังหวะ",
              personality_impact: "จึงทำให้เดินหน้าเงียบ ๆ แต่ไม่ยอมแพ้ง่าย",
            },
            {
              title: "ฤดูกาลช่วยแต้มอารมณ์",
              signal: "ฤดูหนาวกลางฤดูทำให้ต้องค่อย ๆ อุ่นพลังตัวเองก่อน",
              explanation: "ด้านในจึงมีช่วงคิดนานและดูอึดอัดก่อนเปิดตัว",
              personality_impact: "จึงทำให้คนอื่นอาจมองว่าช้า แต่จริง ๆ เป็นคนระวังและคิดลึก",
            },
          ],
          final_prediction: "เป็นคนเก็บอาการ คิดลึก และไม่ชอบเสียการควบคุม แต่เมื่อมั่นใจแล้วจะเดินหน้าแบบเงียบ ๆ และต่อเนื่อง",
          supporting_signals: [
            "ดิถีค่อนข้างมั่นคงและรับแรงกดดันได้ดี",
            "ฐานวัน己巳เสริมแรงขับภายใน",
            "ฤดูหนาวกลางฤดูทำให้พลังออกช้าแต่ต่อเนื่อง",
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
    expect(instruction).toContain("Do not use gendered polite particles");
    expect(instruction).toContain("You own the interpretation and the sinsae wording");
    expect(prompt).toContain("personality_psychology dimension only");
    expect(prompt).toContain("คุณเป็นคน... / พอมาเจอ... / จึงทำให้...");
    expect(prompt).toContain("Return exactly 3 or 4 bridge_blocks");
    expect(prompt).toContain("dayMasterStrengthProfile -> sixtyJiaziCorePersona -> elementAnalysis -> seasonalInteraction");
    expect(prompt).toContain("Focused personality payload");
  });

  test("rejects report content that leaks forbidden dev wording", () => {
    expect(() => PersonalityPocResponseSchema.parse({
      reviewSummary: "สรุปนิสัยจาก payload นี้ชัดเจน",
      personality: {
        thought_process: "ใช้ภาษาซินแสปกติ",
        bridge_blocks: [
          {
            title: "แกนแรก",
            signal: "ดิถีมั่นคง",
            explanation: "คุณเป็นคนมีแกน",
            personality_impact: "จึงทำให้ยืนระยะได้",
          },
          {
            title: "แกนสอง",
            signal: "กะจื่อวันหนุนแรงขับ",
            explanation: "พอมาเจอแรงขับภายใน",
            personality_impact: "จึงทำให้ไม่ยอมแพ้ง่าย",
          },
          {
            title: "แกนสาม",
            signal: "ฤดูหนาวแต้มอารมณ์",
            explanation: "ด้านในคิดนาน",
            personality_impact: "จึงทำให้เปิดใจช้า",
          },
        ],
        final_prediction: "เป็นคนมีวินัย",
        supporting_signals: ["ดิถีมั่นคง"],
      },
    })).toThrow("Forbidden report term detected");
  });

  test("formats a preflight report in sinsae-readable Thai without debug headings", () => {
    const report = formatPersonalityPocPreflightReport({
      rawInput: SAMPLE_RAW_INPUT,
      focusPayload: buildPersonalityFocusPayload(SAMPLE_CALCULATED_STATE),
    });

    expect(report).toContain("=== รายงานเตรียมอ่านนิสัยพื้นฐาน ===");
    expect(report).toContain("แกนหลักของดวง");
    expect(report).toContain("สัญญาณที่ใช้ในการอ่าน");
    expect(report).toContain("ลำดับการอ่าน");
    expect(report).not.toContain("payload");
    expect(report).not.toContain("schema");
    expect(report).not.toContain("JSON");
  });

  test("formats a generated report with bridge blocks and client-facing ending", () => {
    const report = formatPersonalityPocGeneratedReport({
      rawInput: SAMPLE_RAW_INPUT,
      focusPayload: buildPersonalityFocusPayload(SAMPLE_CALCULATED_STATE),
      model: "gemini-3-flash-preview",
      response: {
        reviewSummary: "แกนนิสัยชัดแต่ต้องอาศัยวินัยมาช่วยประคอง",
        personality: {
          thought_process: "ยึดดิถีเป็นแกน แล้วค่อยเติมสีจากกะจื่อและธาตุรวม",
          bridge_blocks: [
            {
              title: "ดิถีเป็นแกนใหญ่",
              signal: "ดิถีค่อนข้างมั่นคงและรับแรงกดดันได้",
              explanation: "คุณเป็นคนธาตุดินที่มีแกนชัด รับแรงกดดันได้ แต่จะปิดใจเมื่อถูกบีบมากเกินไป",
              personality_impact: "จึงทำให้เป็นคนเก็บอาการและอยากคุมจังหวะของตัวเอง",
            },
            {
              title: "พอมาเจอกะจื่อวัน",
              signal: "ฐานวัน己巳เติมแรงขับภายใน",
              explanation: "ฐานวัน己巳เติมแรงขับภายใน ทำให้ภายนอกดูนิ่งแต่ข้างในไม่ยอมแพ้ง่าย",
              personality_impact: "จึงทำให้เมื่อมั่นใจแล้วจะเดินหน้าแบบต่อเนื่องและเงียบ",
            },
            {
              title: "ฤดูกาลเข้ามาแต้มอารมณ์",
              signal: "ฤดูหนาวกลางฤดูทำให้พลังออกช้าแต่ไม่ดับ",
              explanation: "เมื่อมาอยู่ในจังหวะหนาว จึงมีด้านที่ระวังและต้องใช้เวลาอุ่นใจก่อนเปิดตัว",
              personality_impact: "จึงทำให้คนรอบตัวรู้สึกว่าเข้าถึงช้า แต่ถ้าไว้ใจแล้วจะไปยาว",
            },
          ],
          final_prediction: "คุณเป็นคนคิดลึก มีแรงขับเงียบ และถ้าจัดระบบชีวิตให้ดี ศักยภาพจะออกผลชัดมาก",
          supporting_signals: ["ดิถีค่อนข้างมั่นคง", "กะจื่อวัน己巳"],
          confidence_note: "มั่นใจระดับสูง เพราะแกนดิถีกับฐานวันไปในทิศเดียวกัน",
        },
      },
    });

    expect(report).toContain("=== รายงานนิสัยพื้นฐานแบบซินแส ===");
    expect(report).toContain("คำอธิบายแบบซินแส");
    expect(report).toContain("1. ดิถีเป็นแกนใหญ่");
    expect(report).toContain("สัญญาณ: ดิถีค่อนข้างมั่นคงและรับแรงกดดันได้");
    expect(report).toContain("จึงทำให้:");
    expect(report).toContain("คำทำนายพร้อมส่งลูกค้า");
    expect(report).toContain("ภาคผนวกเทคนิค");
    expect(report).toContain("- รุ่นที่ใช้: gemini-3-flash-preview");
    expect(report).not.toContain("สัญญาณประกอบที่ AI ถือไว้");
  });
});
