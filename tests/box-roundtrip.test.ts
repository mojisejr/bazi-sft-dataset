import { describe, it, expect } from "vitest";
import { docToMarkdown, markdownToDoc } from "@/lib/bazi/reading-markdown";

describe("box title as real node roundtrip", () => {
  it("md -> doc -> md preserves box title + body", () => {
    const md = "[[box=ภาพรวม]]\nเนื้อหา ก\n[[/box]]\n\n[[box=อันดับ 2]]\n\n[[/box]]";
    const doc = markdownToDoc(md);
    // box should have boxTitle as first child
    expect(doc.content[0].type).toBe("box");
    expect(doc.content[0].content?.[0].type).toBe("boxTitle");
    expect(doc.content[0].content?.[0].content?.[0].text).toBe("ภาพรวม");
    const back = docToMarkdown(doc);
    console.log("BACK:", JSON.stringify(back));
    expect(back).toContain("[[box=ภาพรวม]]");
    expect(back).toContain("[[box=อันดับ 2]]");
    expect(back).toContain("เนื้อหา ก");
  });
  it("edited title reflects in markdown", () => {
    const doc = markdownToDoc("[[box=เก่า]]\nบอดี้\n[[/box]]");
    // simulate edit: change boxTitle text
    doc.content[0].content![0].content = [{ type: "text", text: "ดิถีกำลังอ่อนมาก" }];
    const back = docToMarkdown(doc);
    console.log("EDITED:", JSON.stringify(back));
    expect(back).toContain("[[box=ดิถีกำลังอ่อนมาก]]");
  });
});
