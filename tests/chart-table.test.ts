import { describe, expect, test } from "vitest";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { createNoOpKnowledgeRepository } from "@/lib/bazi/no-op-knowledge-repository";
import { buildChartTable, chartPillarOf, ganzhiOfYear } from "@/lib/bazi/chart-table";

describe("ตารางดวงจีน (chart-table) — ข้อมูลครบตาม Figma 720:32490", () => {
  test("ganzhiOfYear: 1984=甲子, 1989=己巳, 2026=丙午 (ตรงตาราง ปีจร 100 ปี ใน Figma)", () => {
    expect(ganzhiOfYear(1984)).toEqual({ stem: "甲", branch: "子" });
    expect(ganzhiOfYear(1989)).toEqual({ stem: "己", branch: "巳" });
    expect(ganzhiOfYear(2026)).toEqual({ stem: "丙", branch: "午" });
    expect(ganzhiOfYear(1923)).toEqual(ganzhiOfYear(1983)); // รอบ 60
  });

  test("chartPillarOf: ธาตุก้าน/กิ่ง (ไทย) + นักษัตร", () => {
    expect(chartPillarOf("壬", "申")).toEqual({ stem: "壬", branch: "申", stemElement: "น้ำ", branchElement: "ทอง", animal: "วอก" });
    expect(chartPillarOf("甲", "戌").branchElement).toBe("ดิน");
    expect(chartPillarOf("丁", "巳").animal).toBe("มะเส็ง");
  });

  test("buildChartTable: 5 เสา (รวมลัคนา) + วัยจรเรียงอายุ + ปีจร 15 ปีจากปีปัจจุบัน", async () => {
    const state = await calculateBaziStateFromRawInput(
      { birthDate: "1989-03-02", birthTime: "10:00", gender: "female", province: "กรุงเทพมหานคร" },
      { repository: createNoOpKnowledgeRepository() },
    );
    const t = buildChartTable(state, { birthDate: "1989-03-02", birthTime: "10:00" }, 2026);
    expect(t.birthDate).toBe("1989-03-02");
    for (const k of ["year", "month", "day", "hour"] as const) {
      const p = t.pillars[k];
      expect(p.stem).toHaveLength(1);
      expect(p.branch).toHaveLength(1);
      expect(p.stemElement).not.toBe("");
      expect(p.branchElement).not.toBe("");
      expect(p.animal).not.toBe("");
    }
    expect(t.pillars.year.stem + t.pillars.year.branch).toBe("己巳");
    expect(t.dayElement).toBe(t.pillars.day.stemElement);
    expect(t.pillars.ascendant === null || t.pillars.ascendant.stem.length === 1).toBe(true);

    expect(t.daYun.length).toBeGreaterThanOrEqual(8);
    for (let i = 1; i < t.daYun.length; i++) expect(t.daYun[i].startAge).toBeGreaterThan(t.daYun[i - 1].startAge);
    expect(t.daYun[0].ageRange).toBe(`${t.daYun[0].startAge}–${t.daYun[0].endAge}`);

    // ปีจร = 15 ปีนับจากปีปัจจุบัน (ฉีด 2026) ไม่ใช่ 100 ปีจากปีเกิด
    expect(t.liuNian).toHaveLength(15);
    expect(t.liuNian[0]).toMatchObject({ year: 2026, yearBE: 2569, age: 38, stem: "丙", branch: "午", animal: "มะเมีย" });
    expect(t.liuNian[14]).toMatchObject({ year: 2040, yearBE: 2583, age: 52 });
  });
});
