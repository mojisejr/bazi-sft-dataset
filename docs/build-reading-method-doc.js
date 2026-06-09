const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageNumber, Header, Footer, LevelFormat,
} = require("docx");

const FONT = "Tahoma";
const CONTENT_W = 9360; // US Letter, 1" margins

const border = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
const borders = { top: border, bottom: border, left: border, right: border };
const HEADER_FILL = "1F3864";
const STEP_FILL = "DCE6F1";
const ALT_FILL = "F2F6FB";

function cell(text, width, opts = {}) {
  const { bold = false, fill, color, align = AlignmentType.LEFT, size = 19 } = opts;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    children: text.split("\n").map((line) =>
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text: line, bold, color, font: FONT, size })],
      })
    ),
  });
}

function headerRow(cells, widths) {
  return new TableRow({
    tableHeader: true,
    children: cells.map((t, i) =>
      cell(t, widths[i], { bold: true, fill: HEADER_FILL, color: "FFFFFF", align: AlignmentType.CENTER })
    ),
  });
}

function p(text, opts = {}) {
  const { bold = false, size = 20, color, after = 120, before = 0, align } = opts;
  return new Paragraph({
    spacing: { after, before },
    alignment: align,
    children: [new TextRun({ text, bold, size, color, font: FONT })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 20, font: FONT })],
  });
}

// ---- 7 canonical steps (ฉบับซินแสปรับ) ----
const STEPS = [
  ["1", "สมดุลดวงและแกนหลัก", "ดวงยืนด้วยแข็ง / อ่อน / สมดุล และธาตุใดพยุงหรือดึงกำลังดวง"],
  ["2", "หลักวันและตัวตน", "ยึดดิถี + ราศีล่างวันเป็นตัวตนหลัก แล้วใช้ 60 กะจื่อแต้มคาแรกเตอร์"],
  ["3", "พลังมาตรฐาน (5 บทบาทธาตุ)", "เรียงลำดับ คู่ธาตุ / ถ่ายเท / โชคลาภ / ภาระหน้าที่ / ส่งเสริม — กี่จุด แรงสุดที่ไหน มีแรงรบกวน (ชง เฮ้ง จื่อเฮ้ง ซำเฮ้ง ไห่ ผั่ว) / ดึงดูด (ฮะ ภาคี ครึ่งภาคี ไตรภาคี ไตรทิศ) / 12 เชี่ยงแซ"],
  ["4", "การอ่านตัวถ่ายเท", "ไล่ธาตุถ่ายเท 4 ระดับ: (1) ธาตุแท้ ราศีบน=ฟ้ากำหนด/ราศีล่าง=ฝึกฝนพัฒนาตน → (2) แฝงจากกลุ่มภาคีที่แปรเป็นธาตุถ่ายเท → (3) ลีลา 12 เชี่ยงแซรายหลัก → (4) ราศีแฝง=จิตใต้สำนึก (หลักยาม=จิตใจภายในไม่แสดงออก)"],
  ["5", "ผลลัพธ์และโชคลาภ", "ดิถีพิฆาตธาตุไหน กี่จุด ศักยภาพคว้าโชค ลาภเปีย (ต่างขั้ว) / ลาภหมกยก + ลีลา 12 เชี่ยงแซ"],
  ["6", "บริบทสี่เสา", "พลังเดียวกันตกคนละเสาให้ความหมายต่างกัน + ชั้นฟ้า/ดินเปลี่ยนธรรมชาติของพลัง"],
  ["7", "ดาวพิเศษ / ราศีแฝง / สัญญาณขั้นสูง", "ใช้ดาวพิเศษ (กุ้ยนั้ง บุ่นเชี่ยง เทียนเต๊ก ง้วยเต๊ก ผั่วไฉ่โข่ว/กึ่งผั่วไฉ่โข่ว) คลังทรัพย์-อำนาจแฝง ฤดูกาล เป็นตัวเก็บปลาย ไม่แย่งแกนหลัก"],
];

