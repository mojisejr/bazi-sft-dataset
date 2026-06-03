import { describe, expect, test } from "vitest";

import { RawInputSchema, type RawInputValue } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { buildRelationshipLinesMapping, buildTopicHumanReading } from "@/lib/bazi/topic-knowledge";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

// ดวงหลากหลาย (ต่างดิถี/เพศ/แข็ง-อ่อน) — กันการ overfit กับเคส M.docx (己 อ่อน ชาย)
// ตรวจ "invariant" เชิงโครงสร้าง ไม่ผูกค่ากับดวงใดดวงหนึ่ง
const DIVERSE_CASES: Array<{ label: string } & Pick<RawInputValue, "birthDate" | "birthTime" | "gender" | "province">> = [
  { label: "หญิง 1988-06-15", birthDate: "1988-06-15", birthTime: "10:30", gender: "female", province: "Bangkok" },
  { label: "ชาย 2001-02-03", birthDate: "2001-02-03", birthTime: "23:45", gender: "male", province: "Khon Kaen" },
  { label: "หญิง 1975-09-09", birthDate: "1975-09-09", birthTime: "06:00", gender: "female", province: "Phuket" },
];

describe("topic-knowledge generalization (anti-overfit)", () => {
  test.each(DIVERSE_CASES)("$label: readings stay coherent for any chart", async (c) => {
    const repository = createTestKnowledgeRepository();
    const raw = RawInputSchema.parse({
      birthDate: c.birthDate,
      birthTime: c.birthTime,
      gender: c.gender,
      province: c.province,
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    });
    const result = await calculateBaziChart(raw, repository);

    // ตารางวัยจรต้องมีครบและคำอธิบายไม่ว่าง (deepNote เสมอ)
    const rows = buildRelationshipLinesMapping(result);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.deepNote.length > 0)).toBe(true);

    // อาชีพ (useful god): ต้องมีองค์ความรู้และอ้าง useful god
    const career = buildTopicHumanReading(result, "career_potential", raw);
    expect(career).toContain("useful god");

    // ความรัก: ต้องมีชั้นดาวคู่ครอง + จานคู่ (ทำงานทั้งสองเพศ)
    const love = buildTopicHumanReading(result, "love_partner", raw);
    expect(love).toContain("ดาวคู่ครอง");
    expect(love).toContain("จานคู่");

    // สุขภาพ: ต้องมีแนวทางดูแล (มิติธาตุล้นเกิน/ขาด)
    const health = buildTopicHumanReading(result, "health", raw);
    expect(health).toContain("แนวทางดูแล");

    // พรสวรรค์: ต้องอิงดาวถ่ายเท ไม่ใช่บุคลิกทั่วไป และต้องต่างจากบทพื้นฐาน
    const talent = buildTopicHumanReading(result, "talent", raw);
    expect(talent).toContain("ดาวถ่ายเท");
    expect(talent).not.toEqual(buildTopicHumanReading(result, "chart_foundation", raw));
  });
});
