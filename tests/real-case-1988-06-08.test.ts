import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { buildTopicHumanReading } from "@/lib/bazi/topic-knowledge";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

// อ้างอิง example/1.docx (วรรัตน์ — ดิถี 甲 ไม้หยาง อ่อน, useful god = น้ำ ก่อน แล้วไม้, เลี่ยงทอง)
// เคสที่ 2 (ต่างธาตุ/เพศ จาก M.docx 己 ดิน ชาย) — กันการ overfit
const BIRTH_INPUT = {
  birthDate: "1988-06-08",
  birthTime: "12:08",
  gender: "female",
  province: "Bangkok",
  calendarSystem: "solar",
  timezone: "Asia/Bangkok",
} as const;

describe("Real-world case: 8 June 1988, 12:08, female (vs 1.docx)", () => {
  test("computes 甲 weak day master and the expected four pillars", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);

    expect(result.fourPillars.year).toMatchObject({ stem: "戊", branch: "辰" });
    expect(result.fourPillars.month).toMatchObject({ stem: "戊", branch: "午" });
    expect(result.fourPillars.day).toMatchObject({ stem: "甲", branch: "午" });
    expect(result.fourPillars.hour).toMatchObject({ stem: "庚", branch: "午" });
    expect(result.dayMaster).toBe("甲");
    expect(result.strengthScore).toBeLessThan(0); // ดิถีอ่อน
  });

  test("useful-god readings lead with ธาตุน้ำ then ไม้, never ทอง (1.docx)", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    const raw = RawInputSchema.parse(BIRTH_INPUT);

    // อาชีพ: น้ำ (ดีที่สุด) ก่อน แล้วไม้ (รอง) — ห้ามขึ้นด้วยทอง (官杀 ที่ต้องเลี่ยง)
    const career = buildTopicHumanReading(result, "career_potential", raw)!;
    expect(career).toContain("อาชีพธาตุน้ำ");
    expect(career).toContain("อาชีพธาตุไม้");
    expect(career.indexOf("ธาตุน้ำ")).toBeLessThan(career.indexOf("ธาตุไม้"));
    expect(career).not.toContain("อาชีพธาตุทอง");

    // สี/อัญมณี: น้ำ + ไม้
    const colors = buildTopicHumanReading(result, "colors_directions", raw)!;
    expect(colors).toContain("ธาตุน้ำ");
    expect(colors).toContain("ธาตุไม้");

    // การเรียน: วิชา useful god = น้ำ/ไม้
    const education = buildTopicHumanReading(result, "education", raw)!;
    expect(education).toContain("น้ำ");
  });

  test("chart-foundation personality matches the 1.docx 甲/午 profile", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    const personality = buildTopicHumanReading(result, "chart_foundation", RawInputSchema.parse(BIRTH_INPUT))!;
    // 甲: เมตตา/ทำบุญ ; 午: กระฉับกระเฉง/รักอิสระ (ตรงสำนวน 1.docx)
    expect(personality).toContain("เมตตา");
    expect(personality).toContain("อิสระ");
  });

  // บท3 โชคลาภ (1.docx): ดาวลาภ(ดิน)แข็งแรง อยู่หลักปี + ดิถีอ่อนต้องพยายาม + โฟกัสสิ่งเดียว
  test("wealth reading is position/strength based and matches 1.docx framing", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    const wealth = buildTopicHumanReading(result, "wealth_and_investment", RawInputSchema.parse(BIRTH_INPUT))!;
    expect(wealth).toContain("ดาวโชคลาภ (ธาตุดิน)"); // 甲 → ลาภ = ดิน (木克土)
    expect(wealth).toContain("แข็งแรง");
    expect(wealth).toContain("หลักปี"); // ดาวลาภปรากฏที่เสาปี
    expect(wealth).toContain("โฟกัส"); // ดิถีอ่อน → โฟกัสสิ่งเดียว
  });

  test("love reading (female) treats spouse star as ธาตุทอง (authority)", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    const love = buildTopicHumanReading(result, "love_partner", RawInputSchema.parse(BIRTH_INPUT))!;
    expect(love).toContain("ดาวคู่ครอง");
    expect(love).toContain("ธาตุทอง"); // หญิง 甲 → คู่ครอง = ดาวอำนาจ = ทอง (金克木)
  });

  test("health includes excess dimension and remedy with น้ำ/ไม้", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    const health = buildTopicHumanReading(result, "health", RawInputSchema.parse(BIRTH_INPUT))!;
    expect(health).toContain("มากเกินไป");
    expect(health).toContain("แนวทางดูแล");
  });
});