// ---- per-chapter definitions (ฉบับซินแสปรับ: 16 บท, 7 ขั้น, รวมการพูดเข้าบท 1) ----
const CHAPTERS = [
  ["0", "ฐานคำนวณ", "4 เสา + สภาวะ 12 เชี่ยงแซ + ตารางวัยจร 5 ปี", "1, 2", "—"],
  ["1", "พื้นฐานดวงชะตา", "ดิถีแข็ง/อ่อน + นิสัยพื้นฐานจากหลักวัน + ถ่ายเท/12 เชี่ยงแซ (รวมการพูด/การสื่อสาร)", "1, 2, 3, 4", "ถ่ายเท, คู่ธาตุ"],
  ["2", "อาชีพ / ธุรกิจ", "ดิถีแข็ง/อ่อน + ดาวถ่ายเท (วิธีหาเงิน) + ธาตุเสริม — เอาราศีบนหลักวันกับราศีบนหลักเดือนมาคิดร่วม ต้องเป็นธาตุส่งเสริม/คู่ธาตุ/โชคลาภ ให้ทั้งสองหลัก", "3, 4", "ถ่ายเท"],
  ["3", "โชคลาภ", "ดิถีแข็ง/อ่อน + ถ่ายเท + โชคลาภ + 12 เชี่ยงแซ", "4, 5", "โชคลาภ"],
  ["4", "ผู้อุปถัมภ์", "ดิถีแข็ง/อ่อน + ดูธาตุส่งเสริม + 12 เชี่ยงแซ / หลักปี-เดือน-วัน-ยาม ที่เป็นประโยชน์ (ส่งเสริม/คู่ธาตุ/โชคลาภ) แล้วเป็นเชี่ยงแซดี", "3", "ส่งเสริม, ภาระหน้าที่"],
  ["5", "พรสวรรค์", "ดิถีแข็ง/อ่อน + ตัวถ่ายเทที่ดี + ผลลัพธ์ที่ดีในระบบ 12 เชี่ยงแซ (ถ่ายเทเสีย=ทายด้านดีของเชี่ยงแซเสีย; ถ่ายเทราศีแฝง/ราศีบนเทียบหลักยาม)", "3, 4, 7", "ถ่ายเท"],
  ["6", "ครอบครัว", "ดิถีแข็ง/อ่อน + ความหมายเสาปี (บรรพบุรุษ)/เสาเดือน (พ่อแม่) + 12 เชี่ยงแซ + ปฏิกิริยาธาตุ", "6", "ส่งเสริม"],
  ["7", "ความรัก / คู่ครอง", "ดิถีแข็ง/อ่อน + ฐานคู่ (ราศีล่างหลักวัน) + ธาตุคู่ครองตามเพศ + วัยจรกระทบคู่ (การถ่ายเทเทียบคู่ครอง + 12 เชี่ยงแซ)", "2, 4, 5", "โชคลาภ, ภาระหน้าที่"],
  ["8", "เพื่อน / ศัตรู", "ดิถีแข็ง/อ่อน + คู่ธาตุ + 12 เชี่ยงแซดี/เสีย + ปฏิกิริยา (ตำแหน่งหลักปี/เดือน/วัน/ยาม ดี=มิตร เสีย=ศัตรู)", "3", "คู่ธาตุ"],
  ["9", "หุ้นส่วน", "ดิถีแข็ง/อ่อน → ความจำเป็นของคู่ธาตุและธาตุเสริม — หลักวันเชี่ยงแซดีมีหุ้นส่วนได้ ดิถีนั่งบนธาตุพิฆาตไม่ควรมี ดูผั่วไฉ่โข่ว", "1, 3", "คู่ธาตุ, ส่งเสริม"],
  ["10", "ลูกน้อง / บริวาร", "ดิถีแข็ง/อ่อน + เสายาม (ฐานบริวาร) + ดาวถ่ายเท + 12 เชี่ยงแซ — ดูผั่วไฉ่โข่ว/ธาตุถ่ายเท=บริวาร", "4, 6", "ถ่ายเท"],
  ["11", "การศึกษา", "ดิถีแข็ง/อ่อน + ธาตุถ่ายเท + เชี่ยงแซดี + วิชาธาตุที่เสริมดิถี/ทำให้ถ่ายเท/โชคลาภแข็งแรง", "3, 4", "ถ่ายเท, ส่งเสริม"],
  ["12", "จังหวะชีวิต / วัยจร", "ดิถีแข็ง/อ่อน + ตารางวัยจร: เสาวัยจร × ปฏิกิริยาธาตุ 5 ธาตุ × 12 เชี่ยงแซ + ผั่วไฉ่โข่ว/กึ่งผั่วไฉ่โข่ว", "7", "—"],
  ["13", "สุขภาพ", "ดิถีแข็ง/อ่อน + ธาตุน้อย=ป่วย / ธาตุเกิน=เสียสมดุล + เจ๊าะ/ซวย/ผั่ว ตามตำแหน่ง", "7", "ภาระหน้าที่"],
  ["14", "สี / ทิศมงคล", "ดิถีแข็ง/อ่อน + ดิถีอ่อนต้องการธาตุส่งเสริม/คู่ธาตุ · ดิถีแข็งต้องการธาตุถ่ายเท/โชคลาภ → ตารางสี/ทิศ", "1", "—"],
  ["15", "องค์เทพคุ้มครอง", "ดิถีแข็ง/อ่อน + useful god (ธาตุที่ต้องการ) → ตารางองค์เทพ + เทียบ 12 เชี่ยงแซ ในดวง", "1", "—"],
];

