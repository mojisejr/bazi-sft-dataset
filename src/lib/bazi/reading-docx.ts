import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TableOfContents,
  TextRun,
  WidthType,
} from "docx";

import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import {
  buildDaYunTableRows,
  buildRelationshipLinesMapping,
  buildTopicHumanReading,
  buildTopicConsumerReading,
  type RelationshipLineRow,
} from "@/lib/bazi/topic-knowledge";
import { applySubstitutionRules } from "@/lib/bazi/substitution-rules";
import { readRules } from "@/lib/bazi/substitution-rules-store";
import { tokenizeInline } from "@/lib/bazi/reading-inline";
import { hexForDocx } from "@/lib/bazi/reading-colors";

/**
 * สร้างรายงานทำนายดวงจีนเป็นไฟล์ Word (.docx) จากผล engine แบบ deterministic
 * โครงตามฟอร์แมต "DNA ดวงจีน" (ปก + แผ่นดวง + 15 บท + บทเสริมตารางวัยจร)
 * server-only (ใช้ใน script/route) — คืน Document ของไลบรารี docx
 */

const FONT = "Tahoma"; // รองรับภาษาไทย

/** marker บรรทัดเดี่ยวสั่งขึ้นหน้าใหม่ (ซินแสแทรกเองในข้อความ) — ต้องตรงกับ ReadingPrintDocument */
const PAGEBREAK_MARKER = "[[pagebreak]]";
/** marker นำหน้าบรรทัดแรกของย่อหน้าที่เยื้องบรรทัดแรก — ต้องตรงกับ ReadingPrintDocument / reading-markdown */
const INDENT_MARKER = "[[indent]]";

function textParagraph(text: string, opts: { bold?: boolean; size?: number; spacingAfter?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: opts.spacingAfter ?? 120 },
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 24, font: FONT })],
  });
}

/**
 * แปลง inline markdown (***เน้นแดง*** / **ตัวหนา** / [[c=สี]]) เป็น TextRun[]
 * ใช้ tokenizer กลาง (reading-inline) ตัวเดียวกับ PDF/converter — กันตีความไม่ตรง
 * base = สไตล์พื้นของบรรทัด (หัวข้อย่อย/เตือนแดง ก็ bold+สีไว้แล้ว) แล้วซ้อนเน้น/สีจาก token ทับ
 */
function markdownRuns(text: string, base: { size?: number; bold?: boolean; color?: string } = {}): TextRun[] {
  const size = base.size ?? 24;
  const runs = tokenizeInline(text).map(
    (r) =>
      new TextRun({
        text: r.text,
        // ขนาดต่อข้อความ ([[s=PT]]) → half-points (PT × 2) ทับ base; ไม่มี = ใช้ base
        size: r.fontSize ? Math.round(parseFloat(r.fontSize) * 2) : size,
        font: FONT,
        bold: r.bold || base.bold,
        color: r.color ? hexForDocx(r.color) : r.red ? ACCENT : base.color,
      }),
  );
  if (runs.length === 0) {
    runs.push(new TextRun({ text: "", size, font: FONT, bold: base.bold, color: base.color }));
  }
  return runs;
}

/**
 * แปลง markdown ย่อ (หัวข้อย่อย / bullet / เน้นแดง / ย่อหน้า / ตัวแบ่งหน้า) เป็น Paragraph[]
 * mirror renderMarkdown() ของ PDF — บรรทัดติดกันรวมเป็นย่อหน้าเดียว (join " "), บรรทัดว่าง = ตัดย่อหน้า
 */
function markdownParagraphs(text: string): Paragraph[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: Paragraph[] = [];
  let para: string[] = [];
  let paraIndent = false;
  const flushPara = () => {
    if (para.length) {
      out.push(
        new Paragraph({
          spacing: { after: 120 },
          // เยื้องบรรทัดแรก ~2em (480 twips ที่ฟอนต์ 12pt) ให้ตรงกับ .ylc-indent ใน PDF
          ...(paraIndent ? { indent: { firstLine: 480 } } : {}),
          children: markdownRuns(para.join(" ")),
        }),
      );
      para = [];
      paraIndent = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      continue;
    }
    if (line === PAGEBREAK_MARKER) {
      flushPara();
      out.push(new Paragraph({ children: [new PageBreak()] }));
      continue;
    }
    // บรรทัดขึ้นต้น *** = เน้นเตือนสีแดง (เช่น "*** ระวังเป็นพิเศษ")
    const warnLine = line.match(/^\*\*\*\s*(.+?)\s*\**$/);
    if (warnLine && !line.startsWith("****")) {
      flushPara();
      out.push(
        new Paragraph({
          spacing: { before: 80, after: 120 },
          children: markdownRuns(warnLine[1], { size: 24, bold: true, color: ACCENT }),
        }),
      );
      continue;
    }
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (heading) {
      flushPara();
      out.push(
        new Paragraph({
          spacing: { before: 160, after: 60 },
          children: markdownRuns(heading[1], { size: 26, bold: true, color: ACCENT }),
        }),
      );
      continue;
    }
    if (bullet) {
      flushPara();
      out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: markdownRuns(bullet[1]) }));
      continue;
    }
    if (!para.length) {
      // บรรทัดแรกของย่อหน้า: [[indent]] = เยื้อง 2em มิฉะนั้นคงช่องว่างนำหน้าที่พิมพ์เอง (trimEnd อย่างเดียว)
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
  return out;
}

