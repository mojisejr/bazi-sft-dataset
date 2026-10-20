import { describe, expect, test } from "vitest";

import { buildAlmanacMonth } from "@/lib/bazi/almanac/almanac-engine";
import { dayUniversalScore, universalLabel } from "@/lib/bazi/almanac/universal-score";

// Kittipon 2026-10-20: วง "สากล" (คุณภาพวัน) คู่กับ % เฉพาะบุคคล — ใช้กำลังดิถีวันของปฏิทินต้นฉบับ
describe("universal day score", () => {
  test("ratioDay → 0-100 ตัดที่ 100 (帝旺 110)", () => {
    expect(dayUniversalScore({ ratioDay: 0.9 }).score).toBe(90);
    expect(dayUniversalScore({ ratioDay: 1.08 }).score).toBe(100);
    expect(dayUniversalScore({ ratioDay: Number.NaN }).score).toBe(0);
  });

  test("เกณฑ์คำ", () => {
    expect(universalLabel(80)).toBe("ดีเยี่ยม");
    expect(universalLabel(79)).toBe("ดี");
    expect(universalLabel(65)).toBe("ดี");
    expect(universalLabel(64)).toBe("พอใช้");
    expect(universalLabel(45)).toBe("พอใช้");
    expect(universalLabel(44)).toBe("ระวัง");
  });

  test("ทุกวันของเดือนมี universal ตรงกับ strength.ratioDay", () => {
    const m = buildAlmanacMonth(2569, 10);
    expect(m.days.length).toBeGreaterThan(27);
    for (const d of m.days) {
      expect(d.universal.score).toBe(Math.min(100, Math.round(d.strength.ratioDay * 100)));
      expect(d.universal.score).toBeGreaterThanOrEqual(0);
      expect(d.universal.score).toBeLessThanOrEqual(100);
    }
  });
});