const ROLES = [
  ["ถ่ายเท (output)", "ธาตุที่ดิถีสร้าง", "คิด/พูด/ฟัง/เรียน/ทำงาน/เดินทาง/ลงทุน/จับจ่าย/บริวาร/ลูก(เพศหญิง)"],
  ["คู่ธาตุ (same)", "ธาตุเดียวกับดิถี", "พี่น้อง/เพื่อนฝูง/คู่ค้า/คู่แข่ง"],
  ["ส่งเสริม (resource)", "ธาตุที่สร้างดิถี", "องค์ความรู้/ผู้หลักผู้ใหญ่/ครูบาอาจารย์/แม่/ผู้สนับสนุน"],
  ["ภาระหน้าที่ (power)", "ธาตุที่ควบคุมดิถี", "ภาระ/หน้าที่/ตำแหน่ง/หนี้สิน/รายจ่าย/คู่ครอง(เพศหญิง)/ลูก(เพศชาย)/คุณธรรม"],
  ["โชคลาภ (wealth)", "ธาตุที่ดิถีพิฆาต", "ทรัพย์/รายได้/ผลลัพธ์/สินค้า/พ่อ/คู่ครอง(เพศชาย)"],
];

// ---- why each chapter picks its steps (ฉบับซินแสปรับ: สคีมา 7 ขั้น) ----
const REASONS = [
  ["1", "พื้นฐานดวงชะตา", "1, 2, 3, 4", "บุคลิก+การสื่อสารต้องตอบ 4 ชั้น: กำลังดิถี (ขั้น 1) → แก่นตัวตนหลักวัน (ขั้น 2) → 5 บทบาทธาตุ (ขั้น 3) → การอ่านตัวถ่ายเท 4 ระดับ (ขั้น 4) ซึ่งครอบคลุมการพูด/การสื่อสารที่ย้ายมารวมไว้ในบทนี้"],
  ["2", "อาชีพ / ธุรกิจ", "3, 4", "อาชีพ = “วิธีหาเงิน” = ดาวถ่ายเท จึงดูทั้งภาพรวม 5 บทบาท (ขั้น 3) และเจาะการอ่านตัวถ่ายเทเชิงลึก (ขั้น 4) เพื่อชี้ช่องทางใช้พลังถ่ายเท"],
  ["3", "โชคลาภ", "4, 5", "โชคลาภมาจากถ่ายเท→สร้างทรัพย์ จึงอ่านตัวถ่ายเท (ขั้น 4) ต่อด้วยผลลัพธ์/โชคลาภ ธาตุที่ดิถีพิฆาต (ขั้น 5) ที่รวมศักยภาพคว้าโชค/ลาภเปีย/ลาภหมกยก"],
  ["4", "ผู้อุปถัมภ์", "3", "ผู้ใหญ่หนุน = ดาวส่งเสริม (resource) + ภาระหน้าที่ (power) ซึ่งเป็น 2 ใน 5 บทบาทของขั้น 3 จึงเจาะเฉพาะ 2 บทบาทนี้"],
  ["5", "พรสวรรค์", "3, 4, 7", "ทักษะแกน = ดาวถ่ายเท (ขั้น 3) + อ่านตัวถ่ายเทเชิงลึก (ขั้น 4) + ความสามารถพิเศษจากดาววิชาการ/อุปถัมภ์/ราศีแฝง (ขั้น 7)"],
  ["6", "ครอบครัว", "6", "ครอบครัวอ่านจาก “ตำแหน่งเสา” (ปี=บรรพบุรุษ เดือน=พ่อแม่) ว่าพลังตกคนละเสาให้ความหมายต่างกัน — ตรงนิยามขั้น 6 บริบทสี่เสา"],
  ["7", "ความรัก / คู่ครอง", "2, 4, 5", "คู่ครอง: ฐานคู่=ราศีล่างหลักวัน (ขั้น 2) + การถ่ายเทเทียบคู่ครอง (ขั้น 4) + ดาวคู่ครอง=โชคลาภ(ชาย)/ภาระหน้าที่(หญิง) ผ่านขั้น 5"],
  ["8", "เพื่อน / ศัตรู", "3", "มิตร/คู่แข่ง = ดาวคู่ธาตุ (same) ซึ่งเป็น 1 ใน 5 บทบาทของขั้น 3 — ดูสภาวะ 12 เชี่ยงแซดี/เสียของ same ตัดสินมิตร-ศัตรู"],
  ["9", "หุ้นส่วน", "1, 3", "ควรมีหุ้นส่วนไหมขึ้นกับกำลังดิถี (ขั้น 1) แล้วดูคู่ธาตุ/ธาตุส่งเสริมว่ามีจริงไหม (ขั้น 3)"],
  ["10", "ลูกน้อง / บริวาร", "4, 6", "บริวาร = ธาตุถ่ายเท จึงอ่านตัวถ่ายเท (ขั้น 4) ผูกกับเสายาม=ฐานบริวารในบริบทสี่เสา (ขั้น 6)"],
  ["11", "การศึกษา", "3, 4", "การเรียน = ดาวถ่ายเท (วิธีใช้สมอง) + ธาตุส่งเสริม (วิชาที่หนุนดิถี) จึงดู 5 บทบาท (ขั้น 3) และอ่านตัวถ่ายเทเชิงลึก (ขั้น 4)"],
  ["12", "จังหวะชีวิต", "7", "วัยจร/ปีจร/ดาวพิเศษเป็น “สัญญาณตามเวลา” = เนื้อของขั้น 7 (สัญญาณขั้นสูง) เสริมด้วยตารางวัยจร 5 ปีของบทเอง"],
  ["13", "สุขภาพ", "7", "สุขภาพอ่านจากธาตุพร่อง/ล้น และดาวแฝง-ตำแหน่งที่เชี่ยงแซตก ซึ่งเป็นรายละเอียดเชิงลึกในขั้น 7"],
  ["14", "สี / ทิศมงคล", "1", "สี/ทิศมาจาก useful god ที่สรุปได้จากกำลังดิถี — พอแค่ขั้น 1 แล้วเปิดตารางสำเร็จรูป"],
  ["15", "องค์เทพคุ้มครอง", "1", "องค์เทพผูกกับ useful god เช่นเดียวกับสี/ทิศ จึงใช้ขั้น 1 ยืนยันธาตุที่ต้องการ แล้วเปิดตารางองค์เทพ"],
];

