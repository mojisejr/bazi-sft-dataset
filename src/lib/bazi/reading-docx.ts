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
  buildRelationshipLinesMapping,
  buildTopicHumanReading,
  type RelationshipLineRow,
} from "@/lib/bazi/topic-knowledge";

/**
 * สร้างรายงานทำนายดวงจีนเป็นไฟล์ Word (.docx) จากผล engine แบบ deterministic
 * โครงตามฟอร์แมต "DNA ดวงจีน" (ปก + แผ่นดวง + 15 บท + บทเสริมตารางวัยจร)
 * server-only (ใช้ใน script/route) — คืน Document ของไลบรารี docx
 */

const FONT = "Tahoma"; // รองรับภาษาไทย

function textParagraph(text: string, opts: { bold?: boolean; size?: number; spacingAfter?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: opts.spacingAfter ?? 120 },
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 24, font: FONT })],
  });
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
      cell("เสาปี", { bold: true, width: 19 }),
      cell("เสาเดือน", { bold: true, width: 19 }),
      cell("เสาวัน (ดิถี)", { bold: true, width: 19 }),
      cell("เสายาม", { bold: true, width: 18 }),
    ],
  });
  const stemRow = new TableRow({
    children: [cell("ราศีบน (ฟ้า)", { bold: true }), cell(p.year.stem), cell(p.month.stem), cell(p.day.stem), cell(p.hour.stem)],
  });
  const branchRow = new TableRow({
    children: [cell("ราศีล่าง (ดิน)", { bold: true }), cell(p.year.branch), cell(p.month.branch), cell(p.day.branch), cell(p.hour.branch)],
  });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, stemRow, branchRow] });
}

function daYunTable(calculatedState: CalculatedStateValue): Table | null {
  const pillars = [...calculatedState.daYun].sort((a, b) => a.startAge - b.startAge);
  if (pillars.length === 0) {
    return null;
  }
  const header = new TableRow({
    children: [
      cell("ช่วงอายุ", { bold: true, width: 30 }),
      cell("ราศี (บน/ล่าง)", { bold: true, width: 35 }),
      cell("สภาวะ (12 เชี่ยงแซ)", { bold: true, width: 35 }),
    ],
  });
  // แตกแต่ละเสาวัยจร (10 ปี) เป็นครึ่งก้าน 5 ปี + ครึ่งกิ่ง 5 ปี — ใช้อายุเริ่มวัยจรจริง (起运)
  const body: TableRow[] = [];
  pillars.forEach((pillar) => {
    const phases: Array<{ ageRange: string; symbol: string; place: string; qi: string }> = [];
    if (pillar.upperPhase) {
      phases.push({
        ageRange: `${pillar.upperPhase.startAge}-${pillar.upperPhase.endAge} ปี`,
        symbol: pillar.upperPhase.symbol,
        place: "ราศีบน",
        qi: (pillar.upperPhase.twelveQiDisplay ?? "").trim(),
      });
    }
    if (pillar.lowerPhase) {
      phases.push({
        ageRange: `${pillar.lowerPhase.startAge}-${pillar.lowerPhase.endAge} ปี`,
        symbol: pillar.lowerPhase.symbol,
        place: "ราศีล่าง",
        qi: (pillar.lowerPhase.twelveQiDisplay ?? "").trim(),
      });
    }
    for (const phase of phases) {
      body.push(
        new TableRow({
          children: [
            cell(phase.ageRange),
            cell(`${phase.symbol} (${phase.place})`),
            cell(phase.qi || "—"),
          ],
        }),
      );
    }
  });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

function relationshipTable(
  calculatedState: CalculatedStateValue,
  override?: RelationshipLineRow[],
): Table {
  const rows = override && override.length > 0 ? override : buildRelationshipLinesMapping(calculatedState);
  const header = new TableRow({
    children: [
      cell("ช่วงอายุ", { bold: true, width: 14 }),
      cell("เสาวัยจร", { bold: true, width: 12 }),
      cell("เส้นขีดที่ทำงาน", { bold: true, width: 24 }),
      cell("คำอธิบายดี-ร้ายเชิงลึก", { bold: true, width: 50 }),
    ],
  });
  const body = rows.map(
    (row) =>
      new TableRow({
        children: [cell(row.ageRange), cell(row.symbol), cell(row.relationLine), cell(row.deepNote)],
      }),
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

/** คำอ่านที่ generate ไว้แล้ว (เช่นฉบับ LLM polish) ราย topicId — ใช้แทนผล engine ถ้ามี */
export type ReadingOverrides = Record<string, string | null | undefined>;

function chapterParagraphs(
  calculatedState: CalculatedStateValue,
  rawInput: RawInputValue,
  overrides?: ReadingOverrides,
): Paragraph[] {
  const out: Paragraph[] = [];
  for (const topic of TOPIC_PATH.filter((t) => t.kind === "predict")) {
    out.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: `บทที่ ${topic.chapter}: ${topic.title}`, bold: true, size: 28, font: FONT })],
      }),
    );
    const override = overrides?.[topic.id]?.trim();
    const reading = override || buildTopicHumanReading(calculatedState, topic.id, rawInput);
    if (reading) {
      for (const para of reading.split("\n\n")) {
        out.push(textParagraph(para));
      }
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
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

export function buildReadingDocument(
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
  options: { readings?: ReadingOverrides; relationshipLines?: RelationshipLineRow[] } = {},
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
          ...chapterParagraphs(calculatedState, rawInput, options.readings),
          // ── บทเสริม: ตารางวัยจร ──
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
          relationshipTable(calculatedState, options.relationshipLines),
        ],
      },
    ],
  });
}

/** สร้างไฟล์ .docx เป็น Buffer */
export async function buildReadingDocxBuffer(
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
  options: { readings?: ReadingOverrides; relationshipLines?: RelationshipLineRow[] } = {},
): Promise<Buffer> {
  return Packer.toBuffer(buildReadingDocument(rawInput, calculatedState, options));
}
