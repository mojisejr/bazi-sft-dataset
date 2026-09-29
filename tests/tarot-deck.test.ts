import { describe, expect, test } from "vitest";

import { drawRandom, drawReversals, getAllCards, getCardByNo, getCardsByGroup } from "@/lib/bazi/tarot/deck";
import { buildTarotReading } from "@/lib/bazi/tarot/reading-engine";

describe("tarot-tao deck", () => {
  test("โหลดไพ่ครบ 78 ใบ เลขไม่ซ้ำ และมีเนื้อหาหลัก", () => {
    const cards = getAllCards();
    expect(cards).toHaveLength(78);
    const nos = new Set(cards.map((c) => c.no));
    expect(nos.size).toBe(78);
    for (const card of cards) {
      expect(card.name.length).toBeGreaterThan(0);
      expect(card.meaning.length).toBeGreaterThan(0);
    }
  });

  test("โครงสำรับ RWS: major 22 + minor 14×4", () => {
    expect(getCardsByGroup("major")).toHaveLength(22);
    for (const suit of ["pentacles", "cups", "swords", "wands"] as const) {
      expect(getCardsByGroup(suit)).toHaveLength(14);
    }
  });

  test("getCardByNo คืนไพ่ถูกใบ และ undefined เมื่อไม่มี", () => {
    expect(getCardByNo(1)?.no).toBe(1);
    expect(getCardByNo(999)).toBeUndefined();
  });

  test("drawRandom(3, seed) deterministic และไม่ซ้ำใบ", () => {
    const a = drawRandom(3, 12345).map((c) => c.no);
    const b = drawRandom(3, 12345).map((c) => c.no);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(3);
  });

  test("buildTarotReading: 3 ใบ = Primary/Secondary/Supporting, 1 ใบ = Primary", () => {
    const three = buildTarotReading(drawRandom(3, 1));
    expect(three.slots.map((s) => s.role)).toEqual(["Primary", "Secondary", "Supporting"]);
    expect(three.engineProse.length).toBeGreaterThan(0);

    const one = buildTarotReading(drawRandom(1, 1));
    expect(one.slots).toHaveLength(1);
    expect(one.slots[0].role).toBe("Primary");
    expect(one.slots[0].weight).toBe(100);
  });

  test("น้ำหนัก 50/30/20 และกลับหัวใช้ความหมาย reversed", () => {
    const cards = drawRandom(3, 7);
    const r = buildTarotReading(cards, undefined, [true, false, false]);
    expect(r.slots.map((s) => s.weight)).toEqual([50, 30, 20]);
    expect(r.slots[0].reversed).toBe(true);
    expect(r.engineProse).toContain("REVERSED");
    expect(r.engineProse).toContain(cards[0].universalReversed);
  });

  test("drawReversals deterministic ตาม seed", () => {
    expect(drawReversals(3, 42)).toEqual(drawReversals(3, 42));
    expect(drawReversals(3, 42)).toHaveLength(3);
  });

  test("รูปไพ่ครบ 78 ใบ (อัปขึ้น Supabase แล้ว)", () => {
    const noImage = getAllCards().filter((c) => !c.imageUrl?.startsWith("https://"));
    expect(noImage.map((c) => c.name)).toEqual([]);
  });
});
