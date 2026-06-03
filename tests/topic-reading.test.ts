import { describe, expect, test } from "vitest";

import { CalculatedStateSchema } from "@/lib/bazi/schema-types";
import {
  buildTopicEngineReading,
  getTopicDefinition,
  selectTopicEvidenceDimension,
  TOPIC_PATH,
} from "@/lib/bazi/topic-reading";

/**
 * Fixture = เคสตัวอย่างใน example/M.docx (8 มิ.ย. 2531, หญิง)
 * ดิถี 己 (ดิน) อ่อน, เสา 癸酉 / 癸亥 / 己酉 / 壬申
 *  - output (ถ่ายเท) = metal → 酉, 申
 *  - wealth (โชคลาภ) = water → 癸, 壬, 亥
 * ตรงกับวิธีอ่านในเอกสารต้นฉบับ
 */
const SAMPLE_CALCULATED_STATE = CalculatedStateSchema.parse({
  fourPillars: {
    year: { stem: "癸", branch: "酉", hiddenStems: ["辛"], tenGod: "偏财", upperStageDisplay: "แป่", lowerStageDisplay: "เชี่ยงแซ" },
    month: { stem: "癸", branch: "亥", hiddenStems: ["壬", "甲"], upperStageDisplay: "ตี้อ๋วง", lowerStageDisplay: "ตี้อ๋วง" },
    day: { stem: "己", branch: "酉", hiddenStems: ["辛"], upperStageDisplay: "เชี่ยงแซ", lowerStageDisplay: "เชี่ยงแซ" },
    hour: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"], upperStageDisplay: "หมกยก", lowerStageDisplay: "เชี่ยงแซ" },
  },
  dayMaster: "己",
  strengthScore: 2.1,
  tenGods: {},
  twelveQi: {
    yearBranch: "แป่",
    monthBranch: "ตี้อ๋วง",
    dayBranch: "เชี่ยงแซ",
    hourBranch: "หมกยก",
  },
  elementAnalysis: {
    visibleCounts: { wood: 0, fire: 0, earth: 1, metal: 2, water: 3 },
    hiddenCounts: { wood: 1, fire: 0, earth: 1, metal: 2, water: 2 },
    totalCounts: { wood: 1, fire: 0, earth: 2, metal: 4, water: 5 },
    missingElements: ["fire"],
    dominantElements: ["water", "metal"],
    elementStrengths: [],
  },
  dayMasterStrengthProfile: {
    dayMaster: "己",
    strengthState: "อ่อน",
    displayLabel: "ดิถีอ่อน",
    narrative: "ดิถีดินอ่อน ถูกแวดล้อมด้วยน้ำและทอง พลังตัวเองถูกดึงไปใช้มาก",
    qiLabel: "長生",
    scoreText: "2.10",
  },
  sixtyJiaziCorePersona: {
    code: "己酉",
    narrative: "ดินจับคู่ทองถ่ายเท เป็นคนชอบค้นคว้าและพัฒนาอย่างต่อเนื่อง",
    semanticNotes: [],
    precedenceNotes: [],
  },
  elementMetaphors: [
    { element: "water", metaphor: "น้ำที่ไหลรอบตัวคือโชคลาภที่ต้องหมุนเวียน" },
    { element: "fire", metaphor: "ไฟที่ขาดคือแรงอุ่นที่ต้องเสริม" },
  ],
  daYun: [
    {
      startAge: 5,
      endAge: 14,
      stem: "壬",
      branch: "戌",
      upperPhase: { startAge: 5, endAge: 9, symbol: "壬", source: "stem", twelveQiDisplay: "หมกยก" },
      lowerPhase: { startAge: 10, endAge: 14, symbol: "戌", source: "branch", twelveQiDisplay: "เอี้ยง" },
    },
    {
      startAge: 40,
      endAge: 49,
      stem: "戊",
      branch: "未",
      isCurrent: true,
      upperPhase: { startAge: 40, endAge: 44, symbol: "戊", source: "stem", twelveQiDisplay: "ซี่", isCurrent: true },
      lowerPhase: { startAge: 45, endAge: 49, symbol: "未", source: "branch", twelveQiDisplay: "กวงตั่ว" },
    },
  ],
});