// ===== build doc =====
const children = [];

children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 80 },
  children: [new TextRun({ text: "วิธีการอ่านดวงรายบท", font: FONT, bold: true, size: 40, color: "1F3864" })] }));
children.push(p("เอกสารอ้างอิงโครงสร้าง “วิธีการอ่าน” ที่ engine สร้างบนการ์ดแต่ละบท",
  { size: 21, color: "555555", after: 60 }));
children.push(p("ที่มา: buildMethodLines (topic-reading.ts) ประกอบจาก 7 ขั้นตอน canonical (buildStepInsights, day-master-relation-reading-poc.ts) + นิยามรายบท (TOPIC_DEFINITIONS, topic-path.ts) — ฉบับซินแสปรับ",
  { size: 18, color: "777777", after: 240 }));

// section: formula
children.push(new Paragraph({ heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text: "สูตรประกอบของแต่ละบท", font: FONT, bold: true, size: 28, color: "1F3864" })] }));
children.push(p("แต่ละบทประกอบบล็อก “วิธีการอ่าน” จาก 3 ส่วน:", { after: 80 }));
children.push(bullet("หลักการอ่าน (lens) — ประโยคสรุปว่าบทนี้อ่านจากอะไรเป็นแกน"));
children.push(bullet("ขั้นที่ใช้ (stepNumbers) — เลือกหยิบจาก 7 ขั้นตอน canonical พร้อมหลักฐานจริงของดวงรายขั้น"));
children.push(bullet("บทบาทธาตุ (relationKeys) — ระบุว่าให้อ่านธาตุบทบาทไหน และหมายถึงอะไร"));
children.push(p("", { after: 120 }));

