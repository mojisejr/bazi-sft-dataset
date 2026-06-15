import { describe, expect, test } from "vitest";

import { drawRandom, getAllCards, getCardByNo } from "@/lib/bazi/divine-cards/deck";

describe("divine-cards deck", () => {
  test("โหลดไพ่ครบ 80 ใบ พร้อมเลขไม่ซ้ำและมีเนื้อหาหลัก", () => {
    const cards = getAllCards();
    expect(cards).toHaveLength(80);
    const nos = new Set(cards.map((c) => c.no));
    expect(nos.size).toBe(80);
    for (const card of cards) {
      expect(card.name.length).toBeGreaterThan(0);
      expect(card.prophecy.length).toBeGreaterThan(0);
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

  test("drawRandom seed ต่างกันให้ผลต่างกัน (ส่วนใหญ่)", () => {
    const a = drawRandom(3, 1).map((c) => c.no).join(",");
    const b = drawRandom(3, 2).map((c) => c.no).join(",");
    expect(a).not.toBe(b);
  });
});
