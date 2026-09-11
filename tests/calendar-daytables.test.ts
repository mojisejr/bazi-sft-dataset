import { describe, it, expect } from "vitest";
import { buildAlmanacMonth } from "@/lib/bazi/almanac/almanac-engine";
import deity from "@/lib/bazi/data/almanac/worship-deity-60.json";
import color from "@/lib/bazi/data/almanac/shirt-color-60.json";
import dir from "@/lib/bazi/data/almanac/day-direction-60.json";

describe("ตาราง 60 วัน: เทพ/สี/ทิศ (ingest จากเอกสารซินแส)", () => {
  it("ครบ 60 day-ganzhi ทั้ง 3 ตาราง", () => {
    expect(Object.keys(deity)).toHaveLength(60);
    expect(Object.keys(color)).toHaveLength(60);
    expect(Object.keys(dir)).toHaveLength(60);
  });

  it("spot 甲子 ตรงเอกสาร", () => {
    expect((deity as Record<string, string[]>)["甲子"]).toEqual(["เจ้าแม่กวนอิมองค์นั่งบัว"]);
    expect((color as Record<string, { navin: string }>)["甲子"].navin).toBe("นับอิมทอง");
    expect((dir as Record<string, { fortune: string; bad: string; patrons: { degree: string; zodiac: string }[] }>)["甲子"])
      .toEqual({ fortune: "SE", patrons: [{ degree: "30", zodiac: "ฉลู" }, { degree: "210", zodiac: "มะแม" }], bad: "S" });
  });

  it("engine เติมเทพ/สี/ทิศ ให้ทุกวัน (60-cycle ครอบเต็ม) — ก.ย. 2026", () => {
    const m = buildAlmanacMonth(2026, 9);
    for (const d of m.days) {
      expect(d.worshipDeities.length).toBeGreaterThan(0);
      expect(d.shirtColors?.navin.startsWith("นับอิม")).toBe(true);
      expect(d.dayDirections?.fortune).toBeTruthy();
      expect(d.dayDirections?.bad).toBeTruthy();
    }
  });
});