// section: 6 steps
children.push(new Paragraph({ heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text: "7 ขั้นตอน canonical (ใช้ร่วมกันทุกบท)", font: FONT, bold: true, size: 28, color: "1F3864" })] }));
{
  const w = [900, 2900, 5560];
  const rows = [headerRow(["ขั้น", "ชื่อขั้น", "โฟกัสการอ่าน (audit focus)"], w)];
  STEPS.forEach((r, idx) => {
    const fill = idx % 2 === 1 ? STEP_FILL : undefined;
    rows.push(new TableRow({ children: [
      cell(r[0], w[0], { bold: true, align: AlignmentType.CENTER, fill }),
      cell(r[1], w[1], { bold: true, fill }),
      cell(r[2], w[2], { fill }),
    ]}));
  });
  children.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: w, rows }));
}
children.push(p("", { after: 160 }));

// section: chapters table
children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: true,
  children: [new TextRun({ text: "วิธีการอ่านรายบท", font: FONT, bold: true, size: 28, color: "1F3864" })] }));
{
  const w = [620, 2100, 4140, 900, 1600];
  const rows = [headerRow(["บท", "หัวข้อ", "หลักการอ่าน (lens)", "ใช้ขั้น", "บทบาทธาตุ"], w)];
  CHAPTERS.forEach((r, idx) => {
    const fill = idx % 2 === 1 ? ALT_FILL : undefined;
    rows.push(new TableRow({ children: [
      cell(r[0], w[0], { bold: true, align: AlignmentType.CENTER, fill }),
      cell(r[1], w[1], { bold: true, fill }),
      cell(r[2], w[2], { fill, size: 18 }),
      cell(r[3], w[3], { align: AlignmentType.CENTER, fill }),
      cell(r[4], w[4], { fill, size: 18 }),
    ]}));
  });
  children.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: w, rows }));
}
children.push(p("", { after: 160 }));

// section: role legend
children.push(new Paragraph({ heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text: "บทบาทธาตุ (relationKeys) — ความหมาย", font: FONT, bold: true, size: 28, color: "1F3864" })] }));
{
  const w = [2400, 2960, 4000];
  const rows = [headerRow(["บทบาท", "นิยามเทียบดิถี", "ความหมายในการอ่าน"], w)];
  ROLES.forEach((r, idx) => {
    const fill = idx % 2 === 1 ? ALT_FILL : undefined;
    rows.push(new TableRow({ children: [
      cell(r[0], w[0], { bold: true, fill }),
      cell(r[1], w[1], { fill }),
      cell(r[2], w[2], { fill }),
    ]}));
  });
  children.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: w, rows }));
}
children.push(p("", { after: 120 }));
children.push(p("หมายเหตุ: ทุกบทยึด “ตำแหน่งเสา + ชนิดดาว + 12 เซียงแซ” เป็นแกน แล้วใช้กำลังดิถีกำกับโทน (ดิถีอ่อน/แข็งอ่านต่างกัน) และ useful god เป็นตัวบอกทางเสริม/ทางแก้",
  { size: 18, color: "555555" }));

// ============ section: WHY each chapter picks its steps ============
children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: true,
  children: [new TextRun({ text: "คำอธิบายเหตุผล: ทำไมแต่ละบทเลือกขั้นเหล่านั้น", font: FONT, bold: true, size: 28, color: "1F3864" })] }));
children.push(p("หลักคิด: แต่ละบทมี “สิ่งที่ต้องตอบ” ต่างกัน จึงหยิบเฉพาะขั้นที่ผลิตข้อเท็จจริงตรงกับคำถามของบทนั้น — ไม่ดึงทุกขั้นมาเพื่อเลี่ยงข้อมูลรกและการอ่านผิดทาง",
  { size: 19, color: "555555", after: 140 }));
{
  const w = [560, 1900, 820, 6080];
  const rows = [headerRow(["บท", "หัวข้อ", "ใช้ขั้น", "เหตุผลที่เลือกขั้นนี้"], w)];
  REASONS.forEach((r, idx) => {
    const fill = idx % 2 === 1 ? ALT_FILL : undefined;
    rows.push(new TableRow({ children: [
      cell(r[0], w[0], { bold: true, align: AlignmentType.CENTER, fill }),
      cell(r[1], w[1], { bold: true, fill, size: 18 }),
      cell(r[2], w[2], { align: AlignmentType.CENTER, fill }),
      cell(r[3], w[3], { fill, size: 18 }),
    ]}));
  });
  children.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: w, rows }));
}

