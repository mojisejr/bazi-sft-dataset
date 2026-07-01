import { describe, expect, test } from "vitest";

import { buildFacets, mainFacetOf } from "@/lib/bazi/pair-matching";
import type { DayPillar, PillarPos } from "@/lib/bazi/pair-types";
import { buildManVsDay, buildManVsDayMonth, buildManVsDayYear } from "@/lib/bazi/manvsday";

const sp = (stem: string, branch: string): DayPillar => ({ stem, branch });

// ดวงเจ้าของจากชีต DAYMATE (Man): ยาม壬申 / วัน己酉 / เดือน癸亥 / ปี癸酉
const MAN: Record<PillarPos, DayPillar> = {
  hour: sp("壬", "申"),
  day: sp("己", "酉"),
  month: sp("癸", "亥"),
  year: sp("癸", "酉"),
};

// วัน (Day) จากชีต = เสาวัน 甲寅 (partnerPos=day ทุกมิติ)
const DAY: Record<PillarPos, DayPillar> = {
  hour: sp("甲", "寅"),
  day: sp("甲", "寅"),
  month: sp("壬", "辰"),
  year: sp("辛", "酉"),
};

describe("Man-vs-Day facets (DAYMATE — spreadsheet-exact)", () => {
  test("4 มิติตรงชีต DAYMATE + คำทำนายหลัก = วันเรา×วัน", () => {
    const facets = buildFacets("day", MAN, DAY);
    // C34=11.67, F34=45, I34=55, L34=53.33
    expect(facets.map((f) => f.percent)).toEqual([11.67, 45, 55, 53.33]);
    const main = mainFacetOf(facets);
    expect(main?.key).toBe("companions");
    expect(main?.percent).toBe(45);
    expect(facets[0].domain).toBe("love");
  });

  test("มิติแรก (ยามเรา×วัน) ใช้โค้ด A10/A7/B3 ตรง LOVE intimacy", () => {
    const home = buildFacets("day", MAN, DAY)[0];
    expect(home.lines.map((l) => l.code)).toEqual(["A10", "A7", "B3"]);
    for (const ln of home.lines) expect(ln.text.length).toBeGreaterThan(0);
  });
});

describe("buildManVsDay (compose กับปฏิทิน)", () => {
  test("คืน facets + กำลังวัน + ความสัมพันธ์ธาตุ สำหรับวันจริง", () => {
    // 2026-07-02 — วันใดก็ได้ ตรวจโครงสร้าง/ช่วงค่า
    const r = buildManVsDay(MAN, MAN.day, 2026, 7, 2);
    expect(r.facets.length).toBe(4);
    expect(r.date).toBe("2026-07-02");
    expect(r.dayGanzhi.length).toBeGreaterThan(0);
    expect(r.almanac.dayStrength).toBeGreaterThanOrEqual(0);
    expect(r.almanac.dayStrength).toBeLessThanOrEqual(1);
    expect(r.elementRelation.aToB.labelTh.length).toBeGreaterThan(0);
    expect(["good", "neutral", "caution"]).toContain(r.verdict);
    expect(r.summary.length).toBeGreaterThan(20);
    expect(r.summary).toContain("วันนี้");
    if (r.overallPercent != null) {
      expect(r.overallPercent).toBeGreaterThanOrEqual(0);
      expect(r.overallPercent).toBeLessThanOrEqual(100);
    }
  });

  test("buildManVsDayMonth คืนครบทุกวันในเดือน + วันที่/ก้านกิ่งถูกต้อง", () => {
    const m = buildManVsDayMonth(MAN, MAN.day, 2026, 7);
    expect(m.days.length).toBe(31); // ก.ค. 31 วัน
    expect(m.days[0].date).toBe("2026-07-01");
    expect(m.days[0].dayOfMonth).toBe(1);
    expect(m.days[30].date).toBe("2026-07-31");
    for (const d of m.days) {
      expect(d.dayGanzhi.length).toBeGreaterThan(0);
      expect(d.dayStrength).toBeGreaterThanOrEqual(0);
      expect(d.dayStrength).toBeLessThanOrEqual(1);
    }
    // ก.พ. 2027 = 28 วัน (ไม่ใช่ปีอธิกสุรทิน)
    expect(buildManVsDayMonth(MAN, MAN.day, 2027, 2).days.length).toBe(28);
  });

  test("buildManVsDayYear คืน 12 เดือนครบ + วันรวมทั้งปี = 365 (2026)", () => {
    const y = buildManVsDayYear(MAN, MAN.day, 2026);
    expect(y.months.length).toBe(12);
    expect(y.months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const total = y.months.reduce((s, m) => s + m.days.length, 0);
    expect(total).toBe(365);
  });
});
