import { describe, it, expect } from "vitest";
import { elementTier, buildElementNisai, ELEMENT_NISAI } from "@/lib/bazi/nisai-by-element";

const counts = (o: Partial<Record<string, number>>) => ({ wood: 0, fire: 0, earth: 0, metal: 0, water: 0, ...o });

describe("elementTier (กฎซินแส: ≥2 หรือ 1+ธาตุส่งเสริม)", () => {
  it("count ≥ 2 → strong", () => {
    expect(elementTier("earth", counts({ earth: 2 }))).toBe("strong");
    expect(elementTier("earth", counts({ earth: 3 }))).toBe("strong");
  });
  it("count 1 + ธาตุส่งเสริม ≥ 1 → strong (ไฟส่งเสริมดิน)", () => {
    // ธาตุส่งเสริมของดิน = ไฟ (GENERATES[fire]=earth)
    expect(elementTier("earth", counts({ earth: 1, fire: 1 }))).toBe("strong");
  });
  it("count 1 แต่ไม่มีธาตุส่งเสริม → weak", () => {
    expect(elementTier("earth", counts({ earth: 1, wood: 2 }))).toBe("weak");
  });
  it("count 0 → weak", () => {
    expect(elementTier("water", counts({}))).toBe("weak");
  });
  it("ธาตุส่งเสริมถูกต้องทุกธาตุ (ผกผัน GENERATES)", () => {
    expect(elementTier("fire", counts({ fire: 1, wood: 1 }))).toBe("strong"); // ไม้→ไฟ
    expect(elementTier("metal", counts({ metal: 1, earth: 1 }))).toBe("strong"); // ดิน→ทอง
    expect(elementTier("water", counts({ water: 1, metal: 1 }))).toBe("strong"); // ทอง→น้ำ
    expect(elementTier("wood", counts({ wood: 1, water: 1 }))).toBe("strong"); // น้ำ→ไม้
  });
});

describe("buildElementNisai", () => {
  it("คืน 5 ธาตุ พร้อม tier + text ตรงกับ ELEMENT_NISAI", () => {
    const out = buildElementNisai(counts({ earth: 2, water: 0 }));
    expect(out).toHaveLength(5);
    const earth = out.find((e) => e.element === "earth")!;
    expect(earth.tier).toBe("strong");
    expect(earth.text).toBe(ELEMENT_NISAI.earth.strong);
    const water = out.find((e) => e.element === "water")!;
    expect(water.tier).toBe("weak");
    expect(water.text).toBe(ELEMENT_NISAI.water.weak);
  });
});
