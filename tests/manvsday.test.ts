import { describe, expect, test } from "vitest";

import { buildFacets, mainFacetOf } from "@/lib/bazi/pair-matching";
import type { DayPillar, PillarPos } from "@/lib/bazi/pair-types";
import { buildManVsDay, buildManVsDayMonth, buildManVsDayYear, isBranchClash } from "@/lib/bazi/manvsday";
import { pillarsForDate } from "@/lib/bazi/almanac/almanac-engine";

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

describe("DAYMATE — คำทำนายรายด้านใช้ชุดข้อความตามด้าน (ฟีม สไลด์ 16 ข้อ 3)", () => {
  test("workplace/home/outside ไม่ใช้ข้อความชุดเดียวกับ companions (เชี่ยงแซความรัก) แล้ว", () => {
    const facets = buildFacets("day", MAN, DAY);
    const by = Object.fromEntries(facets.map((f) => [f.key, f]));
    // companions ยังเป็นชุดคนรัก (ค่าเดิม); ด้านอื่นต้องได้ข้อความจากชุด role ของตัวเอง
    for (const k of ["companions", "workplace", "home", "outside"]) {
      expect(by[k].lines.length).toBeGreaterThan(0);
      for (const ln of by[k].lines) expect(ln.text.length).toBeGreaterThan(0);
    }
    // ด้านที่ใช้โค้ดเดียวกัน (ก้าน) ต้องได้ narrative ต่างกันเมื่อชุดข้อความต่างกัน
    const sameCode = (a: string, b: string) => by[a].lines[0].code === by[b].lines[0].code;
    const distinct = (a: string, b: string) => by[a].lines[0].text !== by[b].lines[0].text;
    // อย่างน้อยหนึ่งคู่ที่โค้ดตรงกันต้องมีข้อความต่างกัน — ถ้าทุกด้านยังดึงชุดเดียวกัน ข้อนี้แดง
    const pairs = [["workplace", "companions"], ["home", "companions"], ["outside", "companions"]] as const;
    const proven = pairs.some(([a, b]) => sameCode(a, b) && distinct(a, b));
    const allDifferentCodes = pairs.every(([a, b]) => !sameCode(a, b));
    expect(proven || allDifferentCodes).toBe(true);
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

// วันชงดิถี (地支相冲) — เตือนวันชงที่ %เฉลี่ย 4 ด้านกลบไม่เห็น (ซินแส/เอ็ม 2026-09-26)
describe("วันชงดิถี (地支相冲)", () => {
  test("isBranchClash: 6 คู่ชงคืน true (สองทาง), อื่นคืน false", () => {
    const pairs: [string, string][] = [["子", "午"], ["丑", "未"], ["寅", "申"], ["卯", "酉"], ["辰", "戌"], ["巳", "亥"]];
    for (const [a, b] of pairs) {
      expect(isBranchClash(a, b)).toBe(true);
      expect(isBranchClash(b, a)).toBe(true);
    }
    expect(isBranchClash("子", "丑")).toBe(false); // ไม่ใช่คู่ชง
    expect(isBranchClash("酉", "酉")).toBe(false); // ตัวเดียวกันไม่ชง
    expect(isBranchClash(null, "午")).toBe(false);
    expect(isBranchClash("午", "")).toBe(false);
  });

  test("buildManVsDay ตั้ง dayClash=true เมื่อกิ่งเสาวันเจ้าของ (酉) ชงกิ่งเสาวันของวัน (卯)", () => {
    // MAN.day = 己酉 → หาวันในปี 2026 ที่เสาวันมีกิ่ง 卯 (卯酉冲) และวันที่ไม่ชง เทียบ
    let clashDay: { m: number; d: number } | null = null;
    let calmDay: { m: number; d: number } | null = null;
    outer: for (let m = 1; m <= 12; m += 1) {
      const dim = new Date(2026, m, 0).getDate();
      for (let d = 1; d <= dim; d += 1) {
        const br = pillarsForDate(2026, m, d).dayPillar.branch;
        if (br === "卯" && !clashDay) clashDay = { m, d };
        if (br !== "卯" && br !== "酉" && !calmDay) calmDay = { m, d };
        if (clashDay && calmDay) break outer;
      }
    }
    expect(clashDay).not.toBeNull();
    expect(calmDay).not.toBeNull();
    const rc = buildManVsDay(MAN, MAN.day, 2026, clashDay!.m, clashDay!.d);
    expect(rc.dayClash).toBe(true);
    expect(rc.summaryItems.some((it) => it.key === "clash")).toBe(true);
    expect(rc.summaryHeadline).toContain("วันชงดิถี");
    const rn = buildManVsDay(MAN, MAN.day, 2026, calmDay!.m, calmDay!.d);
    expect(rn.dayClash).toBe(false);
    expect(rn.summaryItems.some((it) => it.key === "clash")).toBe(false);
  });
});
