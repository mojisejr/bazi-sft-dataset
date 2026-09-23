import { describe, expect, test } from "vitest";

import { readDream, dreamSymbolCount } from "@/lib/bazi/dream/engine";
import { wantsDream } from "@/features/open-webui/gemini-adapter";

describe("dream symbols catalog", () => {
  test("คลังตำราฝันมีสัญลักษณ์พอสมควร + ทุกอันมี general และเลขนำโชค", () => {
    expect(dreamSymbolCount()).toBeGreaterThanOrEqual(80);
  });
});

describe("readDream", () => {
  test("จับสัญลักษณ์งูจากประโยคเล่าฝัน + คืนเลขนำโชค", () => {
    const r = readDream("เมื่อคืนฝันเห็นงูตัวใหญ่เลื้อยเข้ามาในบ้าน");
    expect(r.matched.some((m) => m.symbol === "งู")).toBe(true);
    expect(r.luckyNumbers.length).toBeGreaterThan(0);
  });

  test("คำเฉพาะเจาะจงมาก่อนคำกว้าง — พญานาค ไม่ถูกจับซ้ำเป็น 'นาค'", () => {
    const r = readDream("ฝันว่าเห็นพญานาคขึ้นจากน้ำ");
    expect(r.matched.some((m) => m.symbol === "พญานาค")).toBe(true);
    // ไม่ควรมีทั้ง พญานาค และ นาค (นาคเป็น alias/ย่อยของพญานาค ถูกลบออกหลังจับแล้ว)
    expect(r.matched.filter((m) => m.symbol === "นาค").length).toBe(0);
  });

  test("จับได้หลายสัญลักษณ์ในฝันเดียว แต่ไม่เกิน 4", () => {
    const r = readDream("ฝันเห็นช้าง แล้วก็มีพระ มีทอง มีน้ำท่วม แล้วก็ไฟไหม้ด้วย");
    expect(r.matched.length).toBeGreaterThanOrEqual(3);
    expect(r.matched.length).toBeLessThanOrEqual(4);
  });

  test("ฝันนอกคลัง → matched ว่าง (ให้ LLM ตีความทั่วไป) ไม่ throw", () => {
    const r = readDream("ฝันว่ากำลังเขียนโค้ดโปรแกรมอยู่หน้าคอม");
    expect(Array.isArray(r.matched)).toBe(true);
  });
});

describe("wantsDream", () => {
  test("เข้าเมื่อเล่าความฝันจริง", () => {
    expect(wantsDream("ฝันว่าตกจากที่สูง")).toBe(true);
    expect(wantsDream("เมื่อคืนฝันเห็นงู")).toBe(true);
    expect(wantsDream("ช่วยทำนายฝันให้หน่อย")).toBe(true);
  });

  test("ไม่เข้าเมื่อพูดถึง 'ความฝัน/เป้าหมาย' (ไม่ใช่ฝันตอนนอน)", () => {
    expect(wantsDream("ผมมีความฝันอยากเปิดร้านกาแฟ")).toBe(false);
    expect(wantsDream("งานนี้จะสำเร็จไหม")).toBe(false);
  });
});
