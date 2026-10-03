import { describe, expect, test } from "vitest";

import { getAllCards } from "@/lib/bazi/tarot/deck";
import { getSinsaeCard, sinsaeBlock, topicOfQuestion } from "@/lib/bazi/tarot/sinsae-book";
import { buildTarotReading } from "@/lib/bazi/tarot/reading-engine";

describe("ตำราไพ่ทาโรต์ซินแสนุ้ย (เล่ม 2)", () => {
  test("มีครบ 78 ใบ ผูกเลขตรงกับสำรับ และมีหัวข้อหลักครบทุกใบ", () => {
    for (const c of getAllCards()) {
      const s = getSinsaeCard(c.no);
      expect(s, c.name).toBeDefined();
      expect(s!.meaning.length, c.name).toBeGreaterThan(0);
      expect(s!.core.energy, c.name).not.toBeNull();
      expect(s!.oracle.length, c.name).toBeGreaterThan(0);
      for (const k of ["finance", "career", "health", "family", "love", "reversed"] as const) {
        expect(s![k].length, `${c.name} ${k}`).toBeGreaterThan(0);
      }
    }
  });

  test("% พลังงานบวก+ลบ = 100", () => {
    for (const c of getAllCards()) {
      const e = getSinsaeCard(c.no)!.core.energy!;
      expect(e.positive + e.negative, c.name).toBe(100);
    }
  });

  test("เดาหัวข้อจากคำถาม", () => {
    expect(topicOfQuestion("เดือนนี้การเงินเป็นยังไง")).toBe("finance");
    expect(topicOfQuestion("ควรลาออกจากงานไหม")).toBe("career");
    expect(topicOfQuestion("แฟนจะกลับมาไหม")).toBe("love");
    expect(topicOfQuestion("")).toBe("general");
  });

  test("บล็อก prompt ใช้หัวข้อตามคำถาม และใช้ความหมายกลับหัวเมื่อไพ่กลับหัว", () => {
    const fool = getAllCards()[0];
    const r = buildTarotReading([fool], "การเงินเดือนนี้", [true]);
    const block = sinsaeBlock(r.slots[0], "finance");
    expect(block).toContain("กลับหัว");
    expect(block).toContain(getSinsaeCard(fool.no)!.finance.slice(0, 40));
    expect(block).toContain(getSinsaeCard(fool.no)!.reversed.slice(0, 40));
  });
});
