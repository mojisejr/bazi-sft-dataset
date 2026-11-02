// ไพ่เทพเซียน: ชุดละ 21 ใบครบรูป · 8 เซียนมีเนื้อหาครบ · จั่วไม่ซ้ำ · ถ่วง 50/30/20
import { describe, expect, it } from "vitest";
import { IMMORTAL_DECKS, drawImmortal, getImmortalDeck } from "@/lib/bazi/immortal-cards/decks";
import { IMMORTAL_SLOTS, buildImmortalPrompt, immortalTopic } from "@/lib/bazi/immortal-cards/reading";

describe("immortal cards", () => {
  it("ทุกชุด 21 ใบ มีรูปครบ เลข 1–21", () => {
    for (const d of IMMORTAL_DECKS) {
      expect(d.cards.map((c) => c.no).sort((a, b) => a - b)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
      expect(d.cards.every((c) => c.imageUrl)).toBe(true);
    }
  });
  it("โป๊ยเซียนมีเนื้อหาครบ แบ่งหมวด 7/7/7", () => {
    const d = getImmortalDeck("poysian")!;
    expect(d.cards.every((c) => c.overall && c.work && c.money && c.loveSingle && c.advice)).toBe(true);
    expect(d.cards.filter((c) => c.category === "เตือน").length).toBe(7);
  });
  it("จั่ว 3 ใบไม่ซ้ำ · น้ำหนัก 50/30/20 · เลือกหัวข้อตามคำถาม", () => {
    const d = getImmortalDeck("poysian")!;
    const c = drawImmortal(d, 3);
    expect(new Set(c.map((x) => x.no)).size).toBe(3);
    expect(IMMORTAL_SLOTS.map((s) => s.weight)).toEqual([50, 30, 20]);
    expect(immortalTopic("เดือนนี้การเงินดีไหม")).toBe("money");
    expect(buildImmortalPrompt(c, "งานปีนี้")).toContain("ตรงคำถาม:");
  });
});
