import { describe, it, expect } from "vitest";
import { buildAlmanacDay, pillarsForDate } from "@/lib/bazi/almanac/almanac-engine";

const LOVE: Record<string, string> = { 子: "酉", 丑: "午", 寅: "卯", 卯: "子", 辰: "酉", 巳: "午", 午: "卯", 未: "子", 申: "酉", 酉: "午", 戌: "卯", 亥: "子" };
const FORTUNE: Record<string, string> = { 子: "子", 丑: "寅", 寅: "辰", 卯: "午", 辰: "申", 巳: "戌", 午: "子", 未: "寅", 申: "辰", 酉: "午", 戌: "申", 亥: "戌" };
const DOCTOR: Record<string, string> = { 子: "申", 丑: "酉", 寅: "戌", 卯: "亥", 辰: "子", 巳: "丑", 午: "寅", 未: "卯", 申: "辰", 酉: "巳", 戌: "午", 亥: "未" };
const PARDON: Record<string, string> = { 寅: "戊寅", 辰: "戊寅", 巳: "甲午", 未: "甲午", 酉: "戊申", 子: "甲子" };

function* daysOf(year: number) {
  for (let m = 1; m <= 12; m++) {
    const last = new Date(year, m, 0).getDate();
    for (let d = 1; d <= last; d++) yield [m, d] as const;
  }
}

describe("วันพิเศษ (ความรัก/ลาภสวรรค์/หมอเทพ/ฟ้าอภัย) — invariant ตลอดปี 2026", () => {
  const found: Record<string, number> = { "วันความรัก": 0, "วันลาภสวรรค์": 0, "วันหมอเทพ": 0, "วันเทียนเซ่อ (ฟ้าอภัย)": 0 };
  const rows: { mb: string; db: string; gz: string; names: string[] }[] = [];
  for (const [m, d] of daysOf(2026)) {
    const p = pillarsForDate(2026, m, d);
    const names = buildAlmanacDay(2026, m, d).dayStars.map((s) => s.name);
    for (const n of names) if (n in found) found[n]++;
    rows.push({ mb: p.monthPillar.branch, db: p.dayPillar.branch, gz: p.dayPillar.ganzhi, names });
  }

  it("ทุกวันที่ถูกแท็ก ตรงกับ map ของแต่ละหมวด (month-branch → day)", () => {
    for (const r of rows) {
      if (r.names.includes("วันความรัก")) expect(r.db).toBe(LOVE[r.mb]);
      if (r.names.includes("วันลาภสวรรค์")) expect(r.db).toBe(FORTUNE[r.mb]);
      if (r.names.includes("วันหมอเทพ")) expect(r.db).toBe(DOCTOR[r.mb]);
      if (r.names.includes("วันเทียนเซ่อ (ฟ้าอภัย)")) expect(r.gz).toBe(PARDON[r.mb]);
    }
  });

  it("เจอครบทุกหมวด (ไม่ใช่ศูนย์)", () => {
    expect(found["วันความรัก"]).toBeGreaterThan(0);
    expect(found["วันลาภสวรรค์"]).toBeGreaterThan(0);
    expect(found["วันหมอเทพ"]).toBeGreaterThan(0);
    expect(found["วันเทียนเซ่อ (ฟ้าอภัย)"]).toBeGreaterThan(0);
  });
});
