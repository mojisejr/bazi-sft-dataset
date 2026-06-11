"use client";

import { useEffect, useRef, useState } from "react";
import { Extension, Mark, Node } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";

import { docToMarkdown, markdownToDoc, type PMDoc } from "@/lib/bazi/reading-markdown";
import { READING_COLORS } from "@/lib/bazi/reading-colors";

/**
 * ตัวแก้ WYSIWYG แบบ Word (TipTap) สำหรับหนึ่งบท — แก้ข้อความ/หัวข้อ/bullet/เน้นแดง/แบ่งหน้า
 * เก็บผลกลับเป็น markdown subset เดิม (reading-markdown.ts) → paged.js (PDF) + docx lib ใช้ต่อได้
 * ใช้ CSS A4 (.ylc-prose) เดียวกับ output PDF เพื่อให้ "แก้ที่ไหน เห็นหน้าตรงนั้น"
 */

/** mark เน้นแดง = ***...*** (หนา+แดง) — render เป็น <strong class="ylc-warn"> ให้ตรงกับ PDF */
const RedMark = Mark.create({
  name: "red",
  parseHTML() {
    return [{ tag: "strong.ylc-warn" }];
  },
  renderHTML() {
    return ["strong", { class: "ylc-warn" }, 0];
  },
});

/** node แบ่งหน้า manual = [[pagebreak]] — atom block แสดงเป็นเส้นปะ "แบ่งหน้า" บนจอแก้ */
const PageBreakNode = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "div[data-pagebreak]" }];
  },
  renderHTML() {
    return ["div", { "data-pagebreak": "true", class: "ylc-edit-pagebreak", contenteditable: "false" }, "— แบ่งหน้า —"];
  },
});

/** เพิ่ม attr "warn" ให้ paragraph (บรรทัดเตือนสีแดงทั้งบรรทัด = *** ...) โดยไม่ต้อง redefine node */
const ParagraphWarn = Extension.create({
  name: "paragraphWarn",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          warn: {
            default: false,
            parseHTML: (el) => el.classList.contains("ylc-warn-line"),
            renderHTML: (attrs) => (attrs.warn ? { class: "ylc-warn-line" } : {}),
          },
        },
      },
    ];
  },
});

/** เพิ่ม attr "indent" ให้ paragraph (เยื้องบรรทัดแรก = [[indent]] ...) — สลับด้วยปุ่ม "ย่อหน้า" */
const ParagraphIndent = Extension.create({
  name: "paragraphIndent",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          indent: {
            default: false,
            parseHTML: (el) => el.classList.contains("ylc-indent"),
            renderHTML: (attrs) => (attrs.indent ? { class: "ylc-indent" } : {}),
          },
        },
      },
    ];
  },
});

/** เพิ่ม attr "fontSize" ให้ textStyle mark (ขนาดตัวอักษรต่อข้อความ = [[s=PT]] ...) — ปรับด้วยปุ่ม ก+/ก− */
const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => el.style.fontSize || null,
            renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {}),
          },
        },
      },
    ];
  },
});

/** ขนาดตัวอักษรเนื้อหา (pt) ที่ถือว่า "ปกติ" — เท่ากับ .ylc-prose body (14.5pt ปัดเป็น 15) */
const BASE_FONT_PT = 15;

export type ChapterEditorProps = {
  /** ข้อความ markdown เริ่มต้นของบท */
  value: string;
  /** คืน markdown ใหม่ (debounced) เมื่อผู้ใช้แก้ */
  onChange: (markdown: string) => void;
  /** ปิดการแก้ (เช่น กำลังบันทึก) */
  disabled?: boolean;
};

