import { describe, expect, test } from "vitest";

import { siamsiAnswerBlock } from "@/features/open-webui/card-blocks";
import { wantsFengshui, wantsGuidance, wantsSpecificPersonLove } from "@/features/open-webui/gemini-adapter";
import { drawOne, getAllCards } from "@/lib/bazi/siamsi-kiangkung/deck";
import { buildSiamsiReading } from "@/lib/bazi/siamsi-kiangkung/reading-engine";

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
