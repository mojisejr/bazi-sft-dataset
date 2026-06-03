import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import {
  buildRelationshipLinesMapping,
  buildTopicHumanReading,
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

function relationshipTable(calculatedState: CalculatedStateValue): Table {
  const rows = buildRelationshipLinesMapping(calculatedState);
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

export function buildReadingDocument(
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
  options: { readings?: ReadingOverrides } = {},
): Document {
  const dm = calculatedState.dayMaster;
  const strength = calculatedState.dayMasterStrengthProfile?.displayLabel ?? "";

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [
      {
        children: [
          // ── ปก ──
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [new TextRun({ text: "DNA ดวงจีน", bold: true, size: 56, font: FONT })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 480 },
            children: [
              new TextRun({
                text: `เกิดวันที่ ${rawInput.birthDate} เวลา ${rawInput.birthTime} น. เพศ ${rawInput.gender === "male" ? "ชาย" : "หญิง"}${rawInput.province ? ` (${rawInput.province})` : ""}`,
                size: 24,
                font: FONT,
              }),
            ],
          }),
          // ── แผ่นดวงชะตา ──
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 120 },
            children: [new TextRun({ text: "แผ่นดวงชะตา", bold: true, size: 32, font: FONT })],
          }),
          textParagraph(`ดิถีประจำตัว: ${dm}${strength ? ` (${strength})` : ""}`, { bold: true }),
          pillarTable(calculatedState),
          // ── 15 บท ──
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 360, after: 120 },
            children: [new TextRun({ text: "คู่มือชีวิต 15 มิติ", bold: true, size: 32, font: FONT })],
          }),
          ...chapterParagraphs(calculatedState, rawInput, options.readings),
          // ── บทเสริม: ตารางวัยจร ──
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
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
          relationshipTable(calculatedState),
        ],
      },
    ],
  });
}

/** สร้างไฟล์ .docx เป็น Buffer */
export async function buildReadingDocxBuffer(
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
  options: { readings?: ReadingOverrides } = {},
): Promise<Buffer> {
  return Packer.toBuffer(buildReadingDocument(rawInput, calculatedState, options));
}
