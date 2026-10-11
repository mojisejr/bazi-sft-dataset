import { describe, expect, test } from "vitest";

import { wantsFengshui, wantsSiamsi } from "@/features/open-webui/gemini-adapter";
import { buildTarotChatReading } from "@/lib/bazi/tarot/chat-reading";

// ซินแสนุ้ย 2026-10-07: แชทเหลือ 3 ไพ่ — ทาโรต์ (ทั่วไปที่ไม่ใช่ดวง) · ฮวงจุ้ย (สถานที่) · เซียมซี (ขอตรง ๆ)
describe("wantsSiamsi", () => {
  test.each([
    ["ขอเซียมซีหน่อย", true],
    ["เสี่ยงทายให้หน่อย", true],
    ["ขอเปิดไพ่หน่อย", false], // เปิดไพ่ทั่วไป → ทาโรต์
    ["ของหายจะได้คืนไหม", false],
  ])("%s -> %s", (q, expected) => expect(wantsSiamsi(q)).toBe(expected));

  test("สถานที่ + เซียมซี: ฮวงจุ้ยยังจับสถานที่ (route ให้ฮวงจุ้ยก่อนเซียมซี)", () => {
    expect(wantsFengshui("ห้องนอนนี้ดีไหม")).toBe(true);
  });
});

describe("buildTarotChatReading", () => {
  const q = "งานนี้จะได้ไหม";
  const r = buildTarotChatReading(q, 12345);

  test("จั่ว 3 ใบไม่ซ้ำ + seed เดิม = ไพ่เดิม", () => {
    expect(r.cardNos).toHaveLength(3);
    expect(new Set(r.cardNos).size).toBe(3);
    expect(buildTarotChatReading(q, 12345).cardNos).toEqual(r.cardNos);
  });

  test("ถ่วงน้ำหนัก 50/30/20 อยู่ในข้อความ และไม่มีเลขไพ่หลุดให้ LLM", () => {
    expect(r.chatProse).toContain("ใบหลัก · น้ำหนัก 50%");
    expect(r.chatProse).toContain("ใบรอง · น้ำหนัก 30%");
    expect(r.chatProse).toContain("ใบเสริม · น้ำหนัก 20%");
    expect(r.chatProse).not.toMatch(/ไพ่ใบที่|\bNo\.?\s*\d+/);
  });

  test("ไม่ใส่ชื่อไพ่ (ซ่อนชื่อเหมือนเซียมซี/ฮวงจุ้ย)", async () => {
    const { getAllCards } = await import("@/lib/bazi/tarot/deck");
    const names = r.cardNos.map((no) => getAllCards().find((c) => c.no === no)?.name).filter(Boolean) as string[];
    for (const n of names) expect(r.chatProse).not.toContain(n.split("—")[0].trim());
  });

  test("หัวข้อตามคำถาม: คำถามการเงินดึงหัวข้อ 'การเงิน' ของตำราซินแส", () => {
    expect(buildTarotChatReading("เดือนนี้การเงินจะดีขึ้นไหม", 777).chatProse).toContain("เรื่องการเงิน");
  });
});

describe("answer blocks (แชท + หลังบ้านใช้สูตรเดียวกัน)", () => {
  test("ฮวงจุ้ย: จั่ว 1 ใบ → ข้อความไม่ยัด '3 จุด'", async () => {
    const { fengshuiAnswerBlock } = await import("@/features/open-webui/card-blocks");
    expect(fengshuiAnswerBlock("จุดที่ 1: x", "เสี่ยงทาย", 3)).toContain("3 จุด");
    const one = fengshuiAnswerBlock("จุดที่ 1: x", "เสี่ยงทาย", 1);
    expect(one).not.toContain("3 จุด");
    expect(one).toContain("1 จุด");
  });

  test("ทาโรต์: บล็อกคำสั่งมีน้ำหนัก 50/30/20 กติกาซ่อนชื่อไพ่ + คำเปิดทำนาย", async () => {
    const { tarotAnswerBlock } = await import("@/features/open-webui/card-blocks");
    const b = tarotAnswerBlock("ข้อมูลไพ่", "ขอเพ่งจิต");
    expect(b).toContain("ข้อมูลไพ่");
    expect(b).toContain("ขอเพ่งจิต");
    expect(b).toContain("ห้ามบอกชื่อไพ่");
  });
});
