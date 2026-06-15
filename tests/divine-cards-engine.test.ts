import { describe, expect, test } from "vitest";

import type { DivineCard, DivineDraw } from "@/lib/bazi/divine-cards/deck";
import { buildDivineReading, DIVINE_WEIGHTS } from "@/lib/bazi/divine-cards/reading-engine";
import { polishDivineReading } from "@/lib/bazi/divine-cards/reading-llm";

function card(no: number, name: string, prophecy: string): DivineCard {
  return {
    no,
    group: "หมวดทดสอบ",
    name,
    keywordEn: `kw${no}`,
    keywords: `คำสำคัญ${no}`,
    lifeImage: `ภาพ${no}`,
    prophecy,
  };
}

const DRAW: DivineDraw = [
  card(1, "ไพ่หนึ่ง", "เนื้อทำนายใบหนึ่ง"),
  card(2, "ไพ่สอง", "เนื้อทำนายใบสอง"),
  card(3, "ไพ่สาม", "เนื้อทำนายใบสาม"),
];

describe("buildDivineReading", () => {
  test("น้ำหนัก 50/30/20 และลำดับ role ถูก", () => {
    const reading = buildDivineReading(DRAW);
    expect(reading.slots.map((s) => s.weight)).toEqual([...DIVINE_WEIGHTS]);
    expect(reading.slots.map((s) => s.position)).toEqual([1, 2, 3]);
    expect(reading.slots[0].role).toContain("แกนหลัก");
    expect(reading.slots[1].role).toContain("ขยายชุดที่ 1");
    expect(reading.slots[2].role).toContain("ขยายชุดที่ 1 และ 2");
  });

  test("engineProse นำด้วยใบหลัก แล้วขยายใบ 2 และ 3 ครบเนื้อหา", () => {
    const reading = buildDivineReading(DRAW);
    const prose = reading.engineProse;
    // ใบหลักมาก่อนใบสองก่อนใบสาม
    const i1 = prose.indexOf("เนื้อทำนายใบหนึ่ง");
    const i2 = prose.indexOf("เนื้อทำนายใบสอง");
    const i3 = prose.indexOf("เนื้อทำนายใบสาม");
    expect(i1).toBeGreaterThanOrEqual(0);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
    expect(prose).toContain("50%");
    expect(prose).toContain("30%");
    expect(prose).toContain("20%");
  });

  test("มีคำถาม → engineProse ขึ้นต้นด้วยบรรทัดคำถาม", () => {
    const reading = buildDivineReading(DRAW, "ปีนี้การงานเป็นอย่างไร");
    expect(reading.engineProse.startsWith("คำถามที่ถาม: ปีนี้การงานเป็นอย่างไร")).toBe(true);
  });

  test("ไม่มีคำถาม → ไม่มีบรรทัดคำถาม", () => {
    const reading = buildDivineReading(DRAW);
    expect(reading.engineProse).not.toContain("คำถามที่ถาม:");
  });
});

describe("polishDivineReading", () => {
  test("ส่ง prompt ที่มีไพ่ทั้ง 3 ใบไปยัง generator (DI) และคืนข้อความที่เกลาแล้ว", async () => {
    const reading = buildDivineReading(DRAW);
    let seenPrompt = "";
    let seenTemp: number | undefined;
    const result = await polishDivineReading(
      { reading, apiKey: "test" },
      {
        generateContent: async (req) => {
          seenPrompt = req.contents;
          seenTemp = req.config.temperature;
          return { text: "คำทำนายที่เกลาแล้ว" };
        },
      },
    );
    expect(result.text).toBe("คำทำนายที่เกลาแล้ว");
    expect(seenPrompt).toContain("ไพ่หนึ่ง");
    expect(seenPrompt).not.toContain("คำถามจากผู้รับ");
    expect(seenPrompt).toContain("ไพ่สอง");
    expect(seenPrompt).toContain("ไพ่สาม");
    // temperature ต่ำ กันการแต่งเติม
    expect(seenTemp).toBeLessThanOrEqual(0.3);
  });

  test("ส่งคำถามไปด้วย → prompt มีคำถามและคำสั่งให้วิเคราะห์ตอบ", async () => {
    const reading = buildDivineReading(DRAW, "ควรย้ายงานไหม");
    let seenPrompt = "";
    await polishDivineReading(
      { reading, question: "ควรย้ายงานไหม", apiKey: "test" },
      {
        generateContent: async (req) => {
          seenPrompt = req.contents;
          return { text: "ok" };
        },
      },
    );
    expect(seenPrompt).toContain("คำถามจากผู้รับ: ควรย้ายงานไหม");
  });
});
