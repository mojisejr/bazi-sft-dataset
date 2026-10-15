import { describe, expect, test } from "vitest";

import { siamsiAnswerBlock } from "@/features/open-webui/card-blocks";
import { wantsFengshui, wantsGuidance, wantsSpecificPersonLove } from "@/features/open-webui/gemini-adapter";
import { drawOne, drawRandom, getAllCards } from "@/lib/bazi/siamsi-kiangkung/deck";
import { buildSiamsiMultiReading, buildSiamsiReading } from "@/lib/bazi/siamsi-kiangkung/reading-engine";

// ซินแสนุ้ย 2026-10-15: เซียมซีเคี้ยงคุง 80 ใบ = การชี้แนะ แผนงาน การตัดสินใจ ขอความเห็น (เรื่องเจาะจง) → แชทตอบจากเซียมซี
describe("wantsGuidance — คำถามชี้แนะ/ตัดสินใจเรื่องเจาะจง", () => {
  test.each([
    "ควรลาออกจากงานไหม",
    "ควรรับงานนี้ไหมคะ",
    "แผนเปิดร้านกาแฟของผมดีไหม",
    "ขอความเห็นเรื่องเปลี่ยนสายงานหน่อย",
    "เลือกงานที่ A หรือ B ดีครับ",
    "ระหว่างเรียนต่อกับทำงานเลย อันไหนดีกว่า",
    "ถ้าลงทุนเพิ่มอีกรอบจะดีไหม",
    "โปรเจกต์นี้ควรไปต่อหรือพอ",
    "ขอคำแนะนำเรื่องจะขยายธุรกิจ",
    "ช่วยตัดสินใจหน่อย จะรับข้อเสนองานใหม่ดีไหม",
    "ควรคุยกับหุ้นส่วนเรื่องแบ่งกำไรตอนนี้ไหม",
  ])("จับ: %s", (q) => {
    expect(wantsGuidance(q)).toBe(true);
  });

  test.each([
    "ช่วงนี้ดวงเป็นยังไง",
    "วันนี้ดีไหม",
    "ช่วงนี้ควรทำอะไร",
    "ตัดสินใจยังไงดี",
    "เอายังไงดี",
    "ดวงการเงินปีนี้",
    "วันนี้ควรใส่เสื้อสีอะไร",
    "ควรไปทิศไหน",
    "สวัสดีครับ",
    "ฉันเป็นคนธาตุอะไร",
    "เบอร์นี้ดีไหม 0812345678",
  ])("ไม่จับ (ให้ดวงปาจื่อ/โหมดอื่นตอบ): %s", (q) => {
    expect(wantsGuidance(q)).toBe(false);
  });

  test("สถานที่ยังเป็นฮวงจุ้ย · ความรักเจาะจงคนยังเป็นดวง+ทาโรต์ (route เช็กก่อน wantsGuidance)", () => {
    expect(wantsFengshui("ควรย้ายบ้านไปฝั่งตะวันตกไหม")).toBe(true);
    expect(wantsSpecificPersonLove("ควรสารภาพกับคนนี้ไหม เขาชอบเราไหม")).toBe(true);
  });
});

describe("siamsi 80 ใบ — รูป + บล็อกตอบ", () => {
  test("ทุกใบมีรูปบน Supabase bucket siamsi-cards", () => {
    const cards = getAllCards();
    expect(cards.length).toBe(80);
    for (const c of cards) expect(c.imageUrl, `#${c.no}`).toMatch(/\/siamsi-cards\/cards\/\d+\.jpg$/);
  });

  test("จั่วด้วย seed = ผลคงที่", () => {
    expect(drawOne(42).no).toBe(drawOne(42).no);
  });

  test("บล็อกแชท: ไม่มีชื่อ/เลขไพ่ และสั่งห้ามเอ่ยคำว่าไพ่", () => {
    const card = drawOne(7);
    const block = siamsiAnswerBlock(buildSiamsiReading(card, "ควรลาออกไหม").chatProse, "ขอทำนาย");
    expect(block).not.toContain(card.name);
    expect(block).not.toContain(`#${card.no}`);
    expect(block).toContain(card.advice.slice(0, 20));
    expect(block).toContain("ห้ามบอกชื่อไพ่");
    expect(block).toContain("ขอทำนาย");
  });
});

// หลังบ้าน: สุ่ม 1 หรือ 3 ใบแบบไพ่ฮวงจุ้ย (เอ็ม 2026-10-15)
describe("siamsi หลายใบ (หลังบ้าน 1|3 ใบ)", () => {
  test("drawRandom 3 ใบไม่ซ้ำ + seed คงที่", () => {
    const a = drawRandom(3, 99);
    expect(new Set(a.map((c) => c.no)).size).toBe(3);
    expect(drawRandom(3, 99).map((c) => c.no)).toEqual(a.map((c) => c.no));
  });

  test("3 ใบ: chatProse เรียก มุมที่ 1-3 ไม่มีชื่อ/เลขไพ่ · engineProse มีชื่อครบ", () => {
    const cards = drawRandom(3, 5);
    const r = buildSiamsiMultiReading(cards, "ควรขยายสาขาไหม");
    const body = cards.map((c) => [c.situation, c.caution, c.advice].join(" ")).join(" ");
    for (const c of cards) {
      // ชื่อไพ่บางใบเป็นวลีที่อยู่ในเนื้อความไพ่เองด้วย (เช่น ความสุขเรียบง่าย) — ข้ามกรณีนั้น
      if (!body.includes(c.name)) expect(r.chatProse).not.toContain(c.name);
      expect(r.engineProse).toContain(c.name);
    }
    expect(r.chatProse).toContain("มุมที่ 1 (แกนหลักของเรื่อง)");
    expect(r.chatProse).toContain("มุมที่ 3");
  });

  test("1 ใบ = เหมือน buildSiamsiReading เดิม", () => {
    const c = drawOne(3);
    expect(buildSiamsiMultiReading([c], "q").chatProse).toBe(buildSiamsiReading(c, "q").chatProse);
  });

  test("บล็อกตอบ 3 ใบ: บอกจำนวน + ร้อยเป็นเรื่องเดียว · 1 ใบไม่เปลี่ยน", () => {
    const three = siamsiAnswerBlock("x", "ขอทำนาย", undefined, 3);
    expect(three).toContain("มาให้ 3 ใบแล้ว");
    expect(three).toContain("มุมที่ 1 เป็นแกนหลัก");
    expect(three).not.toContain("มาให้ 1 ใบแล้ว");
    expect(siamsiAnswerBlock("x", "ขอทำนาย")).toContain("มาให้ 1 ใบแล้ว");
  });
});
