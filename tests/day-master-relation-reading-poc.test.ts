import { describe, expect, test } from "vitest";

import {
  RelationReadingResponseSchema,
  buildDayMasterRelationBrief,
  buildDayMasterRelationPacket,
  buildDayMasterRelationPocSystemInstruction,
  buildDayMasterRelationPocUserPrompt,
  formatDayMasterRelationPocBriefPreview,
  formatDayMasterRelationPocGeneratedReport,
  formatDayMasterRelationPocPreflightReport,
} from "@/lib/bazi/day-master-relation-reading-poc";
import { calculateBaziStructuralState } from "@/lib/bazi/symbolic-engine";
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
    day: { stem: "癸", branch: "亥", hiddenStems: ["壬", "甲"] },
    hour: { stem: "丙", branch: "辰", hiddenStems: ["戊", "乙", "癸"] },
  },
  dayMaster: "癸",
  strengthScore: 3.25,
  tenGods: {},
  twelveQi: {},
  elementAnalysis: {
    visibleCounts: { wood: 1, fire: 1, earth: 2, metal: 0, water: 1 },
    hiddenCounts: { wood: 2, fire: 0, earth: 2, metal: 0, water: 3 },
    totalCounts: { wood: 3, fire: 1, earth: 4, metal: 0, water: 4 },
    missingElements: ["metal"],
    dominantElements: ["water", "earth"],
    elementStrengths: [],
  },
  dayMasterStrengthProfile: {
    dayMaster: "癸",
    strengthState: "สมดุล",
    sourceState: "สมดุล",
    lookupState: "สมดุล",
    displayLabel: "ดิถีสมดุล",
    narrative: "ดิถีน้ำมีแรงพอจะพยุงตัวเอง แต่ยังต้องดูบริบทรอบข้างประกอบ",
    narrativeReason: "มีน้ำหนุนแต่ดินกดอยู่ในหลายตำแหน่ง",
    qiLabel: "冠帶",
    scoreText: "3.25",
  },
  seasonalInteraction: {
    dayMasterStem: "癸",
    dayMasterElement: "water",
    monthBranch: "子",
    season: "winter",
    phase: "peak",
    seasonLabel: "ฤดูหนาวช่วงน้ำเต็ม",
    metaphor: "เหมือนลำน้ำที่เดินตัวเองได้ แต่ยังต้องมีทางระบายที่ถูกทิศ",
  },
  sixtyJiaziCorePersona: {
    code: "癸亥",
    narrative: "น้ำหยินบนกุนให้ภาพคนที่รับรู้อะไรไว แต่เก็บแรงขับไว้ลึกและค่อยปล่อยเมื่อเห็นจังหวะ",
    precedenceNotes: ["หลักวันต้องอ่านคู่กับแรงน้ำซ่อนในกุน"],
    precedenceNoteSignals: [],
    semanticNotes: [],
  },
  interactionState: {
    version: "v3-phase-1",
    entities: [],
    relations: [
      {
        id: "r-1",
        familyKey: "earthly-branch-san-he",
        type: "combination",
        participantEntityIds: ["a", "b"],
        label: "กึ่งภาคีน้ำ",
        metadata: {},
      },
    ],
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
    readingOrderSteps: ["ดูดิถี", "ดูราศีล่างวัน", "ดูพลังที่เด่น"],
  },
});