function cell(text: string, opts: { bold?: boolean; width?: number } = {}): TableCell {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: opts.bold, size: 22, font: FONT })],
      }),
    ],
  });
}

function pillarTable(calculatedState: CalculatedStateValue): Table {
  const p = calculatedState.fourPillars;
  const header = new TableRow({
    children: [
      cell("เสา", { bold: true, width: 25 }),
      cell("เสายาม", { bold: true, width: 18 }),
      cell("เสาวัน (ดิถี)", { bold: true, width: 19 }),
      cell("เสาเดือน", { bold: true, width: 19 }),
      cell("เสาปี", { bold: true, width: 19 }),
    ],
  });
  const stemRow = new TableRow({
    children: [cell("ราศีบน (ฟ้า)", { bold: true }), cell(p.hour.stem), cell(p.day.stem), cell(p.month.stem), cell(p.year.stem)],
  });
  const branchRow = new TableRow({
    children: [cell("ราศีล่าง (ดิน)", { bold: true }), cell(p.hour.branch), cell(p.day.branch), cell(p.month.branch), cell(p.year.branch)],
  });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, stemRow, branchRow] });
}

function daYunTable(calculatedState: CalculatedStateValue): Table | null {
  const rows = buildDaYunTableRows(calculatedState);
  if (rows.length === 0) {
    return null;
  }
  const header = new TableRow({
    children: [
      cell("ช่วงอายุ", { bold: true, width: 22 }),
      cell("ราศี (บน/ล่าง)", { bold: true, width: 28 }),
      cell("ปฏิกิริยา", { bold: true, width: 22 }),
      cell("สภาวะ (12 เชี่ยงแซ)", { bold: true, width: 28 }),
    ],
  });
  // แต่ละเสาวัยจร (10 ปี) แตกเป็นครึ่งก้าน 5 ปี + ครึ่งกิ่ง 5 ปี
  // คอลัมน์ "ปฏิกิริยา" = บทบาทธาตุวัยจรเทียบดิถี (คู่ธาตุ/ถ่ายเท/โชคลาภ/พิฆาต/ส่งเสริม) — อ้างบทเสริมหลังบทที่ 15
  const body = rows.map(
    (row) =>
      new TableRow({
        children: [
          cell(row.ageRange),
          cell(`${row.symbol} (${row.place})`),
          cell(row.reaction),
          cell(row.qi || "—"),
        ],
      }),
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

/** ตารางบทเสริม — แตกเป็นหลาย Table ตาม pageBreakBefore คั่นด้วย PageBreak (ขึ้นหน้าใหม่ใน Word) */
function relationshipTables(
  calculatedState: CalculatedStateValue,
  override?: RelationshipLineRow[],
): (Table | Paragraph)[] {
  const rows = override && override.length > 0 ? override : buildRelationshipLinesMapping(calculatedState);
  const header = () =>
    new TableRow({
      children: [
        cell("ช่วงอายุ", { bold: true, width: 16 }),
        cell("เสาวัยจร", { bold: true, width: 14 }),
        cell("คำอธิบายดี-ร้ายเชิงลึก", { bold: true, width: 70 }),
      ],
    });
  // แตกแถวเป็นกลุ่มตาม pageBreakBefore
  const groups: RelationshipLineRow[][] = [];
  for (const row of rows) {
    if (groups.length === 0 || row.pageBreakBefore) groups.push([row]);
    else groups[groups.length - 1].push(row);
  }
  const out: (Table | Paragraph)[] = [];
  groups.forEach((group, gi) => {
    if (gi > 0) out.push(new Paragraph({ children: [new PageBreak()] }));
    const body = group.map(
      (row) => new TableRow({ children: [cell(row.ageRange), cell(row.symbol), cell(row.deepNote)] }),
    );
    out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header(), ...body] }));
  });
  return out;
}

/** คำอ่านที่ generate ไว้แล้ว (เช่นฉบับ LLM polish) ราย topicId — ใช้แทนผล engine ถ้ามี */
export type ReadingOverrides = Record<string, string | null | undefined>;

