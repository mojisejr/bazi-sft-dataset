// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Extension, Mark, Node } from "@tiptap/core";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { describe, expect, it } from "vitest";

import { docToMarkdown, markdownToDoc, type PMDoc } from "@/lib/bazi/reading-markdown";

/**
 * ยืนยันว่า schema ของ TipTap (StarterKit + custom red/warn/pageBreak) "ยอมรับ" JSON ที่
 * markdownToDoc ผลิต และ getJSON()→docToMarkdown คืน markdown เดิม — กัน node/mark หลุด schema
 * แล้วถูก TipTap ตัดทิ้งเงียบ ๆ (ความเสี่ยงที่ unit test ของ converter ล้วน ๆ จับไม่ได้)
 *
 * extensions ต้องตรงกับ ChapterEditor.tsx
 */
const RedMark = Mark.create({
  name: "red",
  parseHTML: () => [{ tag: "strong.ylc-warn" }],
  renderHTML: () => ["strong", { class: "ylc-warn" }, 0],
});
const PageBreakNode = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: "div[data-pagebreak]" }],
  renderHTML: () => ["div", { "data-pagebreak": "true" }, "— แบ่งหน้า —"],
});
const ParagraphWarn = Extension.create({
  name: "paragraphWarn",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          warn: {
            default: false,
            parseHTML: (el: HTMLElement) => el.classList.contains("ylc-warn-line"),
            renderHTML: (attrs: { warn?: boolean }) => (attrs.warn ? { class: "ylc-warn-line" } : {}),
          },
        },
      },
    ];
  },
});

function roundTripThroughEditor(md: string): string {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
      }),
      ParagraphWarn,
      RedMark,
      PageBreakNode,
      TextStyle,
      Color,
    ],
    content: markdownToDoc(md) as unknown as Record<string, unknown>,
  });
  const out = docToMarkdown(editor.getJSON() as unknown as PMDoc);
  editor.destroy();
  return out;
}

describe("ChapterEditor TipTap schema round-trip", () => {
  const samples: string[] = [
    "ดวงของคุณมีพื้นฐานแข็งแกร่ง",
    "## ภาพรวมชีวิต",
    "- ข้อแรก\n- ข้อสอง",
    "ปีนี้ **สำคัญมาก** สำหรับงาน",
    "ช่วงนี้ ***ระวังสุขภาพ*** เป็นพิเศษ",
    "*** ระวังเป็นพิเศษช่วงวัยจรนี้",
    "บทแรก\n\n[[pagebreak]]\n\nหน้าต่อไป",
    "## การเงิน\n\nรายได้จะ **เพิ่มขึ้น**\n\n- ลงทุน\n- ระวังหนี้\n\n*** อย่าค้ำประกัน\n\n[[pagebreak]]\n\nสรุป ***ดวงดี*** มาก",
    "ธาตุ [[c=fire]]ไฟ[[/c]] และ [[c=water]]น้ำ[[/c]]",
    "เน้น [[c=teal]]**สำคัญ**[[/c]] มาก",
  ];

  it.each(samples)("schema คงเนื้อหา: %s", (md) => {
    const expected = docToMarkdown(markdownToDoc(md));
    expect(roundTripThroughEditor(md)).toBe(expected);
  });
});