describe("topic-reading path", () => {
  test("TOPIC_PATH = Calculated Basis + 15 บท ที่ chapter ไม่ซ้ำ", () => {
    expect(TOPIC_PATH).toHaveLength(16);
    expect(TOPIC_PATH[0]?.kind).toBe("basis");
    const chapters = TOPIC_PATH.map((topic) => topic.chapter);
    expect(chapters).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(new Set(TOPIC_PATH.map((topic) => topic.id)).size).toBe(16);
  });

  test("getTopicDefinition โยน error เมื่อ id ไม่รู้จัก", () => {
    expect(() => getTopicDefinition("not-a-topic")).toThrow();
  });

  test("Calculated Basis คืนตาราง 4 เสา + วัยจรแบบ 5 ปี (2 แถว/เสา)", () => {
    const reading = buildTopicEngineReading(SAMPLE_CALCULATED_STATE, "calculated_basis");
    expect(reading.basis).toBeDefined();
    expect(reading.basis?.pillars).toHaveLength(4);
    expect(reading.basis?.pillars[2]?.stem).toBe("己");
    // 2 เสา × 2 phase = 4 แถว 5 ปี
    expect(reading.basis?.daYun).toHaveLength(4);
    expect(reading.basis?.daYun[0]?.ageRange).toBe("5-9 ปี");
    expect(reading.basis?.daYun[0]?.source).toContain("ก้าน");
    expect(reading.basis?.daYun[1]?.source).toContain("กิ่ง");
    expect(reading.basis?.daYun.some((row) => row.isCurrent)).toBe(true);
  });

  test("โชคลาภ: ตารางอ้างธาตุน้ำ (wealth) ตามวิธีอ่านในเอกสาร", () => {
    const reading = buildTopicEngineReading(SAMPLE_CALCULATED_STATE, "wealth_and_investment");
    expect(reading.table.length).toBeGreaterThan(0);
    const wealthRow = reading.table[0];
    expect(wealthRow?.relationResult).toContain("น้ำ");
    expect(wealthRow?.timing).toBe("ตลอดชีวิต");
    expect(reading.method.some((line) => line.includes("ขั้นที่ 4"))).toBe(true);
    expect(reading.prose.length).toBeGreaterThan(0);
  });

  test("อาชีพ: ตารางอ้างธาตุทอง (output/ถ่ายเท)", () => {
    const reading = buildTopicEngineReading(SAMPLE_CALCULATED_STATE, "career_potential");
    expect(reading.table[0]?.relationResult).toContain("ทอง");
  });

  test("turning_points คืน daYunTimeline แบบ 5 ปี", () => {
    const reading = buildTopicEngineReading(SAMPLE_CALCULATED_STATE, "turning_points");
    expect(reading.daYunTimeline).toBeDefined();
    expect(reading.daYunTimeline?.length).toBe(4);
    expect(reading.daYunTimeline?.[0]?.symbol).toBe("壬");
    expect(reading.daYunTimeline?.[0]?.stage).toBe("หมกยก");
  });

  test("คำอ่าน engine มีคำอธิบาย ไม่ใช่แค่ศัพท์", () => {
    const reading = buildTopicEngineReading(SAMPLE_CALCULATED_STATE, "wealth_and_investment");
    expect(reading.prose.some((paragraph) => paragraph.includes("ความหมายคือ"))).toBe(true);
  });

  test("ทุกหัวข้อ predict มี method และ prose ไม่ว่าง", () => {
    for (const topic of TOPIC_PATH.filter((entry) => entry.kind === "predict")) {
      const reading = buildTopicEngineReading(SAMPLE_CALCULATED_STATE, topic.id);
      expect(reading.method.length).toBeGreaterThan(0);
      expect(reading.prose.length).toBeGreaterThan(0);
    }
  });

  test("selectTopicEvidenceDimension: basis = null, predict = มีมิติ", () => {
    expect(selectTopicEvidenceDimension("calculated_basis")).toBeNull();
    expect(selectTopicEvidenceDimension("wealth_and_investment")).toBe("wealth_and_investment");
  });
});
