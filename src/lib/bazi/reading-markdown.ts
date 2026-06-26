/**
 * ตัวแปลง markdown ย่อ (subset เดียวกับ reading-docx.ts / ReadingPrintDocument.tsx) ↔ ProseMirror/TipTap JSON
 *
 * subset ที่รองรับ (ต้องตรงกับ parser เดิมทุกที่ มิฉะนั้น PDF/Word เพี้ยน):
 *  - `## หัวข้อย่อย`        → heading (level 2)
 *  - `- bullet`            → bulletList / listItem
 *  - บรรทัดขึ้นต้น `***`   → warn line (ทั้งบรรทัดสีแดง) = paragraph attrs.warn
 *  - inline `***เน้นแดง***` → mark red, `**ตัวหนา**` → mark bold
 *  - บรรทัดว่าง            → ตัดย่อหน้า (บรรทัดติดกัน join ด้วย " ")
 *  - `[[pagebreak]]`       → node pageBreak (แบ่งหน้า manual)
 *
 * round-trip เป็น idempotent: serialize(parse(serialize(parse(x)))) === serialize(parse(x))
 * (parser รวมบรรทัดติดกันเป็นย่อหน้าเดียว serializer คืนหนึ่งบรรทัดต่อย่อหน้า)
 */

import { tokenizeInline } from "@/lib/bazi/reading-inline";
import { colorToToken } from "@/lib/bazi/reading-colors";

export const PAGEBREAK_MARKER = "[[pagebreak]]";
/** marker นำหน้าบรรทัดแรกของย่อหน้าที่เยื้องบรรทัดแรก (ต้องตรงกับ ReadingPrintDocument / reading-docx) */
export const INDENT_MARKER = "[[indent]]";
/** กล่อง (box) แยกตามหัวข้อย่อย: บรรทัดเปิด `[[box=หัวข้อ]]` ... บรรทัดปิด `[[/box]]` (block-level, ซ้อนกันได้) */
export const BOX_OPEN_RE = /^\[\[box=(.*)\]\]$/;
export const BOX_CLOSE_MARKER = "[[/box]]";

/** mark ของ ProseMirror/TipTap: bold/red ไม่มี attrs; textStyle เก็บสีใน attrs.color */
export type PMMark =
  | { type: "bold" | "red" }
  | { type: "textStyle"; attrs: { color?: string; fontSize?: string } };
export type PMNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  marks?: PMMark[];
  text?: string;
};
export type PMDoc = { type: "doc"; content: PMNode[] };

/* ── markdown → ProseMirror JSON ─────────────────────────────────────────── */

function pushText(out: PMNode[], text: string, marks: PMMark[]): void {
  if (!text) return;
  out.push(marks.length ? { type: "text", text, marks } : { type: "text", text });
}

/**
 * inline → ProseMirror text nodes — ใช้ tokenizer กลาง (reading-inline) ตัวเดียวกับ PDF/docx
 * map run: สี → textStyle{color} (+bold ถ้ามี), red(`***`) → red mark, bold(`**`) → bold mark
 */
function parseInline(text: string): PMNode[] {
  const out: PMNode[] = [];
  for (const r of tokenizeInline(text)) {
    if (r.color || r.fontSize) {
      const attrs: { color?: string; fontSize?: string } = {};
      if (r.color) attrs.color = r.color;
      if (r.fontSize) attrs.fontSize = r.fontSize;
      const marks: PMMark[] = [{ type: "textStyle", attrs }];
      // ภายใน span สี red ยุบเป็นหนาแล้ว → red จริงมีได้เฉพาะตอนไม่มีสี (เช่น [[s=]]***...***)
      if (!r.color && r.red) marks.push({ type: "red" });
      else if (r.bold) marks.push({ type: "bold" });
      pushText(out, r.text, marks);
    } else if (r.red) {
      pushText(out, r.text, [{ type: "red" }]);
    } else if (r.bold) {
      pushText(out, r.text, [{ type: "bold" }]);
    } else {
      pushText(out, r.text, []);
    }
  }
  return out;
}

