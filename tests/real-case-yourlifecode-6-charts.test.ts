import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { buildTopicHumanReading } from "@/lib/bazi/topic-knowledge";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

// 6 เคส "your life code" — ตรวจว่า engine คำนวณดิถีตรงกับเนื้อหาในเอกสาร
// (ตารางเสาบางฉบับ OCR สลับ เช่น กัญญารัตน์ ตารางพิมพ์ 庚 แต่เนื้อหา = 甲 ตรงกับ engine)
const CHARTS = [
  { label: "กัญญารัตน์ 2002-12-02 11:30 ญ (เนื้อหา: 甲ไม้)", d: "2002-12-02", t: "11:30", g: "female" as const, dm: "甲", pillars: { year: "壬午", month: "辛亥", day: "甲辰", hour: "庚午" } },
  { label: "เกศสรินทร์ 1995-01-23 02:10 ญ (甲ไม้)", d: "1995-01-23", t: "02:10", g: "female" as const, dm: "甲", pillars: { year: "甲戌", month: "丁丑", day: "甲寅", hour: "乙丑" } },
  { label: "ชัยธรณ์ 1981-03-15 12:00 ช (壬น้ำ)", d: "1981-03-15", t: "12:00", g: "male" as const, dm: "壬", pillars: { year: "辛酉", month: "辛卯", day: "壬辰", hour: "丙午" } },
  { label: "สิริกัญญา 1980-06-28 18:00 ญ (壬น้ำ)", d: "1980-06-28", t: "18:00", g: "female" as const, dm: "壬", pillars: { year: "庚申", month: "壬午", day: "壬申", hour: "己酉" } },
  { label: "เจ้าชะตา A 2001-07-29 21:35 ญ (癸น้ำ)", d: "2001-07-29", t: "21:35", g: "female" as const, dm: "癸", pillars: { year: "辛巳", month: "乙未", day: "癸巳", hour: "癸亥" } },
  { label: "เจ้าชะตา B 1999-06-17 15:25 ญ (庚ทอง)", d: "1999-06-17", t: "15:25", g: "female" as const, dm: "庚", pillars: { year: "己卯", month: "庚午", day: "庚子", hour: "甲申" } },
];

describe("your life code — 6 charts day master matches the reference docs", () => {
  test.each(CHARTS)("$label", async (chart) => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: chart.d, birthTime: chart.t, gender: chart.g,
        province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
      }),
      repository,
    );
    expect(result.dayMaster).toBe(chart.dm);
    expect(`${result.fourPillars.year.stem}${result.fourPillars.year.branch}`).toBe(chart.pillars.year);
    expect(`${result.fourPillars.month.stem}${result.fourPillars.month.branch}`).toBe(chart.pillars.month);
    expect(`${result.fourPillars.day.stem}${result.fourPillars.day.branch}`).toBe(chart.pillars.day);
    expect(`${result.fourPillars.hour.stem}${result.fourPillars.hour.branch}`).toBe(chart.pillars.hour);
  });

  // useful god (อาชีพ) ต้องมีชุดธาตุตรงเอกสาร (ตรวจแบบ set ไม่ผูกลำดับ)
  const USEFUL = [
    { label: "กัญญารัตน์ 甲 อ่อน → ไม้+น้ำ", d: "2002-12-02", t: "11:30", g: "female" as const, want: ["ไม้", "น้ำ"] },
    { label: "สิริกัญญา 壬 แข็งมาก → ไม้+ไฟ", d: "1980-06-28", t: "18:00", g: "female" as const, want: ["ไม้", "ไฟ"] },
    { label: "เจ้าชะตา B 庚 อ่อน → ดิน+ทอง", d: "1999-06-17", t: "15:25", g: "female" as const, want: ["ดิน", "ทอง"] },
  ] as const;

  test.each(USEFUL)("useful god set: $label", async (c) => {
    const repository = createTestKnowledgeRepository();
    const raw = RawInputSchema.parse({ birthDate: c.d, birthTime: c.t, gender: c.g, province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok" });
    const career = buildTopicHumanReading(await calculateBaziChart(raw, repository), "career_potential", raw)!;
    for (const element of c.want) {
      expect(career).toContain(`อาชีพธาตุ${element}`);
    }
  });
});
