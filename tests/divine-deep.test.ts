// ความรู้เชิงลึกไพ่จิตวิญญาณแดนสวรรค์ (ซินแสนุ้ย 2026-10-22): ครบ 80 ใบ · เลือกหัวข้อตามคำถาม · ใส่ prompt LLM
import { describe, expect, it } from "vitest";
import { getAllCards } from "@/lib/bazi/divine-cards/deck";
import {
  DIVINE_DEEP_TOPICS,
  divineDeepContext,
  getDivineDeep,
  pickDivineTopic,
  pickLoveStatus,
} from "@/lib/bazi/divine-cards/deep";
import { buildDivineReading } from "@/lib/bazi/divine-cards/reading-engine";
import { buildUserPrompt } from "@/lib/bazi/divine-cards/reading-llm";

describe("divine deep knowledge", () => {
  it("ครบ 80 ใบ ทุกใบมี 9 หัวข้อ + ประวัติ + สัดส่วนบวก:ลบ", () => {
    for (const card of getAllCards()) {
      const d = getDivineDeep(card.no);
      expect(d, `card ${card.no}`).toBeDefined();
      expect(d!.history.length).toBeGreaterThan(100);
      for (const t of DIVINE_DEEP_TOPICS) {
        if (t === "love") {
          expect(d!.sections.love.couple.length, `${card.no} couple`).toBeGreaterThan(30);
          expect(d!.sections.love.single.length, `${card.no} single`).toBeGreaterThan(30);
        } else {
          expect(d!.sections[t].length, `${card.no} ${t}`).toBeGreaterThan(30);
        }
      }
      expect(d!.positive! + d!.negative!).toBeGreaterThanOrEqual(95);
      expect(d!.positive! + d!.negative!).toBeLessThanOrEqual(105);
    }
  });

  it("เลือกหัวข้อ/สถานะรักจากคำถาม", () => {
    expect(pickDivineTopic("เดือนนี้การเงินจะดีไหม")).toBe("wealth");
    expect(pickDivineTopic("แฟนจะกลับมาไหม")).toBe("love");
    expect(pickDivineTopic("จะได้เลื่อนตำแหน่งไหม")).toBe("work");
    expect(pickDivineTopic("แม่จะหายป่วยไหม")).toBe("health");
    expect(pickDivineTopic("ช่วงนี้เป็นยังไง")).toBeNull();
    expect(pickDivineTopic()).toBeNull();
    expect(pickLoveStatus("โสดมานาน จะเจอเนื้อคู่ไหม")).toBe("single");
    expect(pickLoveStatus("สามีจะเปลี่ยนไปไหม")).toBe("couple");
    expect(pickLoveStatus("ความรักช่วงนี้")).toBeNull();
  });

  it("บริบท: ตรงหัวข้อ ไม่ยัดทั้งใบ · รักโสดได้เฉพาะคนโสด", () => {
    const money = divineDeepContext(1, "การเงินเดือนหน้า");
    expect(money).toContain("[การเงิน]");
    expect(money).toContain("เชิงบวก 92% : เชิงลบ 8%");
    expect(money).toContain("[ประวัติองค์เทพ");
    expect(money).not.toContain("[สุขภาพ]");
    expect(money.length).toBeLessThan(1600);
    const single = divineDeepContext(1, "โสดอยู่ จะเจอคนใหม่ไหม");
    expect(single).toContain("คนโสด");
    expect(single).not.toContain("คนมีคู่");
    expect(divineDeepContext(1)).toContain("[ความหมายทั่วไป");
    expect(divineDeepContext(999)).toBe("");
  });

  it("prompt LLM มีความรู้เชิงลึกของทั้ง 3 ใบ", () => {
    const [a, b, c] = getAllCards();
    const prompt = buildUserPrompt(buildDivineReading([a, b, c] as const, "งานปีนี้"), "งานปีนี้");
    expect(prompt.match(/ความรู้เชิงลึก:/g)?.length).toBe(3);
    expect(prompt).toContain("[การงาน]");
  });
});
