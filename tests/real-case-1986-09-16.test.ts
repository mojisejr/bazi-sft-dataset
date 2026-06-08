import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { buildTopicHumanReading } from "@/lib/bazi/topic-knowledge";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

// อ้างอิง example/gptCase/ประภาวรินท์ — ดิถี 癸 น้ำหยิน "อ่อนแต่เกือบสมดุล" + ดาวลาภ(財=ไฟ)แข็งแรง
// เคสทดสอบกฎ 身財両停 (isWealthLeverageChart): ดวง leverage 食傷(ไม้)+財(ไฟ)+印(ทอง) แทน 財多身弱
const BIRTH_INPUT = {
  birthDate: "1986-09-16",
  birthTime: "14:23",
  gender: "female",
  province: "Bangkok",
  calendarSystem: "solar",
  timezone: "Asia/Bangkok",
} as const;

describe("Real-world case: 16 Sep 1986, 14:23, female (gptCase ประภาวรินท์)", () => {
  test("computes 癸 weak-near-balanced day master", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    expect(result.dayMaster).toBe("癸");
    expect(result.fourPillars.day).toMatchObject({ stem: "癸", branch: "亥" });
    // อยู่ในโซน weak ครึ่งบน (>=2.5) ที่ทำให้กฎ 身財両停 ทำงาน
    expect(result.strengthScore).toBeGreaterThanOrEqual(2.5);
    expect(result.strengthScore).toBeLessThanOrEqual(3.75);
  });

  test("身財両停: leverages 財(ไฟ)+印(ทอง) — career/colors/deities follow", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    const raw = RawInputSchema.parse(BIRTH_INPUT);

    // อาชีพ: leverage 財 → ขึ้นด้วยอาชีพธาตุไฟ + ทอง (ไม่ใช่ ทอง+น้ำ แบบ 財多身弱)
    const career = buildTopicHumanReading(result, "career_potential", raw)!;
    expect(career).toContain("อาชีพธาตุไฟ");
    expect(career).toContain("อาชีพธาตุทอง");
    expect(career).not.toContain("อาชีพธาตุน้ำ");

    // สี: leverage 食傷(ไม้) → มีเขียว + เลี่ยงสีธาตุดิน (officer)
    const colors = buildTopicHumanReading(result, "colors_directions", raw)!;
    expect(colors).toContain("ธาตุไม้ (เสริมดวง)");
    expect(colors).toContain("ทิศตะวันออก");
    expect(colors).toContain("สีที่ควรเลี่ยง: สีธาตุดิน");
    // สัญลักษณ์มงคลตามรูปทรงธาตุ (財=ไฟ→สามเหลี่ยม, 印=ทอง→วงกลม/วงรี)
    expect(colors).toContain("สามเหลี่ยม");
    expect(colors).toContain("วงกลม/วงรี");
    // สัตว์มงคลจาก Source7 §3.1 (癸×丁 → งู, วัว) — ตรงซินแส "งู"
    expect(colors).toContain("สัตว์มงคล");
    expect(colors).toContain("งู");

    // องค์เทพ: องค์หลักนำด้วยธาตุไฟ (財) — สาย leverage
    const deities = buildTopicHumanReading(result, "guardian_deities", raw)!;
    expect(deities).toContain("องค์หลักที่ควรบูชาเป็นหลัก");
  });

  test("deterministic: identical output on repeated calls", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(RawInputSchema.parse(BIRTH_INPUT), repository);
    const raw = RawInputSchema.parse(BIRTH_INPUT);
    const a = buildTopicHumanReading(result, "career_potential", raw);
    const b = buildTopicHumanReading(result, "career_potential", raw);
    expect(a).toBe(b);
  });
});
