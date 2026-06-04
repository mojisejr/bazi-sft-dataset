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

  test("บท 12 มีบล็อกพยากรณ์ปีจรรายปี พร้อมปี ค.ศ./พ.ศ. และป้ายจังหวะ", async () => {
    const { reading } = await read("1981-03-12", "05:59", "male");
    expect(reading).toContain("พยากรณ์ปีจร");
    expect(reading).toMatch(/ค\.ศ\. \d{4}/);
    expect(reading).toMatch(/พ\.ศ\. \d{4}/);
    // ต้องคงป้ายจังหวะที่เทสต์อื่นใช้ร่วม
    expect(reading).toMatch(/\[ยุคทอง\]|\[เฝ้าระวัง\]/);
  });
});
