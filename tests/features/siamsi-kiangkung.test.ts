import { describe, expect, test } from "vitest";

import { drawOne, getAllCards, getCardByNo } from "@/lib/bazi/siamsi-kiangkung/deck";
import { buildSiamsiReading } from "@/lib/bazi/siamsi-kiangkung/reading-engine";

describe("ไพ่เซียมซีเคี้ยงคุง deck", () => {
  test("โหลดครบ 80 ใบ เลขไม่ซ้ำ + ทุกใบมี name/theme/situation", () => {
    const cards = getAllCards();
    expect(cards).toHaveLength(80);
    const nos = new Set(cards.map((c) => c.no));
    expect(nos.size).toBe(80);
    for (const c of cards) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.theme.length).toBeGreaterThan(0);
      expect(c.situation.length).toBeGreaterThan(0);
    }
  });

  test("getCardByNo คืนใบที่ถูก", () => {
    const first = getCardByNo(1);
    expect(first?.no).toBe(1);
    expect(getCardByNo(999)).toBeUndefined();
  });

  test("drawOne(seed) reproducible + อยู่ในสำรับ", () => {
    const a = drawOne(42);
    const b = drawOne(42);
    expect(a.no).toBe(b.no);
    expect(getCardByNo(a.no)).toBeDefined();
  });

  test("buildSiamsiReading ประกอบเนื้อไพ่ (ชื่อ/สถานการณ์/ข้อควรระวัง/คำแนะนำ) + คำถาม", () => {
    const card = getCardByNo(1)!;
    const reading = buildSiamsiReading(card, "รถมีสิ่งไม่ดีตามมาไหม");
    expect(reading.card.no).toBe(1);
    expect(reading.engineProse).toContain(card.name);
    expect(reading.engineProse).toContain("สถานการณ์");
    expect(reading.engineProse).toContain("คำถามที่ถาม: รถมีสิ่งไม่ดีตามมาไหม");
  });

  test("chatProse บังวิชา — ไม่มีชื่อ/เลขไพ่ แต่คงใจความ + คำถาม (เอ็ม 2026-09-23)", () => {
    const card = getCardByNo(1)!;
    const reading = buildSiamsiReading(card, "รถมีสิ่งไม่ดีตามมาไหม");
    expect(reading.chatProse).not.toContain(card.name);
    expect(reading.chatProse).not.toContain(`#${card.no}`);
    expect(reading.chatProse).not.toContain("ไพ่ที่จั่วได้");
    expect(reading.chatProse).toContain(card.situation); // ใจความยังอยู่
    expect(reading.chatProse).toContain("คำถามที่ถาม: รถมีสิ่งไม่ดีตามมาไหม");
  });
});
