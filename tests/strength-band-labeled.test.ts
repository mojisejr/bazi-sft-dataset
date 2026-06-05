import { describe, expect, test } from "vitest";

import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

// ชุด labeled dataset สำหรับกำลังดิถี (band) — ผูกกับ band ที่เอกสารต้นฉบับ "your life code" ระบุ
// ป้องกัน regression ของโมเดล 从强 (dominance) ที่ยก "แข็ง" → "แข็งมาก" และคุมไม่ให้ดวงอื่นเลื่อน band
const LABELED = [
  // 金水印比 ครอบงำ (庚申/申/酉 = 印, 壬壬 = 比) → ตำราจัด "แข็งมาก" (very-strong)
  { label: "สิริกัญญา 壬 (doc: แข็งมาก)", d: "1980-06-28", t: "18:00", g: "female" as const, band: "แข็งเกินไป" },
  { label: "กัญญารัตน์ 甲 (doc: อ่อน)", d: "2002-12-02", t: "11:30", g: "female" as const, band: "ดวงอ่อน" },
  { label: "เจ้าชะตา B 庚 (doc: อ่อน)", d: "1999-06-17", t: "15:25", g: "female" as const, band: "ดวงอ่อน" },
  { label: "ชัยธรณ์ 壬 (อ่อน)", d: "1981-03-15", t: "12:00", g: "male" as const, band: "ดวงอ่อน" },
  { label: "เกศสรินทร์ 甲 (สมดุล)", d: "1995-01-23", t: "02:10", g: "female" as const, band: "สมดุล" },
] as const;

describe("strength band — labeled dataset (your life code)", () => {
  test.each(LABELED)("$label", async (chart) => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: chart.d, birthTime: chart.t, gender: chart.g,
        province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
      }),
      repository,
    );

    expect(classifyOperatorStrengthScore(result.strengthScore).label).toBe(chart.band);
  });

  // โบนัส 从强 ต้องไม่ทำงานกับดวงที่ฐานคะแนนยังไม่ถึงแดน "แข็ง" (>= 5.5)
  test("dominance bonus stays inactive below the strong band", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1995-01-23", birthTime: "02:10", gender: "female",
        province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
      }),
      repository,
    );

    // เกศสรินทร์ 甲 ไม้ — ไม้+น้ำหนุนเยอะแต่ฐานยังสมดุล จึงต้องไม่โดนยกเป็นแข็ง/แข็งมาก
    expect(result.strengthScore).toBeLessThanOrEqual(5.5);
  });
});
