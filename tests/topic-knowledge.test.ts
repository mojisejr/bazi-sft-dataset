import { describe, expect, test } from "vitest";

import { CalculatedStateSchema } from "@/lib/bazi/schema-types";
import {
  buildRelationshipLinesMapping,
  buildTopicHumanReading,
  getTopicKnowledgeCoverage,
  getTopicKnowledgeSourceLabel,
} from "@/lib/bazi/topic-knowledge";

// เคสตัวอย่าง: ดิถี 己 ราศีล่างวัน 酉 (มีใน knownlage/ลักษณะนิสัย60แบบ...txt)
const SAMPLE_STATE = CalculatedStateSchema.parse({
  fourPillars: {
    year: { stem: "癸", branch: "酉", hiddenStems: ["辛"] },
    month: { stem: "癸", branch: "亥", hiddenStems: ["壬", "甲"] },
    day: { stem: "己", branch: "酉", hiddenStems: ["辛"] },
    hour: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
  },
  dayMaster: "己",
  strengthScore: 2.1,
  tenGods: {},
  twelveQi: {},
  elementAnalysis: {
    visibleCounts: { wood: 0, fire: 0, earth: 1, metal: 2, water: 3 },
    hiddenCounts: { wood: 1, fire: 0, earth: 1, metal: 2, water: 2 },
    totalCounts: { wood: 1, fire: 0, earth: 2, metal: 4, water: 5 },
    missingElements: ["fire"],
    dominantElements: ["water", "metal"],
    elementStrengths: [],
  },
  daYun: [
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

describe("topic-knowledge (knownlage human reading)", () => {
  test("chart_foundation คืนคำทำนายภาษามนุษย์จาก knownlage", () => {
    const reading = buildTopicHumanReading(SAMPLE_STATE, "chart_foundation");
    expect(reading).not.toBeNull();
    expect(reading).toContain("ดิถี 己");
    expect(reading).toContain("ราศีล่างวัน 酉");
  });

  test("talent ก็มีคำทำนายภาษามนุษย์ (ใช้ไฟล์เดียวกัน)", () => {
    expect(buildTopicHumanReading(SAMPLE_STATE, "talent")).not.toBeNull();
  });

  test("Batch1: สุขภาพชี้ธาตุที่อ่อน (ไฟขาด)", () => {
    const reading = buildTopicHumanReading(SAMPLE_STATE, "health");
    expect(reading).not.toBeNull();
    expect(reading).toContain("ธาตุไฟอ่อนแอ");
  });

  test("Batch1: โชคลาภคืน verdict ตาม strength band", () => {
    expect(buildTopicHumanReading(SAMPLE_STATE, "wealth_and_investment")).toContain("หลักวันราศีบน");
  });

  test("Batch1: สี/องค์เทพ/อาชีพ ตาม useful element (己 อ่อน → ไฟ/ดิน)", () => {
    expect(buildTopicHumanReading(SAMPLE_STATE, "colors_directions")).toContain("สีมงคล");
    expect(buildTopicHumanReading(SAMPLE_STATE, "guardian_deities")).toContain("สิ่งศักดิ์สิทธิ์");
    expect(buildTopicHumanReading(SAMPLE_STATE, "career_potential")).toContain("อาชีพธาตุ");
  });

  test("Batch2: วัยจรคืน verdict ตาม band × บทบาทธาตุของเฟสปัจจุบัน", () => {
    const reading = buildTopicHumanReading(SAMPLE_STATE, "turning_points");
    expect(reading).not.toBeNull();
    // คำทำนายวัยจรเจาะหลายช่วง (ปัจจุบัน + ข้างหน้า) พร้อมระบุช่วงปัจจุบัน
    expect(reading).toContain("วิเคราะห์จังหวะชีวิต");
    expect(reading).toContain("ช่วงปัจจุบัน");
  });

  test("Batch3: ความรักคืน verdict ตาม เพศ × band (ต้องมี rawInput.gender)", () => {
    const female = { birthDate: "1988-06-08", birthTime: "12:08", gender: "female", province: "Bangkok" } as const;
    expect(buildTopicHumanReading(SAMPLE_STATE, "love_partner", female)).toContain("เพศหญิง");
    // ไม่มี gender → null
    expect(buildTopicHumanReading(SAMPLE_STATE, "love_partner")).toBeNull();
  });

  test("Batch3: หุ้นส่วนคืนแนวทางตาม strength band", () => {
    expect(buildTopicHumanReading(SAMPLE_STATE, "partnership")).toContain("ธุรกิจ");
  });

  test("Batch4: 5 บทที่เหลือ derive จากกฎ engine ไม่เป็น null", () => {
    expect(buildTopicHumanReading(SAMPLE_STATE, "benefactor")).toContain("ผู้อุปถัมภ์");
    expect(buildTopicHumanReading(SAMPLE_STATE, "family")).toContain("ครอบครัว");
    expect(buildTopicHumanReading(SAMPLE_STATE, "friends_foes")).toContain("เพื่อน");
    expect(buildTopicHumanReading(SAMPLE_STATE, "subordinates")).toContain("บริวาร");
    expect(buildTopicHumanReading(SAMPLE_STATE, "education")).toContain("การเรียน");
  });

  test("topicId ที่ไม่ใช่ predict (calculated_basis) คืน null", () => {
    expect(buildTopicHumanReading(SAMPLE_STATE, "calculated_basis")).toBeNull();
  });

  test("Rev6: sourceLabel อ้างอิงตำรา", () => {
    expect(getTopicKnowledgeSourceLabel("chart_foundation")).toContain("ตำรา");
    // ยกเลิกอ้าง M.docx ในการทำนาย → อ้างอิงตำราโหราศาสตร์เคี้ยงคุงแทน
    expect(getTopicKnowledgeSourceLabel("benefactor")).toContain("เคี้ยงคุง");
  });

  test("Rev6: Relationship Lines Mapping ครอบทุกเฟสวัยจร 5 ปี", () => {
    const rows = buildRelationshipLinesMapping(SAMPLE_STATE);
    // 1 เสาวัยจร × 2 เฟส = 2 แถว
    expect(rows.length).toBe(2);
    // ใช้อายุเริ่มวัยจรจริง (起运) จาก fixture (upperPhase.startAge = 40) ไม่ normalize เป็น 5
    expect(rows[0]?.ageRange).toBe("40-44 ปี");
    expect(rows[0]?.relationLine.length).toBeGreaterThan(0);
    expect(rows[0]?.deepNote.length).toBeGreaterThan(0);
  });

  test("speech: คืนคำอ่านการพูดที่อิงดาวถ่ายเท (Step 6.2)", () => {
    const reading = buildTopicHumanReading(SAMPLE_STATE, "speech");
    expect(reading).not.toBeNull();
    expect(reading).toContain("ดาวถ่ายเท");
    expect(reading).toContain("เชี่ยงแซ");
  });

  test("education: enrich ด้วยระดับการศึกษาตามเชี่ยงแซดาวถ่ายเท (Step 6.2)", () => {
    const reading = buildTopicHumanReading(SAMPLE_STATE, "education");
    expect(reading).not.toBeNull();
    expect(reading).toContain("Step 6.2");
    expect(reading).toContain("ดาวถ่ายเทตกเชี่ยงแซ");
  });

  test("talent: enrich ด้วยมิติวาทศิลป์จากดาวถ่ายเท (Step 6.2)", () => {
    const reading = buildTopicHumanReading(SAMPLE_STATE, "talent");
    expect(reading).not.toBeNull();
    expect(reading).toContain("วาทศิลป์/การสื่อสาร");
  });

  test("coverage: ทุกหัวข้อ predict มีองค์ความรู้แล้ว (16 บท)", () => {
    const coverage = getTopicKnowledgeCoverage();
    expect(coverage.length).toBe(16);
    expect(coverage.every((entry) => entry.hasKnowledge)).toBe(true);
    // ไม่รวม calculated_basis (kind basis)
    expect(coverage.some((entry) => entry.topicId === "calculated_basis")).toBe(false);
  });
});
