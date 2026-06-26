import { describe, expect, it } from "vitest";

import { docToMarkdown, markdownToDoc } from "@/lib/bazi/reading-markdown";

/** normalize ผ่าน parse→serialize หนึ่งรอบ (parser รวมบรรทัดติดกัน serializer คืนหนึ่งบรรทัด/บล็อก) */
const norm = (md: string) => docToMarkdown(markdownToDoc(md));
/** idempotent: รอบสองต้องเท่ารอบแรก */
const roundTrip = (md: string) => docToMarkdown(markdownToDoc(norm(md)));

describe("reading-markdown round-trip", () => {
  const samples: Array<[string, string]> = [
    ["ย่อหน้าธรรมดา", "ดวงของคุณมีพื้นฐานแข็งแกร่ง"],
    ["หัวข้อย่อย", "## ภาพรวมชีวิต"],
    ["bullet", "- ข้อแรก\n- ข้อสอง"],
    ["ตัวหนา", "ปีนี้ **สำคัญมาก** สำหรับงาน"],
    ["เน้นแดง", "ช่วงนี้ ***ระวังสุขภาพ*** เป็นพิเศษ"],
    ["warn line", "*** ระวังเป็นพิเศษช่วงวัยจรนี้"],
    ["ย่อหน้าเยื้อง", "[[indent]] ดวงของคุณเริ่มต้นย่อหน้าใหม่ที่นี่"],
    ["ย่อหน้าเยื้อง + ตัวหนา", "[[indent]] ปีนี้ **สำคัญมาก** สำหรับงาน"],
    ["ช่องว่างนำหน้า (space bar)", "    ดวงของคุณเริ่มย่อหน้าด้วยช่องว่าง"],
    ["ขนาดตัวอักษร", "[[s=18]]ข้อความตัวใหญ่[[/s]] กับปกติ"],
    ["ขนาด + สี + หนา", "[[s=20]][[c=fire]]**ร้อนแรง**[[/c]][[/s]]"],
    ["pagebreak", "บทแรก\n\n[[pagebreak]]\n\nหน้าต่อไป"],
    ["สี palette", "ธาตุ [[c=fire]]ไฟ[[/c]] และ [[c=water]]น้ำ[[/c]]"],
    ["สี + หนา", "เน้น [[c=teal]]**สำคัญ**[[/c]] มาก"],
    ["สี hex ดิบ", "ลอง [[c=123abc]]สีแปลก[[/c]] ดู"],
    [
      "ผสมทุกอย่าง",
      "## การเงิน\n\nรายได้จะ **เพิ่มขึ้น** ในช่วงนี้\n\n- ลงทุนระยะยาว\n- ระวังหนี้สิน\n\n*** อย่าค้ำประกันใคร\n\n[[pagebreak]]\n\nสรุป ***ดวงดี*** มาก",
    ],
    ["กล่อง (box)", "[[box=หัวข้อย่อย]]\nเนื้อในกล่อง **เน้น** ได้\n[[/box]]"],
    [
      "กล่องหลายใบ + เนื้อในหลายบล็อก",
      "[[box=กล่องแรก]]\nย่อหน้าแรก\n\n- ข้อย่อย\n[[/box]]\n\n[[box=กล่องสอง]]\nเนื้อหา ***เตือน***\n[[/box]]",
    ],
  ];

  it.each(samples)("idempotent: %s", (_label, md) => {
    expect(roundTrip(md)).toBe(norm(md));
  });

  it("รวมบรรทัดติดกันเป็นย่อหน้าเดียว", () => {
    expect(norm("บรรทัดหนึ่ง\nบรรทัดสอง")).toBe("บรรทัดหนึ่ง บรรทัดสอง");
  });

  it("pagebreak รอด round-trip เป็น marker เดิม", () => {
    expect(norm("ก่อน\n\n[[pagebreak]]\n\nหลัง")).toContain("[[pagebreak]]");
  });

  it("warn line ขึ้นต้นด้วย *** เสมอ", () => {
    expect(norm("*** เตือน")).toBe("*** เตือน");
  });

  it("ย่อหน้าเยื้อง: marker → paragraph attrs.indent", () => {
    const doc = markdownToDoc("[[indent]] ขึ้นย่อหน้าใหม่");
    expect(doc.content[0].type).toBe("paragraph");
    expect(doc.content[0].attrs?.indent).toBe(true);
    // ตัด marker ออกจากเนื้อความ (ไม่ค้างใน text)
    expect(doc.content[0].content?.[0]?.text).toBe("ขึ้นย่อหน้าใหม่");
  });

  it("ย่อหน้าเยื้อง รอด round-trip เป็น marker เดิม", () => {
    expect(norm("[[indent]] ขึ้นย่อหน้าใหม่")).toBe("[[indent]] ขึ้นย่อหน้าใหม่");
  });

  it("ย่อหน้าธรรมดา (ไม่มี marker) ต้องไม่มี attrs.indent", () => {
    const doc = markdownToDoc("ย่อหน้าปกติ");
    expect(doc.content[0].attrs?.indent).toBeFalsy();
  });

  it("ช่องว่างนำหน้า (space bar) ไม่ถูกตัด — เก็บไว้ทั้งใน doc และ round-trip", () => {
    const doc = markdownToDoc("    เยื้องด้วยช่องว่าง");
    expect(doc.content[0].content?.[0]?.text).toBe("    เยื้องด้วยช่องว่าง");
    expect(norm("    เยื้องด้วยช่องว่าง")).toBe("    เยื้องด้วยช่องว่าง");
  });

  it("ขนาดตัวอักษร: [[s=18]] → textStyle.fontSize และ round-trip กลับ marker เดิม", () => {
    const doc = markdownToDoc("[[s=18]]ตัวใหญ่[[/s]]");
    const mark = doc.content[0].content?.[0]?.marks?.find((m) => m.type === "textStyle");
    expect(mark && "attrs" in mark ? mark.attrs.fontSize : null).toBe("18pt");
    expect(norm("[[s=18]]ตัวใหญ่[[/s]]")).toBe("[[s=18]]ตัวใหญ่[[/s]]");
  });

  it("กล่อง (box): [[box=หัวข้อ]] → node box + boxTitle (text node) + content ภายใน", () => {
    const doc = markdownToDoc("[[box=สิ่งพึงระวัง]]\nระวัง **สุขภาพ**\n- พักผ่อน\n[[/box]]");
    expect(doc.content[0].type).toBe("box");
    const children = doc.content[0].content ?? [];
    // หัวข้อ = boxTitle (ลูกตัวแรก) เป็น text node จริง แก้/ลบได้เหมือนข้อความ
    expect(children[0]?.type).toBe("boxTitle");
    expect(children[0]?.content?.[0]?.text).toBe("สิ่งพึงระวัง");
    const inner = children.slice(1);
    expect(inner[0]?.type).toBe("paragraph");
    expect(inner.some((n) => n.type === "bulletList")).toBe(true);
  });

  it("กล่อง (box) รอด round-trip เป็น marker เดิม", () => {
    const md = "[[box=หัวข้อย่อย]]\nเนื้อใน\n[[/box]]";
    expect(norm(md)).toContain("[[box=หัวข้อย่อย]]");
    expect(norm(md)).toContain("[[/box]]");
  });

  it("doc ว่างได้ paragraph เปล่าอย่างน้อยหนึ่ง", () => {
    const doc = markdownToDoc("");
    expect(doc.content.length).toBeGreaterThanOrEqual(1);
    expect(doc.content[0].type).toBe("paragraph");
  });
});
