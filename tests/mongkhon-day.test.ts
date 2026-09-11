import { describe, it, expect } from "vitest";
import { isMongkhonDay, buildAlmanacDay, pillarsForDate } from "@/lib/bazi/almanac/almanac-engine";

describe("วันมงคล — ผ่าน 3 ชั้น A∧B∧C (FIXเงื่อนไขปฏิทิน.docx)", () => {
  it("ผ่านครบ 3 ชั้น → true (丙子 เดือน 子: A11∈, B5∈, C1∈)", () => {
    expect(isMongkhonDay("丙", "子", "子")).toBe(true);
  });
  it("ตกชั้น C → false (เดือน 子 วันกิ่ง 丑 = C2 ∉ {1,3,5,6,9,11})", () => {
    expect(isMongkhonDay("甲", "丑", "子")).toBe(false);
  });
  it("integration: 2026-01-02 (丙子) ติดแท็ก วันมงคล", () => {
    expect(buildAlmanacDay(2026, 1, 2).dayStars.some((s) => s.name === "วันมงคล")).toBe(true);
  });
  it("consistency: แท็กใน buildAlmanacDay ⇔ isMongkhonDay ตลอดปี 2026 และไม่ใช่ศูนย์", () => {
    let n = 0;
    for (let m = 1; m <= 12; m++) {
      const last = new Date(2026, m, 0).getDate();
      for (let d = 1; d <= last; d++) {
        const p = pillarsForDate(2026, m, d);
        const tagged = buildAlmanacDay(2026, m, d).dayStars.some((s) => s.name === "วันมงคล");
        expect(tagged).toBe(isMongkhonDay(p.dayPillar.stem, p.dayPillar.branch, p.monthPillar.branch));
        if (tagged) n++;
      }
    }
    expect(n).toBeGreaterThan(0);
  });
});
