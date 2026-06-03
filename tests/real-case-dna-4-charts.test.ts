import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { buildTopicHumanReading } from "@/lib/bazi/topic-knowledge";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

// 4 เคสฉบับสมบูรณ์ (DNA ดวงจีน case1-4) — ตรวจว่า engine คำนวณ "ดิถี" ตรงกับคำอ่านในเอกสาร
// (ตารางเสาในเอกสารบางฉบับ OCR สลับ แต่ "ธาตุดิถี" ในเนื้อหายืนยันค่าของ engine)
const CHARTS = [
  {
    label: "case1 1966-09-29 11:44 หญิง (ดิถีทองหยิน 辛)",
    birthDate: "1966-09-29", birthTime: "11:44", gender: "female",
    dayMaster: "辛",
    pillars: { year: "丙午", month: "丁酉", day: "辛卯", hour: "甲午" },
  },
  {
    label: "case2 1981-03-12 05:59 ชาย (ดิถีดินหยิน 己)",
    birthDate: "1981-03-12", birthTime: "05:59", gender: "male",
    dayMaster: "己",
    pillars: { year: "辛酉", month: "辛卯", day: "己丑", hour: "丁卯" },
  },
  {
    label: "case3 1949-06-25 12:00 หญิง (ดิถีไฟหยาง 丙)",
    birthDate: "1949-06-25", birthTime: "12:00", gender: "female",
    dayMaster: "丙",
    pillars: { year: "己丑", month: "庚午", day: "丙戌", hour: "甲午" },
  },
  {
    label: "case4 1977-11-27 00:26 หญิง (ดิถีดินหยาง 戊)",
    birthDate: "1977-11-27", birthTime: "00:26", gender: "female",
    dayMaster: "戊",
    pillars: { year: "丁巳", month: "辛亥", day: "戊子", hour: "壬子" },
  },
] as const;

describe("DNA ดวงจีน 4 charts — day master matches the complete reference docs", () => {
  test.each(CHARTS)("$label", async (chart) => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: chart.birthDate,
        birthTime: chart.birthTime,
        gender: chart.gender,
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    expect(result.dayMaster).toBe(chart.dayMaster);
    expect(`${result.fourPillars.year.stem}${result.fourPillars.year.branch}`).toBe(chart.pillars.year);
    expect(`${result.fourPillars.month.stem}${result.fourPillars.month.branch}`).toBe(chart.pillars.month);
    expect(`${result.fourPillars.day.stem}${result.fourPillars.day.branch}`).toBe(chart.pillars.day);
    expect(`${result.fourPillars.hour.stem}${result.fourPillars.hour.branch}`).toBe(chart.pillars.hour);
  });

  // useful god (อาชีพ) ต้องตรงชุดธาตุกับเอกสาร — รวมเคส 病药/食傷制杀 (case1: 辛 ถูกไฟล้อม → ดิน+น้ำ)
  const USEFUL_EXPECT = [
    { l: "case1 辛 (ไฟล้อม → 食傷制杀)", d: "1966-09-29", t: "11:44", g: "female", want: ["ดิน", "น้ำ"] },
    { l: "case2 己", d: "1981-03-12", t: "05:59", g: "male", want: ["ดิน", "ไฟ"] },
    { l: "case3 丙 แข็ง", d: "1949-06-25", t: "12:00", g: "female", want: ["ดิน", "ทอง"] },
    { l: "case4 戊", d: "1977-11-27", t: "00:26", g: "female", want: ["ดิน", "ไฟ"] },
  ] as const;

  test.each(USEFUL_EXPECT)("useful god matches doc set: $l", async (c) => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: c.d, birthTime: c.t, gender: c.g,
        province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
      }),
      repository,
    );
    const career = buildTopicHumanReading(
      result,
      "career_potential",
      RawInputSchema.parse({ birthDate: c.d, birthTime: c.t, gender: c.g, province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok" }),
    )!;
    for (const element of c.want) {
      expect(career).toContain(`อาชีพธาตุ${element}`);
    }
  });

  // P2: บทพื้นฐานชะตาต้องเปิดด้วย imagery ดิถี×ฤดู ตรงสำนวนเอกสาร
  const IMAGERY_EXPECT = [
    { l: "case1 辛 เพชรพลอย/ใบไม้ร่วง/ไฟ", d: "1966-09-29", t: "11:44", g: "female", want: ["เพชรพลอย", "ใบไม้ร่วง", "ความร้อน"] },
    { l: "case3 丙 ดวงอาทิตย์/ฤดูร้อน", d: "1949-06-25", t: "12:00", g: "female", want: ["ดวงอาทิตย์", "ฤดูร้อน"] },
    { l: "case4 戊 ภูเขาหิน/ฤดูหนาว/สายน้ำ", d: "1977-11-27", t: "00:26", g: "female", want: ["ภูเขาหิน", "ฤดูหนาว", "สายน้ำ"] },
  ] as const;

  test.each(IMAGERY_EXPECT)("chart-foundation imagery: $l", async (c) => {
    const repository = createTestKnowledgeRepository();
    const raw = RawInputSchema.parse({ birthDate: c.d, birthTime: c.t, gender: c.g, province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok" });
    const reading = buildTopicHumanReading(await calculateBaziChart(raw, repository), "chart_foundation", raw)!;
    for (const phrase of c.want) {
      expect(reading).toContain(phrase);
    }
  });
});