/** ฉบับ render ของบทคำทำนาย: technical (เทคนิคครบ) หรือ consumer (ร้อยแก้วผู้บริโภค) */
export type ReadingVariant = "technical" | "consumer";

function chapterParagraphs(
  calculatedState: CalculatedStateValue,
  rawInput: RawInputValue,
  overrides?: ReadingOverrides,
  topicIds?: string[],
  variant: ReadingVariant = "technical",
): Paragraph[] {
  const out: Paragraph[] = [];
  const wanted = topicIds ? new Set(topicIds) : null;
  // กฎแทนคำของซินแส — ใช้กับข้อความที่ regenerate เองเท่านั้น (override จาก client ผ่านกฎมาแล้ว)
  const substitutionRules = readRules().rules;
  for (const topic of TOPIC_PATH.filter((t) => t.kind === "predict" && (!wanted || wanted.has(t.id)))) {
    const override = overrides?.[topic.id]?.trim();
    // ไอคอน 🤖 = ส่วนที่ AI (LLM) แต่งสำนวนทับโครง engine; ไม่มีไอคอน = ข้อความจาก engine ตรง ๆ
    const aiMark = override ? " 🤖" : "";
    out.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: `บทที่ ${topic.chapter}: ${topic.title}${aiMark}`, bold: true, size: 28, font: FONT })],
      }),
    );
    const baseReading = applySubstitutionRules(
      topic.id,
      variant === "consumer"
        ? buildTopicConsumerReading(calculatedState, topic.id, rawInput)
        : buildTopicHumanReading(calculatedState, topic.id, rawInput),
      substitutionRules,
    );
    const reading = override || baseReading;
    if (reading) {
      out.push(...markdownParagraphs(reading));
    } else {
      out.push(textParagraph("(ยังไม่มีองค์ความรู้สำหรับหัวข้อนี้)"));
    }
  }
  return out;
}

/** สีหลักของรายงาน (โทนแดงเข้ม-ทอง สไตล์มงคลจีน) */
const ACCENT = "8B1A1A";
const ACCENT_SOFT = "F3E6CE";

/** หน้าปก: กรอบสีพื้น + ชื่อรายงาน + ข้อมูลเกิด แล้วขึ้นหน้าใหม่ */
function coverPage(rawInput: RawInputValue): Paragraph[] {
  const genderTh = rawInput.gender === "male" ? "ชาย" : "หญิง";
  const birthLine = `เกิดวันที่ ${rawInput.birthDate} เวลา ${rawInput.birthTime} น. เพศ ${genderTh}${rawInput.province ? ` (${rawInput.province})` : ""}`;
  const banner = (text: string, opts: { size: number; bold?: boolean; color?: string }) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
      shading: { type: ShadingType.CLEAR, fill: ACCENT_SOFT, color: "auto" },
      border: {
        top: { style: BorderStyle.SINGLE, size: 18, color: ACCENT, space: 8 },
        bottom: { style: BorderStyle.SINGLE, size: 18, color: ACCENT, space: 8 },
        left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT, space: 8 },
        right: { style: BorderStyle.SINGLE, size: 18, color: ACCENT, space: 8 },
      },
      children: [new TextRun({ text, bold: opts.bold, size: opts.size, color: opts.color, font: FONT })],
    });

  return [
    new Paragraph({ spacing: { before: 1600, after: 0 }, children: [] }),
    banner("☯ DNA ดวงจีน ☯", { size: 64, bold: true, color: ACCENT }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: "รายงานพยากรณ์ชะตาชีวิต 15 มิติ", size: 28, color: ACCENT, font: FONT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 720, after: 0 },
      children: [new TextRun({ text: birthLine, size: 26, font: FONT })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

/** หน้าสารบัญ: หัวเรื่อง + TOC field (Word เติมเลขหน้าให้เมื่อเปิด) แล้วขึ้นหน้าใหม่ */
function tableOfContentsPage(): (Paragraph | TableOfContents)[] {
  return [
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: "สารบัญ", bold: true, size: 40, color: ACCENT, font: FONT })],
    }),
    new TableOfContents("สารบัญ", {
      hyperlink: true,
      headingStyleRange: "1-2",
    }),
    new Paragraph({
      spacing: { before: 240, after: 0 },
      children: [new TextRun({
        text: "หมายเหตุ: บทที่มีสัญลักษณ์ 🤖 คือส่วนที่ AI เรียบเรียงสำนวนทับโครงคำนวณของระบบ (engine) — บทที่ไม่มีสัญลักษณ์คือข้อความจากระบบโดยตรง",
        italics: true, size: 22, color: "666666", font: FONT,
      })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

export function buildReadingDocument(
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
  options: { readings?: ReadingOverrides; relationshipLines?: RelationshipLineRow[]; variant?: ReadingVariant } = {},
): Document {
  const dm = calculatedState.dayMaster;
  const strength = calculatedState.dayMasterStrengthProfile?.displayLabel ?? "";

  return new Document({
    // ให้ Word อัปเดต field (สารบัญ) อัตโนมัติเมื่อเปิดไฟล์
    features: { updateFields: true },
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [
      {
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "หน้า ", size: 18, color: "888888", font: FONT }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888", font: FONT }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ── ปก ──
          ...coverPage(rawInput),
          // ── สารบัญ ──
          ...tableOfContentsPage(),
          // ── แผ่นดวงชะตา ──
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 120 },
            children: [new TextRun({ text: "แผ่นดวงชะตา", bold: true, size: 32, font: FONT })],
          }),
          textParagraph(`ดิถีประจำตัว: ${dm}${strength ? ` (${strength})` : ""}`, { bold: true }),
          pillarTable(calculatedState),
          ...(daYunTable(calculatedState)
            ? [
                new Paragraph({
                  spacing: { before: 240, after: 80 },
                  children: [new TextRun({ text: "ตารางวัยจร (ถนนชีวิต ช่วงละ 5 ปี)", bold: true, size: 24, font: FONT })],
                }),
                daYunTable(calculatedState) as Table,
              ]
            : []),
          // ── 15 บท ──
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            pageBreakBefore: true,
            spacing: { before: 360, after: 120 },
            children: [new TextRun({ text: "คู่มือชีวิต 15 มิติ", bold: true, size: 32, font: FONT })],
          }),
          ...chapterParagraphs(calculatedState, rawInput, options.readings, undefined, options.variant),
          // ── บทเสริม: ตารางวัยจร (แตกหน้าตาม pageBreakBefore) ──
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            pageBreakBefore: true,
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({
                text: "บทเสริม: ตารางวิเคราะห์เส้นขีดความสัมพันธ์ หมวดช่วงอายุและวัยจร",
                bold: true,
                size: 30,
                font: FONT,
              }),
            ],
          }),
          ...relationshipTables(calculatedState, options.relationshipLines),
        ],
      },
    ],
  });
}

