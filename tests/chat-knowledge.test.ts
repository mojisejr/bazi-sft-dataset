import { describe, expect, test } from "vitest";

import { retrieveChatKnowledge, chatKnowledgeCount } from "@/lib/bazi/chat-knowledge/retrieve";

describe("chat knowledge (ความรู้ซินแสในแชท — ซินแสนุ้ย 2026-09-23)", () => {
  test("คลังมีบทความพอสมควร (ฮวงจุ้ย+ประเพณี+วิชาการ)", () => {
    expect(chatKnowledgeCount()).toBeGreaterThanOrEqual(80);
  });

  test("ดึงบทความที่ตรงคำถามเชิงวิชาการ (คำถามสั้น)", () => {
    const r = retrieveChatKnowledge("ปีชงคืออะไร");
    expect(r).toBeTruthy();
    expect(r).toContain("ปีชง");
  });

  test("ดึงบทความฮวงจุ้ยที่ตรง", () => {
    const r = retrieveChatKnowledge("ปลายเตียงวางของได้ไหม");
    expect(r).toBeTruthy();
    expect(r).toContain("ปลายเตียง");
  });

  test("ดึงบทความประเพณี/เทศกาล", () => {
    expect(retrieveChatKnowledge("เทศกาลไหว้พระจันทร์")).toContain("พระจันทร์");
    expect(retrieveChatKnowledge("สารทจีนคืออะไร")).toContain("สารทจีน");
  });

  test("คำถามไม่เกี่ยว/ทักทาย → ไม่แนบความรู้ (null)", () => {
    expect(retrieveChatKnowledge("สวัสดีครับ")).toBeNull();
    expect(retrieveChatKnowledge("หิวข้าวจัง")).toBeNull();
    expect(retrieveChatKnowledge("เมื่อยขาทำไง")).toBeNull();
    expect(retrieveChatKnowledge("วันนี้อากาศดี")).toBeNull();
  });

  test("บทความยาวถูกตัดไม่ให้ prompt บวม (<= ~4600 ตัวอักษร)", () => {
    const r = retrieveChatKnowledge("กุ้ยนั้งคือใคร");
    expect(r).toBeTruthy();
    expect((r ?? "").length).toBeLessThanOrEqual(4600);
  });
});
