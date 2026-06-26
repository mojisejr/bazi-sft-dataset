"use client";

import { useEffect, useRef, useState } from "react";
import { Extension, Mark, mergeAttributes, Node } from "@tiptap/core";
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

/**
 * หัวข้อกล่อง (boxTitle) = ลูกตัวแรกของกล่อง เป็น "text node จริง" → ซินแสคลิกพิมพ์ทับ/ลบได้เหมือนข้อความ
 * แก้แล้ว propagate ผ่าน onUpdate ปกติ (ไม่ต้อง sync attr เอง) และลบตัวอักษรไม่ทำให้ทั้งกล่องหาย
 */
const BoxTitle = Node.create({
  name: "boxTitle",
  content: "inline*",
  defining: true,
  selectable: false,
  parseHTML() {
    return [{ tag: "div.ylc-box__title" }];
  },
  renderHTML() {
    return ["div", { class: "ylc-box__title" }, 0];
  },
});

/**
 * กล่อง (box) แยกตามหัวข้อย่อย = [[box=หัวข้อ]]...[[/box]] — render เป็น <section class="ylc-box">
 * content = "boxTitle block+" : หัวข้อ (แก้ได้) ตามด้วยเนื้อในอย่างน้อย 1 ย่อหน้า
 */
const BoxNode = Node.create({
  name: "box",
  group: "block",
  content: "boxTitle block+",
  defining: true,
  parseHTML() {
    return [{ tag: "section[data-box]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes(HTMLAttributes, { "data-box": "true", class: "ylc-box" }), 0];
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
      BoxTitle,
      BoxNode,
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
    // กำลังพิมพ์อยู่ (editor โฟกัส) → อย่า setContent ทับ ไม่งั้น cursor เด้งไปท้าย:
    // value ที่ไหลกลับมาผ่าน roundtrip ฝั่ง parent (parse→serialize) อาจไม่ "เท่าเป๊ะ" กับที่เรา emit
    // สลับบทใช้ key remount อยู่แล้ว ส่วน gen ภายนอกเกิดตอนไม่โฟกัส → ปลอดภัยที่จะข้ามตอนโฟกัส
    // ครอบรวมช่องหัวข้อกล่อง (<input> ใน nodeView) ด้วย — โฟกัสอยู่ที่ input ตัว editor จะ isFocused=false
    const active = typeof document !== "undefined" ? document.activeElement : null;
    if (editor.isFocused || (active && editor.view.dom.contains(active))) return;
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
        <span className="ylc-editor__sep" aria-hidden="true" />
        <button
          type="button"
          title="แทรกหัวข้อ “บทนำ” (ส่วนเปิดบทแบบมีสไตล์)"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent([
                { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "บทนำ" }] },
                { type: "paragraph" },
              ])
              .run()
          }
        >
          + บทนำ
        </button>
        <button
          type="button"
          title="แทรกหัวข้อ “สรุป” (ส่วนปิดบทแบบมีสไตล์)"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent([
                { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "สรุป" }] },
                { type: "paragraph" },
              ])
              .run()
          }
        >
          + สรุป
        </button>
        <button
          type="button"
          title="เพิ่มกล่องใหญ่ (หัวข้อย่อย)"
          onClick={() => {
            const title = window.prompt("ชื่อหัวข้อกล่อง", "")?.trim();
            if (title === undefined) return;
            editor
              .chain()
              .focus()
              .insertContent({
                type: "box",
                content: [
                  { type: "boxTitle", ...(title ? { content: [{ type: "text", text: title }] } : {}) },
                  { type: "paragraph" },
                ],
              })
              .run();
          }}
        >
          + กล่อง
        </button>
        <button
          type="button"
          title="เพิ่มกล่องย่อย (วางเคอร์เซอร์ในกล่องใหญ่ก่อน)"
          onClick={() => {
            const title = window.prompt("ชื่อกล่องย่อย", "")?.trim();
            if (title === undefined) return;
            editor
              .chain()
              .focus()
              .insertContent({
                type: "box",
                content: [
                  { type: "boxTitle", ...(title ? { content: [{ type: "text", text: title }] } : {}) },
                  { type: "paragraph" },
                ],
              })
              .run();
          }}
        >
          + กล่องย่อย
        </button>
        <button
          type="button"
          title="ลบกล่องที่เคอร์เซอร์อยู่"
          disabled={!editor.isActive("box")}
          onClick={() => editor.chain().focus().deleteNode("box").run()}
        >
          ลบกล่อง
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
