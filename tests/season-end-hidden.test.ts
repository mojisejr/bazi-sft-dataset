import { describe, expect, it } from "vitest";
import { isInSeason, type ChartFacts } from "@/lib/bazi/newdata-lookup";

// ซินแสนุ้ย 2026-10-06: เดือนท้ายฤดู 辰 แฝงไม้ · 未 แฝงไฟ → ดิถีธาตุนั้นเกิดถูกฤดู
const facts = (dayMaster: string, monthBranch: string) =>
  ({ dayMaster, pillars: [{ position: "month", stem: "丁", branch: monthBranch }] }) as unknown as ChartFacts;

describe("isInSeason — เดือนท้ายฤดู", () => {
  it("ดิถีไฟ เกิดเดือน 未 = ถูกฤดู", () => expect(isInSeason(facts("丙", "未"))).toBe(true));
  it("ดิถีไม้ เกิดเดือน 辰 = ถูกฤดู", () => expect(isInSeason(facts("甲", "辰"))).toBe(true));
  it("ดิถีไฟ เกิดเดือน 辰 ไม่ใช่ 'ถูกฤดู' (เป็นแค่ส่งเสริม)", () => expect(isInSeason(facts("丙", "辰"))).toBe(false));
  it("庚 เกิดเดือน 戌 ยังไม่ถูกฤดู (ผั่ว+ซวย แข็งไม่จริง)", () => expect(isInSeason(facts("庚", "戌"))).toBe(false));
  it("กิ่งเดือนธาตุเดียวกับดิถียังถูกฤดูเหมือนเดิม", () => expect(isInSeason(facts("丙", "午"))).toBe(true));
});