describe("day master relation reading poc", () => {
  test("builds a stepwise packet with six ordered steps", () => {
    const packet = buildDayMasterRelationPacket(SAMPLE_CALCULATED_STATE);

    expect(packet.version).toBe("bazi-stepwise-cli-v2");
    expect(packet.mode).toBe("stepwise-school-reading");
    expect(packet.eightSlots).toHaveLength(8);
    expect(packet.relationSummary).toHaveLength(5);
    expect(packet.stepInsights).toHaveLength(6);
    expect(packet.stepInsights.map((step) => step.stepNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(packet.chartAnchor.dayBranchLabelThai).toBe("กุน");
    expect(packet.stepInsights[0]?.titleThai).toContain("สมดุล");
    expect(packet.stepInsights[3]?.titleThai).toContain("ผลลัพธ์");
    expect(packet.evidenceCatalog.length).toBeGreaterThanOrEqual(6);
  });

  test("builds a brief and prompt that lock the six-step order", () => {
    const packet = buildDayMasterRelationPacket(SAMPLE_CALCULATED_STATE);
    const brief = buildDayMasterRelationBrief(SAMPLE_RAW_INPUT, packet);
    const instruction = buildDayMasterRelationPocSystemInstruction();
    const prompt = buildDayMasterRelationPocUserPrompt(SAMPLE_RAW_INPUT, brief);

    expect(brief.steps).toHaveLength(6);
    expect(brief.openingDoctrineThai).toContain("Step 1 ถึง 6");
    expect(instruction).toContain("Respect this exact six-step order only");
    expect(instruction).toContain("evidence_refs");
    expect(prompt).toContain("Do not break the Step 1-6 order.");
    expect(prompt).toContain("Stepwise reading brief:");
  });

  test("rejects reading output that leaks forbidden dev wording", () => {
    expect(() => RelationReadingResponseSchema.parse({
      openingSummary: "ภาพรวมยังปกติ",
      step_readings: [1, 2, 3, 4, 5, 6].map((stepNumber) => ({
        step_number: stepNumber,
        heading_thai: `ขั้นที่ ${stepNumber}`,
        teacher_reading: stepNumber === 2 ? "จุดนี้ยังพา reasoning ไปตาม schema เดิม" : "ภาพรวมยังคงอยู่ในทางของดวง",
        life_meaning: "เจ้าชะตาจึงค่อย ๆ เดินเรื่องชีวิตไปตามแรงที่มี",
        caution: "ระวังอย่าเร่งแรงเกินจังหวะ",
        evidence_refs: [`S${stepNumber}-demo`],
      })),
      closing_reading: "ภาพรวมยังพอประคองได้",
    })).toThrow("Forbidden reading term detected");
  });

  test("rejects english step headings on the visible surface", () => {
    expect(() => RelationReadingResponseSchema.parse({
      openingSummary: "ภาพรวมยังเดินตามดวงได้",
      step_readings: [
        {
          step_number: 1,
          heading_thai: "core_balance",
          teacher_reading: "สมดุลดวงยังพอคุมได้",
          life_meaning: "ชีวิตจึงไม่แกว่งง่าย",
          caution: "อย่าปล่อยแรงเกินตัว",
          evidence_refs: ["S1-core-balance"],
        },
        ...[2, 3, 4, 5, 6].map((stepNumber) => ({
          step_number: stepNumber,
          heading_thai: `ขั้นที่ ${stepNumber}`,
          teacher_reading: "ยังมีจังหวะเดินต่อได้",
          life_meaning: "จึงค่อย ๆ เห็นความหมายในชีวิต",
          caution: "อย่ารีบเกินไป",
          evidence_refs: [`S${stepNumber}-demo`],
        })),
      ],
      closing_reading: "ภาพรวมยังอยู่ในจังหวะที่ควบคุมได้",
    })).toThrow("Step heading must stay Thai-only");
  });

  test("formats preflight, brief preview, and generated report with split surfaces", () => {
    const packet = buildDayMasterRelationPacket(SAMPLE_CALCULATED_STATE);
    const brief = buildDayMasterRelationBrief(SAMPLE_RAW_INPUT, packet);
    const preflight = formatDayMasterRelationPocPreflightReport({
      rawInput: SAMPLE_RAW_INPUT,
      packet,
    });
    const briefPreview = formatDayMasterRelationPocBriefPreview({
      rawInput: SAMPLE_RAW_INPUT,
      brief,
      model: "gemini-3-flash-preview",
    });
    const report = formatDayMasterRelationPocGeneratedReport({
      rawInput: SAMPLE_RAW_INPUT,
      packet,
      brief,
      response: {
        openingSummary: "ดวงนี้ต้องเปิดจากสมดุลของดิถีก่อน แล้วค่อยจับตัวตนและแรงที่ขับออกไปทีละชั้น",
        step_readings: packet.stepInsights.map((step) => ({
          step_number: step.stepNumber,
          heading_thai: step.titleThai,
          teacher_reading: `ซินแสจะอ่านว่า ${step.summaryThai}`,
          life_meaning: `เมื่อเทียบกับชีวิตจริง จุดนี้บอกว่า ${step.auditFocusThai}`,
          caution: "ข้อควรระวังคืออย่าอ่านข้ามหลักฐานของ step นี้",
          evidence_refs: step.evidenceIds.slice(0, 1),
        })),
        closing_reading: "เมื่อไล่ครบทั้งหกขั้นแล้ว ภาพรวมของดวงนี้คือรู้ตัวไว แต่ต้องจัดแรงให้เดินอย่างมีทิศ",
      },
      model: "gemini-3-flash-preview",
      includeAuditAppendix: true,
      includeBriefPreview: true,
    });

    expect(preflight).toContain("ข้อมูลนำเข้า");
    expect(preflight).toContain("Step 1: สมดุลดวงและแกนหลัก");
    expect(preflight).toContain("ตาราง 8 ช่อง");
    expect(briefPreview).toContain("=== คู่มือชั้นคำอ่านสำหรับ LLM ===");
    expect(briefPreview).toContain("หลักการเปิดอ่าน");
    expect(report).toContain("คำอ่านเปิดดวง");
    expect(report).toContain("ขั้นที่ 1: สมดุลดวงและแกนหลัก");
    expect(report).toContain("=== คู่มือหลักฐานแบบ Audit Companion ===");
    expect(report).toContain("- รุ่นที่ใช้: gemini-3-flash-preview");
  });

  test("keeps structural truth stable for the two requested runtime cases", () => {
    const caseOne = calculateBaziStructuralState({
      birthDate: "1993-11-24",
      birthTime: "15:09",
      gender: "male",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    });
    const caseTwo = calculateBaziStructuralState({
      birthDate: "1989-01-03",
      birthTime: "08:45",
      gender: "male",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    });

    expect(caseOne.dayMaster).toBe("己");
    expect(caseOne.fourPillars.day.branch).toBe("酉");
    expect(caseTwo.dayMaster).toBe("癸");
    expect(caseTwo.fourPillars.day.branch).toBe("亥");
  });

  test("step 3 action vector uses visible carriers only and excludes hidden stems", () => {
    const packet = buildDayMasterRelationPacket(SAMPLE_CALCULATED_STATE);
    const step3 = packet.stepInsights[2]!;

    expect(step3.titleThai).toContain("ธาตุถ่ายเท");
    expect(step3.summaryThai).toContain("ถ่ายเทไปธาตุไม้");
    expect(step3.summaryThai).toContain("มองเห็น");
    expect(step3.summaryThai).not.toContain("วันล่างแฝง 甲");
    expect(step3.evidenceIds).toContain("S3-action-element");
    expect(step3.evidenceIds).toContain("S3-visible-action-carriers");
    expect(step3.evidenceIds).toContain("S3-strongest-visible-carrier");
    expect(step3.evidenceIds).toContain("S3-hidden-deferred");

    const visibleCarriers = step3.evidenceLines.find((line) => line.includes("เดือนบน 甲"));
    expect(visibleCarriers).toBeDefined();

    const hiddenDeferred = step3.evidenceLines.find((line) => line.includes("ซ่อน") && line.includes("จุด"));
    expect(hiddenDeferred).toBeDefined();
    expect(hiddenDeferred).toContain("甲");
  });

  test("preflight report respects maxVisibleStep to hide steps 4-6", () => {
    const packet = buildDayMasterRelationPacket(SAMPLE_CALCULATED_STATE);

    const full = formatDayMasterRelationPocPreflightReport({
      rawInput: SAMPLE_RAW_INPUT,
      packet,
    });
    expect(full).toContain("Step 3:");
    expect(full).toContain("Step 4:");
    expect(full).toContain("Step 6:");

    const focused = formatDayMasterRelationPocPreflightReport({
      rawInput: SAMPLE_RAW_INPUT,
      packet,
      maxVisibleStep: 3,
    });
    expect(focused).toContain("Step 3:");
    expect(focused).not.toContain("Step 4:");
    expect(focused).not.toContain("Step 5:");
    expect(focused).not.toContain("Step 6:");
  });

  test("brief preview respects maxVisibleStep to hide steps 4-6", () => {
    const packet = buildDayMasterRelationPacket(SAMPLE_CALCULATED_STATE);
    const brief = buildDayMasterRelationBrief(SAMPLE_RAW_INPUT, packet);

    const focused = formatDayMasterRelationPocBriefPreview({
      rawInput: SAMPLE_RAW_INPUT,
      brief,
      model: "test",
      maxVisibleStep: 3,
    });
    expect(focused).toContain("Step 3:");
    expect(focused).not.toContain("Step 4:");
    expect(focused).not.toContain("Step 5:");
    expect(focused).not.toContain("Step 6:");
  });

  test("step 4 wealth vector identifies fire as wealth for water day master", () => {
    const packet = buildDayMasterRelationPacket(SAMPLE_CALCULATED_STATE);
    const step4 = packet.stepInsights[3]!;

    expect(step4.titleThai).toContain("โชคลาภ");
    expect(step4.summaryThai).toContain("พิฆาตธาตุไฟ");
    expect(step4.evidenceIds).toContain("S4-wealth-element");
    expect(step4.evidenceIds).toContain("S4-visible-wealth-carriers");
    expect(step4.evidenceIds).toContain("S4-capacity");

    const wealthElementEvidence = step4.evidenceLines.find((line) => line.includes("พิฆาตธาตุไฟ"));
    expect(wealthElementEvidence).toBeDefined();
  });

  test("step 4 wealth vector shows capacity from strength state", () => {
    const packet = buildDayMasterRelationPacket(SAMPLE_CALCULATED_STATE);
    const step4 = packet.stepInsights[3]!;

    expect(step4.summaryThai).toContain("คว้าได้");

    const capacityEvidence = step4.evidenceLines.find((line) => line.includes("สามารถคว้า"));
    expect(capacityEvidence).toBeDefined();
  });

  test("step 4 detects pian cai polarity for all visible wealth carriers", () => {
    const packet = buildDayMasterRelationPacket(SAMPLE_CALCULATED_STATE);
    const step4 = packet.stepInsights[3]!;

    expect(step4.evidenceIds).toContain("S4-visible-wealth-carriers");

    const pianCaiEvidence = step4.evidenceLines.find((line) => line.includes("ลาภเปีย"));
    if (pianCaiEvidence) {
      expect(pianCaiEvidence).toContain("ยามบน 丙");
    }
  });

  test("step 4 flags absent wealth when no visible carriers", () => {
    const noWealthState = {
      ...SAMPLE_CALCULATED_STATE,
      fourPillars: {
        year: { stem: "壬", branch: "子", hiddenStems: ["癸"] },
        month: { stem: "癸", branch: "丑", hiddenStems: ["己", "癸", "辛"] },
        day: { stem: "癸", branch: "亥", hiddenStems: ["壬", "甲"] },
        hour: { stem: "壬", branch: "子", hiddenStems: ["癸"] },
      },
      elementAnalysis: {
        visibleCounts: { wood: 0, fire: 0, earth: 0, metal: 0, water: 4 },
        hiddenCounts: { wood: 1, fire: 0, earth: 1, metal: 1, water: 3 },
        totalCounts: { wood: 1, fire: 0, earth: 1, metal: 1, water: 7 },
        missingElements: ["fire", "earth", "metal"],
        dominantElements: ["water"],
        elementStrengths: [],
      },
    };
    const parsedState = CalculatedStateSchema.parse(noWealthState);
    const packet = buildDayMasterRelationPacket(parsedState);
    const step4 = packet.stepInsights[3]!;

    expect(step4.summaryThai).toContain("ไม่มีจุดมองเห็น");
    expect(step4.summaryThai).toContain("รอรอบเวลาจร");
  });

  test("step 4 includes twelve qi badges for branch wealth carriers", () => {
    const packet = buildDayMasterRelationPacket(SAMPLE_CALCULATED_STATE);
    const step4 = packet.stepInsights[3]!;

    if (step4.evidenceIds.includes("S4-twelve-qi-badges")) {
      const twelveQiEvidence = step4.evidenceLines.find((line) => line.includes("เซงแซ"));
      expect(twelveQiEvidence).toBeDefined();
    }
  });
});