// ============ section: REAL example chart ============
const example = JSON.parse(fs.readFileSync(path.join(__dirname, "example-reading-dump.json"), "utf8"));

children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: true,
  children: [new TextRun({ text: "ตัวอย่างผลจริง 1 ดวง", font: FONT, bold: true, size: 28, color: "1F3864" })] }));
children.push(p(`ข้อมูลเกิด: 24/11/2536 (ค.ศ. 1993) เวลา 15:09 น. เพศชาย — ผลจาก engine จริง (mode: engine)`,
  { size: 20, bold: true, after: 60 }));

// chart summary table
{
  const w = [2340, 2340, 2340, 2340];
  const rows = [
    new TableRow({ children: [
      cell("เสาปี", w[0], { bold: true, fill: STEP_FILL, align: AlignmentType.CENTER }),
      cell("เสาเดือน", w[1], { bold: true, fill: STEP_FILL, align: AlignmentType.CENTER }),
      cell("เสาวัน (ดิถี)", w[2], { bold: true, fill: STEP_FILL, align: AlignmentType.CENTER }),
      cell("เสายาม", w[3], { bold: true, fill: STEP_FILL, align: AlignmentType.CENTER }),
    ]}),
    new TableRow({ children: [
      cell(example.pillars.year, w[0], { align: AlignmentType.CENTER, size: 24 }),
      cell(example.pillars.month, w[1], { align: AlignmentType.CENTER, size: 24 }),
      cell(example.pillars.day, w[2], { align: AlignmentType.CENTER, size: 24, bold: true }),
      cell(example.pillars.hour, w[3], { align: AlignmentType.CENTER, size: 24 }),
    ]}),
  ];
  children.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: w, rows }));
}
children.push(p(`ดิถี: ${example.dayMaster} (ธาตุดิน) • กำลังดิถี: ${example.strength} • ธาตุที่ดวงต้องการเด่น: น้ำ / ขาด: ไฟ`,
  { size: 19, color: "555555", before: 80, after: 160 }));
children.push(p("ด้านล่างคือบล็อก “วิธีการอ่าน” ที่ engine สร้างจริงรายบทสำหรับดวงนี้ (ตรงกับที่แสดงบนการ์ดในแอป)",
  { size: 18, color: "777777", after: 160 }));

function renderMethodLine(line) {
  // step header: "ขั้นที่ N (...)..." → bold shaded paragraph
  if (/^ขั้นที่ /.test(line)) {
    return [new Paragraph({
      spacing: { before: 100, after: 50 },
      shading: { fill: STEP_FILL, type: ShadingType.CLEAR },
      children: [new TextRun({ text: line, bold: true, size: 18, font: FONT })],
    })];
  }
  // "หลักการอ่าน: ..." → label line
  if (/^หลักการอ่าน:/.test(line)) {
    return [new Paragraph({ spacing: { after: 50 },
      children: [new TextRun({ text: line, bold: true, size: 19, color: "1F3864", font: FONT })] })];
  }
  // "อ่าน ...": role-reading hint → colored
  if (/^อ่าน /.test(line)) {
    return [new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 40 },
      children: [new TextRun({ text: line, size: 18, color: "7030A0", font: FONT })] })];
  }
  // sub-bullets "  • ..." possibly multi-line (split on \n)
  const cleaned = line.replace(/^\s*•\s*/, "");
  return cleaned.split("\n").map((seg) =>
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 40 },
      children: [new TextRun({ text: seg.trim(), size: 18, color: "444444", font: FONT })] })
  );
}

example.topics.forEach((t) => {
  children.push(new Paragraph({ spacing: { before: 160, after: 40 },
    children: [new TextRun({ text: `บท ${t.chapter}. ${t.title}`, bold: true, size: 22, color: "1F3864", font: FONT })] }));
  t.method.forEach((line) => {
    for (const para of renderMethodLine(line)) children.push(para);
  });
});

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  numbering: {
    config: [
      { reference: "bullets", levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 480, hanging: 240 } } },
      }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "วิธีการอ่านดวงรายบท  •  หน้า ", font: FONT, size: 16, color: "888888" }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: "888888" }),
        ],
      })] }),
    },
    children,
  }],
});

const out = path.join(__dirname, "วิธีการอ่านดวงรายบท.docx");
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log("WROTE", out); });
