import { describe, expect, test } from "vitest";

import { wantsFengshui } from "@/features/open-webui/gemini-adapter";
import { drawRandom, getAllCards } from "@/lib/bazi/fengshui/deck";
import { buildFengshuiReading } from "@/lib/bazi/fengshui/reading-engine";
import { seedFromQuestion } from "@/lib/bazi/seed";

describe("fengshui deck", () => {
  test("มี 78 ใบ ครบ no 1..78 ไม่มี field ว่าง", () => {
    const cards = getAllCards();
    expect(cards.length).toBe(78);
    const nos = cards.map((c) => c.no).sort((a, b) => a - b);
    expect(nos[0]).toBe(1);
    expect(nos[77]).toBe(78);
    for (const c of cards) {
      expect(c.name.trim().length).toBeGreaterThan(0);
      expect(c.meaning.trim().length).toBeGreaterThan(0);
    }
  });

  test("จั่ว 3 ใบไม่ซ้ำ + seed เดียวกันได้ไพ่เดิม (deterministic)", () => {
    const q = "บ้านนี้ฮวงจุ้ยเป็นยังไง";
    const a = drawRandom(3, seedFromQuestion(q));
    const b = drawRandom(3, seedFromQuestion(q));
    expect(a.length).toBe(3);
    expect(new Set(a.map((c) => c.no)).size).toBe(3); // ไม่ซ้ำ
    expect(a.map((c) => c.no)).toEqual(b.map((c) => c.no)); // seed เดิม = ไพ่เดิม
  });
});

describe("wantsFengshui detector", () => {
  test.each([
    ["บ้านนี้ฮวงจุ้ยเป็นยังไงบ้าง", true],
    ["ที่ทำงานมีอะไรติดขัด", true],
    ["ห้องนอนควรปรับตรงไหน", true],
    ["ชัยภูมิที่ดินแปลงนี้เป็นไง", true],
    ["ปีนี้การเงินเป็นยังไง", false],
    ["ควรซื้อบ้านช่วงไหนดี", false],
    ["ของหายจะได้คืนไหม", false],
  ])("%s -> %s", (q, expected) => {
    expect(wantsFengshui(q)).toBe(expected);
  });
});

describe("buildFengshuiReading", () => {
  test("รวม 3 ใบ + คำถาม ลง engineProse", () => {
    const q = "ที่ทำงานฮวงจุ้ยเป็นยังไง";
    const cards = drawRandom(3, seedFromQuestion(q));
    const reading = buildFengshuiReading(cards, q);
    expect(reading.engineProse).toContain(q);
    expect((reading.engineProse.match(/ไพ่ใบที่/g) || []).length).toBe(3);
    for (const c of cards) expect(reading.engineProse).toContain(c.name);
  });
});