/** แปลง markdown string → PMDoc (mirror loop ของ renderMarkdown ใน ReadingPrintDocument) */
export function markdownToDoc(text: string): PMDoc {
  const lines = (text ?? "").replace(/\r/g, "").split("\n");
  const content: PMNode[] = [];
  let para: string[] = [];
  let paraIndent = false;
  let list: PMNode[] = [];

  const flushPara = () => {
    if (para.length) {
      content.push({
        type: "paragraph",
        ...(paraIndent ? { attrs: { indent: true } } : {}),
        content: parseInline(para.join(" ")),
      });
      para = [];
      paraIndent = false;
    }
  };
  const flushList = () => {
    if (list.length) {
      content.push({ type: "bulletList", content: list });
      list = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    // กล่อง (box): เก็บบรรทัดในจนถึง [[/box]] ที่จับคู่ (รองรับกล่องซ้อน) แล้ว parse ภายในซ้ำ
    const boxOpen = line.match(BOX_OPEN_RE);
    if (boxOpen) {
      flushPara();
      flushList();
      const title = boxOpen[1].trim();
      const inner: string[] = [];
      let depth = 1;
      i++;
      for (; i < lines.length; i++) {
        const t = lines[i].trim();
        if (BOX_OPEN_RE.test(t)) {
          depth++;
        } else if (t === BOX_CLOSE_MARKER) {
          depth--;
          if (depth === 0) break;
        }
        inner.push(lines[i]);
      }
      // หัวข้อกล่อง = node "boxTitle" (text node จริง = ลูกตัวแรก) เพื่อให้แก้/ลบใน editor ได้เหมือนข้อความ
      // box content schema = "boxTitle block+" → ต้องมี body อย่างน้อย 1 block (กล่องว่างใส่ paragraph เปล่า)
      const titleNode: PMNode = {
        type: "boxTitle",
        ...(title ? { content: [{ type: "text", text: title }] } : {}),
      };
      const innerContent = markdownToDoc(inner.join("\n")).content;
      const body = innerContent.length > 0 ? innerContent : [{ type: "paragraph" }];
      content.push({ type: "box", content: [titleNode, ...body] });
      continue;
    }
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    if (line === PAGEBREAK_MARKER) {
      flushPara();
      flushList();
      content.push({ type: "pageBreak" });
      continue;
    }
    // บรรทัดขึ้นต้น *** = เน้นเตือนสีแดงทั้งบรรทัด (ไม่ใช่ **** )
    const warnLine = line.match(/^\*\*\*\s*(.+?)\s*\**$/);
    if (warnLine && !line.startsWith("****")) {
      flushPara();
      flushList();
      content.push({ type: "paragraph", attrs: { warn: true }, content: parseInline(warnLine[1]) });
      continue;
    }
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      content.push({ type: "heading", attrs: { level: 2 }, content: parseInline(heading[1]) });
      continue;
    }
    if (bullet) {
      flushPara();
      list.push({ type: "listItem", content: [{ type: "paragraph", content: parseInline(bullet[1]) }] });
      continue;
    }
    flushList();
    if (!para.length) {
      // บรรทัดแรกของย่อหน้า: [[indent]] = เยื้อง 2em (structural) มิฉะนั้นเก็บช่องว่างนำหน้าที่พิมพ์เอง (trimEnd อย่างเดียว)
      if (line.startsWith(INDENT_MARKER)) {
        paraIndent = true;
        para.push(line.slice(INDENT_MARKER.length).replace(/^\s+/, ""));
      } else {
        para.push(raw.replace(/\s+$/, ""));
      }
    } else {
      para.push(line);
    }
  }
  flushPara();
  flushList();
  if (content.length === 0) content.push({ type: "paragraph" });
  return { type: "doc", content };
}

/* ── ProseMirror JSON → markdown ─────────────────────────────────────────── */

function serializeInline(nodes: PMNode[] | undefined): string {
  if (!nodes) return "";
  let out = "";
  for (const n of nodes) {
    if (n.type !== "text" || !n.text) continue;
    const marks = n.marks ?? [];
    const tsMark = marks.find((mk) => mk.type === "textStyle");
    const red = marks.some((mk) => mk.type === "red");
    const bold = marks.some((mk) => mk.type === "bold");
    const color = tsMark && "attrs" in tsMark ? tsMark.attrs.color ?? null : null;
    const fontSize = tsMark && "attrs" in tsMark ? tsMark.attrs.fontSize ?? null : null;
    // ลำดับ: ขนาด(นอกสุด) → สี → ***แดง*** → **หนา** → ปกติ
    let s: string;
    if (color) {
      const inner = bold ? `**${n.text}**` : n.text;
      s = `[[c=${colorToToken(color)}]]${inner}[[/c]]`;
    } else if (red) {
      s = `***${n.text}***`;
    } else if (bold) {
      s = `**${n.text}**`;
    } else {
      s = n.text;
    }
    if (fontSize) s = `[[s=${parseFloat(fontSize)}]]${s}[[/s]]`;
    out += s;
  }
  return out;
}

/** แปลง PMDoc → markdown string (subset เดิม) — หนึ่งบรรทัดต่อบล็อก คั่นด้วยบรรทัดว่าง */
export function docToMarkdown(doc: PMDoc | { content?: PMNode[] }): string {
  const blocks: string[] = [];
  for (const node of doc.content ?? []) {
    switch (node.type) {
      case "heading":
        blocks.push(`## ${serializeInline(node.content)}`);
        break;
      case "paragraph":
        if (node.attrs?.warn) blocks.push(`*** ${serializeInline(node.content)}`);
        else if (node.attrs?.indent) blocks.push(`${INDENT_MARKER} ${serializeInline(node.content)}`);
        else blocks.push(serializeInline(node.content));
        break;
      case "bulletList": {
        const items = (node.content ?? [])
          .map((li) => {
            // listItem > paragraph > inline
            const p = (li.content ?? []).find((c) => c.type === "paragraph") ?? li.content?.[0];
            return `- ${serializeInline(p?.content)}`;
          })
          .join("\n");
        blocks.push(items);
        break;
      }
      case "pageBreak":
        blocks.push(PAGEBREAK_MARKER);
        break;
      case "box": {
        // หัวข้อ = node "boxTitle" (ลูกตัวแรก) — ดึง text ล้วนไปใส่ marker, ที่เหลือ = เนื้อใน
        const children = node.content ?? [];
        let title = "";
        let bodyNodes = children;
        if (children[0]?.type === "boxTitle") {
          title = (children[0].content ?? []).map((n) => n.text ?? "").join("");
          bodyNodes = children.slice(1);
        }
        const inner = docToMarkdown({ content: bodyNodes });
        blocks.push(`[[box=${title}]]\n${inner}\n${BOX_CLOSE_MARKER}`);
        break;
      }
      case "boxTitle":
        // ปกติถูกจัดการใน case "box" แล้ว — ถ้าหลุดมาเดี่ยว ๆ ให้ข้าม (ไม่ render เป็น block)
        break;
      default:
        break;
    }
  }
  // ตัดบรรทัดว่างหัว/ท้าย แต่ "คงช่องว่างนำหน้า" ของย่อหน้าแรก (กันการเยื้องด้วย space หาย)
  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\s+$/, "");
}
