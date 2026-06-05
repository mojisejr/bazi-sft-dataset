import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { buildTopicHumanReading } from "@/lib/bazi/topic-knowledge";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

async function read(birthDate: string, birthTime: string, gender: "male" | "female") {
  const repo = createTestKnowledgeRepository();
  const raw = RawInputSchema.parse({
    birthDate, birthTime, gender, province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
  });
  const state = await calculateBaziChart(raw, repo);
  return { state, reading: buildTopicHumanReading(state, "turning_points", raw)! };
}

describe("liu nian รายปีแบบเต็ม (P-B)", () => {
  test("engine สร้าง liuNianSeries ครอบคลุมหลายปี เรียงตามปี และมี 12 เชี่ยงแซ", async () => {
    const { state } = await read("1981-03-12", "05:59", "male");
    expect(state.liuNianSeries.length).toBeGreaterThanOrEqual(15);
    // เรียงจากน้อยไปมากและอายุไล่ต่อเนื่อง
    const years = state.liuNianSeries.map((entry) => entry.year);
    expect([...years].sort((a, b) => a - b)).toEqual(years);
    for (const entry of state.liuNianSeries) {
      expect(entry.stem.length).toBeGreaterThan(0);
      expect(entry.branch.length).toBeGreaterThan(0);
      expect(entry.twelveQiDisplay && entry.twelveQiDisplay.length > 0).toBe(true);
    }
  });

  test("บท 12 อ่านสั้น: วิเคราะห์จังหวะชีวิตช่วงวัยจร + คงป้ายจังหวะ (ตัดพยากรณ์รายปีออก)", async () => {
    const { reading } = await read("1981-03-12", "05:59", "male");
    // ตามคำกำชับ "อ่านสั้น" — ไม่มีบล็อกพยากรณ์ปีจรรายปี 20 ปีแล้ว
    expect(reading).toContain("วิเคราะห์จังหวะชีวิต");
    expect(reading).not.toContain("พยากรณ์ปีจร");
    // ป้ายจังหวะยังคงอยู่ในคำอธิบายช่วงวัยจร (เทสต์อื่นใช้ร่วม)
    expect(reading).toMatch(/\[ยุคทอง\]|\[เฝ้าระวัง\]/);
  });
});