/** สร้างไฟล์ .docx เป็น Buffer */
export async function buildReadingDocxBuffer(
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
  options: { readings?: ReadingOverrides; relationshipLines?: RelationshipLineRow[]; variant?: ReadingVariant } = {},
): Promise<Buffer> {
  return Packer.toBuffer(buildReadingDocument(rawInput, calculatedState, options));
}

/** เอกสารบทเดียว (per-topic) — สำหรับให้ซินแซเปิดใน Google Doc แล้ว redline ทีละบท
 *  ใส่ปก + แผ่นดวงย่อ + บทนั้นบทเดียว (บทวัยจรพ่วงตารางวัยจรให้ด้วย) */
export function buildTopicDocument(
  topicId: string,
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
  options: { readings?: ReadingOverrides; relationshipLines?: RelationshipLineRow[]; variant?: ReadingVariant } = {},
): Document {
  const topic = TOPIC_PATH.find((t) => t.id === topicId && t.kind === "predict");
  if (!topic) {
    throw new Error(`ไม่พบหัวข้อ (predict) สำหรับ topicId: ${topicId}`);
  }
  const dm = calculatedState.dayMaster;
  const strength = calculatedState.dayMasterStrengthProfile?.displayLabel ?? "";
  const isLuck = topicId === "turning_points";

  return new Document({
    features: { updateFields: true },
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [
      {
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "หน้า ", size: 18, color: "888888", font: FONT }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888", font: FONT }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...coverPage(rawInput),
          textParagraph(`ดิถีประจำตัว: ${dm}${strength ? ` (${strength})` : ""}`, { bold: true }),
          pillarTable(calculatedState),
          new Paragraph({ children: [new PageBreak()] }),
          ...chapterParagraphs(calculatedState, rawInput, options.readings, [topicId], options.variant),
          ...(isLuck
            ? [
                new Paragraph({
                  heading: HeadingLevel.HEADING_2,
                  pageBreakBefore: true,
                  spacing: { before: 240, after: 120 },
                  children: [new TextRun({ text: "ตารางวิเคราะห์วัยจร (ช่วงละ 5 ปี)", bold: true, size: 28, font: FONT })],
                }),
                ...relationshipTables(calculatedState, options.relationshipLines),
              ]
            : []),
        ],
      },
    ],
  });
}

/** per-topic .docx เป็น Buffer */
export async function buildTopicDocxBuffer(
  topicId: string,
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
  options: { readings?: ReadingOverrides; relationshipLines?: RelationshipLineRow[]; variant?: ReadingVariant } = {},
): Promise<Buffer> {
  return Packer.toBuffer(buildTopicDocument(topicId, rawInput, calculatedState, options));
}