export function ChapterEditor({ value, onChange, disabled }: ChapterEditorProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // markdown ล่าสุดที่ "เรา" emit ออกไป — ใช้กัน feedback loop: ถ้า value ที่ไหลกลับมา === ตัวนี้
  // แปลว่าเป็น echo ของการพิมพ์เราเอง อย่า setContent ทับ (ไม่งั้นตัวอักษรหาย/เคอร์เซอร์เด้ง)
  const lastEmittedRef = useRef<string | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "editing" | "saved">("idle");

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        // เหลือเฉพาะ subset ที่ markdown เดิมรองรับ — กัน editor สร้าง markup ที่ docx/paged แปลงไม่ได้
        heading: { levels: [2] },
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
      }),
      ParagraphWarn,
      ParagraphIndent,
      RedMark,
      PageBreakNode,
      TextStyle,
      Color,
      FontSize,
    ],
    content: markdownToDoc(value) as unknown as PMDoc,
    onUpdate: ({ editor: ed }) => {
      setStatus("editing");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const json = ed.getJSON() as unknown as PMDoc;
      debounceRef.current = setTimeout(() => {
        const md = docToMarkdown(json);
        lastEmittedRef.current = md; // mark ก่อน emit เพื่อให้ sync effect รู้ว่าเป็น echo ของเรา
        onChangeRef.current(md);
        setStatus("saved");
      }, 400);
    },
  });

  // sync ค่าใหม่จากภายนอก (เช่น สลับบท / LLM gen) โดยไม่ทับระหว่างพิมพ์
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedRef.current) return; // echo ของการพิมพ์เราเอง — อย่าทับ
    const current = docToMarkdown(editor.getJSON() as unknown as PMDoc);
    if (current !== value) {
      editor.commands.setContent(markdownToDoc(value) as unknown as PMDoc, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!editor) return null;

  return (
    <div className="ylc-editor">
      <div className="ylc-editor__toolbar">
        <button
          type="button"
          className={editor.isActive("bold") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          ตัวหนา
        </button>
        <button
          type="button"
          className={editor.isActive("red") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleMark("red").run()}
        >
          เน้นแดง
        </button>
        <button
          type="button"
          className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          หัวข้อ
        </button>
        <button
          type="button"
          className={editor.isActive("paragraph", { indent: true }) ? "is-active" : ""}
          onClick={() =>
            editor
              .chain()
              .focus()
              .updateAttributes("paragraph", { indent: !editor.isActive("paragraph", { indent: true }) })
              .run()
          }
        >
          ย่อหน้า
        </button>
        <button
          type="button"
          className={editor.isActive("bulletList") ? "is-active" : ""}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          รายการ
        </button>
        <button
          type="button"
          className={editor.isActive("paragraph", { warn: true }) ? "is-active" : ""}
          onClick={() =>
            editor
              .chain()
              .focus()
              .updateAttributes("paragraph", { warn: !editor.isActive("paragraph", { warn: true }) })
              .run()
          }
        >
          บรรทัดเตือน
        </button>
        <div className="ylc-editor__colorwrap">
          <button
            type="button"
            className={editor.isActive("textStyle") ? "is-active" : ""}
            onClick={() => setColorOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={colorOpen}
          >
            สี
          </button>
          {colorOpen ? (
            <div className="ylc-editor__colormenu" role="menu">
              {READING_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  role="menuitem"
                  className="ylc-editor__swatch"
                  title={c.label}
                  onClick={() => {
                    editor.chain().focus().setColor(c.hex).run();
                    setColorOpen(false);
                  }}
                >
                  <span style={{ background: c.hex }} aria-hidden="true" />
                  {c.label}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                className="ylc-editor__swatch ylc-editor__swatch--clear"
                onClick={() => {
                  editor.chain().focus().unsetColor().run();
                  setColorOpen(false);
                }}
              >
                ล้างสี
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          title="เพิ่มขนาดตัวอักษรของข้อความที่เลือก"
          onClick={() => {
            const cur = editor.getAttributes("textStyle");
            const n = Math.min(40, Math.round(parseFloat(cur.fontSize) || BASE_FONT_PT) + 1);
            editor
              .chain()
              .focus()
              .setMark("textStyle", { ...cur, fontSize: n === BASE_FONT_PT ? null : `${n}pt` })
              .run();
          }}
        >
          ก+
        </button>
        <button
          type="button"
          title="ลดขนาดตัวอักษรของข้อความที่เลือก"
          onClick={() => {
            const cur = editor.getAttributes("textStyle");
            const n = Math.max(9, Math.round(parseFloat(cur.fontSize) || BASE_FONT_PT) - 1);
            editor
              .chain()
              .focus()
              .setMark("textStyle", { ...cur, fontSize: n === BASE_FONT_PT ? null : `${n}pt` })
              .run();
          }}
        >
          ก−
        </button>
        <button type="button" onClick={() => editor.chain().focus().insertContent({ type: "pageBreak" }).run()}>
          แบ่งหน้า
        </button>
        {status !== "idle" ? (
          <span className={`ylc-editor__status ylc-editor__status--${status}`}>
            {status === "editing" ? "กำลังพิมพ์…" : "บันทึกแล้ว"}
          </span>
        ) : null}
      </div>
      <EditorContent editor={editor} className="ylc-editor__surface ylc-prose" />
    </div>
  );
}
