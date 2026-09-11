import { describe, it, expect } from "vitest";
import { buildAlmanacMonth, buildAlmanacDay } from "@/lib/bazi/almanac/almanac-engine";

const GATE_ORDER = ["開", "休", "生", "傷", "杜", "景", "死", "驚"];
const DIR_SET = new Set(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);

// ก.ย.–พ.ย. 2569 (= CE 2026-09..11) อยู่ในช่วงที่สเปรดชีตคี้มึ้งครอบคลุมเต็ม
describe("คี้มึ้ง 8 ประตู 8 เทพ — ทุกวันในช่วงข้อมูล มาจากสเปรดชีต", () => {
  for (const month of [9, 10, 11]) {
    it(`2026-${month}: ทุกวันมี 8 ประตู(เรียงคงที่)+ทิศ และ 8 เทพ+ทิศ (spirits.direction ครบ = hit คี้มึ้ง)`, () => {
      const m = buildAlmanacMonth(2026, month);
      expect(m.days.length).toBeGreaterThan(27);
      for (const day of m.days) {
        expect(day.gates.map((g) => g.name)).toEqual(GATE_ORDER);
        for (const g of day.gates) expect(DIR_SET.has(g.direction)).toBe(true);
        expect(day.spirits).toHaveLength(8);
        for (const s of day.spirits) expect(s.direction && DIR_SET.has(s.direction)).toBe(true);
      }
    });
  }
});

describe("คี้มึ้ง — spot ตรงสเปรดชีต (non-circular, hardcode จากชีต)", () => {
  it("2026-09-01 (戊寅|丙申|丙午) ตรงแถวแรกของชีต ก.ย.", () => {
    const day = buildAlmanacDay(2026, 9, 1);
    expect(day.gates.map((g) => `${g.name}${g.direction}`).join(" "))
      .toBe("開SW 休W 生NW 傷N 杜NE 景E 死SE 驚S");
    expect(day.spirits.map((s) => s.name).join("")).toBe("蛇符天地玄虎合陰");
    expect(day.spirits.map((s) => s.direction).join(" ")).toBe("SW W NW N NE E SE S");
  });
});
