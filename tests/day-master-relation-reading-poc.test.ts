import { describe, expect, test } from "vitest";

import {
  RelationReadingResponseSchema,
  buildDayMasterRelationPacket,
  buildDayMasterRelationPocSystemInstruction,
  buildDayMasterRelationPocUserPrompt,
  formatDayMasterRelationPocGeneratedReport,
  formatDayMasterRelationPocPreflightReport,
} from "@/lib/bazi/day-master-relation-reading-poc";
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
  tenGods: {},
  twelveQi: {},
  elementAnalysis: {
    visibleCounts: { wood: 1, fire: 0, earth: 2, metal: 0, water: 1 },
    hiddenCounts: { wood: 2, fire: 1, earth: 3, metal: 1, water: 2 },
    totalCounts: { wood: 3, fire: 1, earth: 5, metal: 1, water: 3 },
    missingElements: [],
    dominantElements: ["earth"],
    elementStrengths: [],
  },
  dayMasterStrengthProfile: {
    dayMaster: "己",
    strengthState: "แข็งแรง/สมดุล",
    sourceState: "แข็งแรง/สมดุล",
    lookupState: "แข็งแรง/สมดุล",
    displayLabel: "ดิถีค่อนข้างมั่นคง",
    narrative: "ดิถีดินหยินมีแกนตัวตนชัด รับแรงกดดันได้",
    qiLabel: "帝旺",
    scoreText: "3.25",
  },
});

describe("day master relation reading poc", () => {
  test("builds a packet with 8 slots and relation summary", () => {
    const packet = buildDayMasterRelationPacket(SAMPLE_CALCULATED_STATE);

    expect(packet.eightSlots).toHaveLength(8);
    expect(packet.relationSummary).toHaveLength(5);
    expect(packet.chartAnchor.activeRelationKey).toBe("output");
    expect(packet.chartAnchor.activeRelationLabelThai).toBe("ธาตุถ่ายเท");
    expect(packet.activeRelationTargets[0]?.relationKey).toBe("output");
  });

  test("states the visible contract in prompt text", () => {
    const packet = buildDayMasterRelationPacket(SAMPLE_CALCULATED_STATE);
    const instruction = buildDayMasterRelationPocSystemInstruction();
    const prompt = buildDayMasterRelationPocUserPrompt(SAMPLE_RAW_INPUT, packet);

    expect(instruction).toContain("fact sentence");
    expect(instruction).toContain("bridge sentence");
    expect(instruction).toContain("Do not mention JSON, schema, payload, model, AI");
    expect(prompt).toContain("Use the visible flow: fact -> bridge -> scene -> risk.");
    expect(prompt).toContain("Relation reading packet:");
  });

  test("rejects reading output that leaks forbidden dev wording", () => {
    expect(() => RelationReadingResponseSchema.parse({
      title: "สรุปจาก payload relation",
      summary: "ภาพรวมปกติ",
      scenes: [
        {
          scene_key: "ฉากหนึ่ง",
          fact_sentence: "ดิถีเปิดแรงตามปกติ",
          bridge_sentence: "พลังจึงไหลไปตาม schema เดิม",
          interpretation: "จึงเกิดการแปลความธรรมดา",
          risk_or_advice: "ระวังใช้แรงมากไป",
        },
        {
          scene_key: "ฉากสอง",
          fact_sentence: "อีกด้านหนึ่งยังคงนิ่ง",
          bridge_sentence: "จึงทำให้ภาพรวมไม่หลุด",
          interpretation: "ยังพอประคองได้",
          risk_or_advice: "ค่อย ๆ เดินจะดีกว่า",
        },
      ],
      closing_reading: "ภาพรวมใช้ได้",
    })).toThrow("Forbidden reading term detected");
  });

  test("formats preflight and generated reports with proof tables", () => {
    const packet = buildDayMasterRelationPacket(SAMPLE_CALCULATED_STATE);
    const preflight = formatDayMasterRelationPocPreflightReport({
      rawInput: SAMPLE_RAW_INPUT,
      packet,
    });
    const report = formatDayMasterRelationPocGeneratedReport({
      rawInput: SAMPLE_RAW_INPUT,
      packet,
      model: "gemini-3-flash-preview",
      response: {
        title: "ภาพรวมการเดินแรงของดิถี",
        summary: "ดวงนี้เปิดการอ่านจากธาตุถ่ายเทเป็นหลัก",
        scenes: [
          {
            scene_key: "ดิถีเริ่มปล่อยแรงออกจากตัว",
            fact_sentence: "ดิถีดินของดวงนี้มีแรงถ่ายเทไปหาธาตุทองก่อน",
            bridge_sentence: "เมื่อแรงของดิถีไปออกที่ทอง จึงแปลว่าพลังการแสดงออกและสิ่งที่เจ้าชะตาปล่อยออกไปจะเด่นขึ้น",
            interpretation: "เจ้าชะตามักไม่เก็บทุกอย่างไว้ในใจ แต่มีความต้องการผลักสิ่งที่คิดให้ออกมาเป็นงานหรือการกระทำ",
            risk_or_advice: "ถ้าปล่อยแรงมากเกินไป อาจกลายเป็นคนรับงานหรือแบกการแสดงออกมากจนล้าได้",
          },
          {
            scene_key: "แรงไปออกในพื้นที่ชีวิตใกล้ตัวก่อน",
            fact_sentence: "เป้าหมายหลักของธาตุถ่ายเทไปตกที่วันล่างแฝงก่อนตำแหน่งอื่น",
            bridge_sentence: "จึงแปลว่าเรื่องที่เจ้าชะตาปล่อยแรงออกไปมักเกิดในพื้นที่ชีวิตใกล้ตัวหรือเรื่องที่เกี่ยวกับตัวเองโดยตรงก่อน",
            interpretation: "ภาพที่เห็นคือเป็นคนทำเอง เอาเอง และผลักเรื่องให้เดินจากพื้นที่ที่ควบคุมได้",
            risk_or_advice: "ข้อควรระวังคือถ้าทำทุกอย่างเองมากไป จะเหนื่อยโดยไม่รู้ตัว",
          },
        ],
        closing_reading: "โดยรวมแล้วดวงนี้เป็นคนที่พลังการแสดงออกเดินก่อน และมักเริ่มผลักสิ่งต่าง ๆ จากพื้นที่ชีวิตใกล้ตัวของตัวเอง",
      },
    });

    expect(preflight).toContain("ตาราง 8 ช่อง");
    expect(preflight).toContain("ตาราง relation ของดิถี");
    expect(preflight).toContain("รายละเอียดธาตุถ่ายเท");
    expect(report).toContain("คำอธิบายแบบซินแส");
    expect(report).toContain("ภาคผนวกเทคนิค");
    expect(report).toContain("- รุ่นที่ใช้: gemini-3-flash-preview");
  });
});
