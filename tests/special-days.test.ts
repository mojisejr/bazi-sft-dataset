import { describe, expect, test } from "vitest";

import { buildAlmanacDay } from "@/lib/bazi/almanac/almanac-engine";
import { specialDaysFor } from "@/lib/bazi/almanac/special-days";
import { thaiLunarDay } from "@/lib/bazi/thai-lunar";
import { solarTermFor } from "@/lib/bazi/almanac/solar-terms-data";

function namesFor(year: number, month: number, day: number): string[] {
  const ctx = { thaiLunar: thaiLunarDay(year, month, day), solarTerm: solarTermFor(year, month, day) };
  return specialDaysFor(year, month, day, ctx).map((s) => s.name);
}

describe("special-days — fixed Gregorian (ราชการ/เทศกาลไทย)", () => {
  test("วันสำคัญราชการตามวันที่คงที่", () => {
    expect(namesFor(2026, 1, 1)).toContain("วันขึ้นปีใหม่");
    expect(namesFor(2026, 4, 6)).toContain("วันจักรี");
    expect(namesFor(2026, 10, 23)).toContain("วันปิยมหาราช");
    expect(namesFor(2026, 12, 10)).toContain("วันรัฐธรรมนูญ");
  });
  test("สงกรานต์ (ช่วง 13–15 เม.ย.)", () => {
    for (const d of [13, 14, 15]) expect(namesFor(2026, 4, d)).toContain("วันสงกรานต์");
    expect(namesFor(2026, 4, 12)).not.toContain("วันสงกรานต์");
  });
  test("วันเด็กแห่งชาติ = เสาร์ที่ 2 ของ ม.ค. (2026-01-10)", () => {
    expect(namesFor(2026, 1, 10)).toContain("วันเด็กแห่งชาติ");
    expect(namesFor(2026, 1, 3)).not.toContain("วันเด็กแห่งชาติ");
  });
});

describe("special-days — วันสำคัญพุทธ (จันทรคติไทย)", () => {
  test("อาสาฬหบูชา + เข้าพรรษา 2025", () => {
    expect(namesFor(2025, 7, 10)).toContain("วันอาสาฬหบูชา");
    expect(namesFor(2025, 7, 11)).toContain("วันเข้าพรรษา");
  });
});

describe("special-days — จันทร์จีน (lunar-javascript)", () => {
  test("ตรุษจีน 2026 = 2026-02-17 (lunar 1/1)", () => {
    expect(namesFor(2026, 2, 17)).toContain("วันตรุษจีน");
  });
  test("วันพระจีน = 初一 / 十五 (ตรุษจีนเป็น 初一 ด้วย)", () => {
    expect(namesFor(2026, 2, 17)).toContain("วันพระจีน (初一/十五)");
    // mid-autumn lunar 8/15
    const midAutumn = namesFor(2026, 9, 25);
    // 2026 中秋 ตรงกับ 2026-09-25 (lunar 8/15) — ตรวจว่าเป็นวันพระจีนด้วย
    expect(midAutumn).toContain("วันพระจีน (初一/十五)");
  });
});

describe("special-days — solar-term (เช็งเม้ง/ตังโจ่ย)", () => {
  test("เช็งเม้ง = วันสารท 清明", () => {
    // 2569/4: หาวันที่ solarTerm.name === 清明 ในเดือน เม.ย. 2026
    let found = "";
    for (let d = 3; d <= 6; d += 1) {
      if (solarTermFor(2026, 4, d)?.name === "清明") found = `2026-04-${d}`;
    }
    expect(found).not.toBe("");
    const [y, m, dd] = found.split("-").map(Number);
    expect(namesFor(y, m, dd)).toContain("เทศกาลเช็งเม้ง");
  });
  test("ตังโจ่ย = วันสารท 冬至 (ธ.ค.)", () => {
    let found = "";
    for (let d = 20; d <= 23; d += 1) {
      if (solarTermFor(2026, 12, d)?.name === "冬至") found = `2026-12-${d}`;
    }
    expect(found).not.toBe("");
    const [y, m, dd] = found.split("-").map(Number);
    expect(namesFor(y, m, dd)).toContain("เทศกาลตังโจ่ย (ไหว้ขนมบัวลอย)");
  });
});

describe("special-days — ผูกเข้า engine (buildAlmanacDay)", () => {
  test("buildAlmanacDay แนบ specialDays + thaiLunar + วันพระไทย", () => {
    const newYear = buildAlmanacDay(2026, 1, 1);
    expect(newYear.specialDays.map((s) => s.name)).toContain("วันขึ้นปีใหม่");
    expect(newYear.thaiLunar.label).toMatch(/ค่ำ/);
    // ทั้งปีต้องมีวันพระไทยบ้าง
    const days = [];
    for (let d = 1; d <= 31; d += 1) days.push(buildAlmanacDay(2026, 1, d));
    expect(days.some((x) => x.thaiLunar.isWanPhra)).toBe(true);
  });
});
