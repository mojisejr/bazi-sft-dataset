import { type RelationReadingPacket } from "@/lib/bazi/day-master-relation-reading-packet";
import {
  type RelationReadingResponse,
} from "@/lib/bazi/day-master-relation-reading-generator";
import {
  type DayMasterRelationBrief,
} from "@/lib/bazi/day-master-relation-reading-interpretation";
import {
  type RawInputValue,
} from "@/lib/bazi/schema-types";

const ENGLISH_SCENE_KEY_PATTERN = /[A-Za-z_]/;

function formatGenderThai(gender: string) {
  return gender === "female" ? "หญิง" : gender === "male" ? "ชาย" : gender;
}

function formatProvinceThai(province: string) {
  return province === "Bangkok" ? "กรุงเทพมหานคร" : province;
}

function renderTable(headers: string[], rows: string[][]) {
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...rows.map((row) => (row[index] ?? "").length),
  ));
  const renderRow = (cells: string[]) => `| ${cells.map((cell, index) => cell.padEnd(widths[index])).join(" | ")} |`;
  const separator = `|-${widths.map((width) => "-".repeat(width)).join("-|-")}-|`;

  return [renderRow(headers), separator, ...rows.map(renderRow)].join("\n");
}

function formatEightSlotTable(packet: RelationReadingPacket) {
  return renderTable(
    ["ตำแหน่ง", "ชั้น", "จีน", "ไทย", "ธาตุ (ขั้ว)", "relation ต่อดิถี", "ธาตุแฝง", "บริบท"],
    packet.eightSlots.map((row) => [
      row.positionLabelThai,
      row.layerLabelThai,
      row.symbol,
      row.symbolThai,
      row.elementLabelThai,
      row.relationLabelThai,
      row.hiddenStemSummaryThai,
      row.contextThai,
    ]),
  );
}

function formatRelationSummaryTable(packet: RelationReadingPacket) {
  return renderTable(
    ["relation", "ความหมาย", "ธาตุที่มองหา", "พบตรงไหนบ้าง", "จุดเด่น", "จำนวน"],
    packet.relationSummary.map((row) => [
      row.relationLabelThai,
      row.semanticMeaningThai,
      row.targetElementLabelThai,
      row.carrierSummaryThai,
      row.strongestCarrierThai,
      String(row.targetCount),
    ]),
  );
}

function formatEvidenceCatalog(packet: RelationReadingPacket, evidenceIds: string[]) {
  return evidenceIds.map((evidenceId) => {
    const evidence = packet.evidenceCatalog.find((entry) => entry.id === evidenceId);
    if (!evidence) {
      return `- [${evidenceId}] ไม่มีหลักฐานที่ map ได้`;
    }

    return `- [${evidence.id}] ${evidence.labelThai}: ${evidence.detailThai}`;
  });
}

function formatVisibleStepHeading(stepNumber: number, headingThai: string) {
  const normalized = headingThai.trim();
  if (!normalized || ENGLISH_SCENE_KEY_PATTERN.test(normalized)) {
    return `ขั้นที่ ${stepNumber}`;
  }

  return `ขั้นที่ ${stepNumber}: ${normalized}`;
}

export function formatDayMasterRelationPocPreflightReport(options: {
  rawInput: RawInputValue;
  packet: RelationReadingPacket;
  maxVisibleStep?: number;
}) {
  const visibleSteps = options.packet.stepInsights
    .filter((step) => !options.maxVisibleStep || step.stepNumber <= options.maxVisibleStep);
  return [
    "=== รายงานตรวจฐานคำนวณแบบ Stepwise ===",
    "",
    "ข้อมูลนำเข้า",
    `- วันเกิด: ${options.rawInput.birthDate} เวลา ${options.rawInput.birthTime}`,
    `- เพศ: ${formatGenderThai(options.rawInput.gender)}`,
    `- จังหวัด: ${formatProvinceThai(options.rawInput.province)}`,
    `- ระบบปฏิทิน: ${options.rawInput.calendarSystem ?? "solar"}`,
    `- เขตเวลา: ${options.rawInput.timezone ?? "Asia/Bangkok"}`,
    "",
    "แกนดวงที่ใช้เป็นจุดตั้งต้น",
    `- ดิถี: ${options.packet.chartAnchor.dayMasterStem} ธาตุ${options.packet.chartAnchor.dayMasterElementLabelThai}`,
    `- กำลังดวง: ${options.packet.chartAnchor.dayMasterStrengthLabelThai} (คะแนน: ${options.packet.chartAnchor.dayMasterStrengthScore.toFixed(2)})`,
    `- หลักวันราศีล่าง: ${options.packet.chartAnchor.dayBranch} (${options.packet.chartAnchor.dayBranchLabelThai})`,
    "",
    ...visibleSteps.flatMap((step) => [
      `Step ${step.stepNumber}: ${step.titleThai}`,
      `- สรุป: ${step.summaryThai}`,
      `- จุดที่ใช้ตรวจ: ${step.auditFocusThai}`,
      ...formatEvidenceCatalog(options.packet, step.evidenceIds),
      "",
    ]),
    "ตาราง 8 ช่อง",
    formatEightSlotTable(options.packet),
    "",
    "ตาราง relation ของดิถี",
    formatRelationSummaryTable(options.packet),
  ].join("\n");
}

export function formatDayMasterRelationPocBriefPreview(options: {
  rawInput: RawInputValue;
  brief: DayMasterRelationBrief;
  model?: string;
  maxVisibleStep?: number;
}) {
  const visibleSteps = options.brief.steps
    .filter((step) => !options.maxVisibleStep || step.stepNumber <= options.maxVisibleStep);

  return [
    "=== คู่มือชั้นคำอ่านสำหรับ LLM ===",
    "",
    `- วันเกิด: ${options.rawInput.birthDate} เวลา ${options.rawInput.birthTime}`,
    `- ดิถี: ${options.brief.chartAnchor.dayMasterStem} ธาตุ${options.brief.chartAnchor.dayMasterElementLabelThai}`,
    `- กำลังดวง: ${options.brief.chartAnchor.dayMasterStrengthLabelThai} (คะแนน: ${options.brief.chartAnchor.dayMasterStrengthScore.toFixed(2)})`,
    `- หลักวันราศีล่าง: ${options.brief.chartAnchor.dayBranchLabelThai}`,
    `- หลักการเปิดอ่าน: ${options.brief.openingDoctrineThai}`,
    ...(options.model ? [`- รุ่นที่ใช้: ${options.model}`] : []),
    "",
    ...visibleSteps.flatMap((step) => [
      `Step ${step.stepNumber}: ${step.titleThai}`,
      `- brief: ${step.briefThai}`,
      `- evidence refs: ${step.evidenceRefs.join(", ")}`,
      ...step.evidenceLines.map((line) => `  - ${line}`),
      "",
    ]),
  ].join("\n");
}

export function formatDayMasterRelationPocGeneratedReport(options: {
  rawInput: RawInputValue;
  packet: RelationReadingPacket;
  brief: DayMasterRelationBrief;
  response: RelationReadingResponse;
  model: string;
  includeAuditAppendix?: boolean;
  includeBriefPreview?: boolean;
  maxVisibleStep?: number;
}) {
  const visibleReadings = options.response.step_readings
    .filter((step) => !options.maxVisibleStep || step.step_number <= options.maxVisibleStep);
  const visibleInsights = options.packet.stepInsights
    .filter((step) => !options.maxVisibleStep || step.stepNumber <= options.maxVisibleStep);

  return [
    "=== รายงานอ่านดวงแบบซินแส Stepwise ===",
    "",
    "ข้อมูลตั้งต้น",
    `- วันเกิด: ${options.rawInput.birthDate} เวลา ${options.rawInput.birthTime}`,
    `- เพศ: ${formatGenderThai(options.rawInput.gender)}`,
    `- จังหวัด: ${formatProvinceThai(options.rawInput.province)}`,
    `- ดิถี: ${options.packet.chartAnchor.dayMasterStem} ธาตุ${options.packet.chartAnchor.dayMasterElementLabelThai}`,
    `- กำลังดวง: ${options.packet.chartAnchor.dayMasterStrengthLabelThai} (คะแนน: ${options.packet.chartAnchor.dayMasterStrengthScore.toFixed(2)})`,
    `- หลักวันราศีล่าง: ${options.packet.chartAnchor.dayBranch} (${options.packet.chartAnchor.dayBranchLabelThai})`,
    "",
    "คำอ่านเปิดดวง",
    options.response.openingSummary,
    "",
    ...visibleReadings.flatMap((step) => [
      formatVisibleStepHeading(step.step_number, step.heading_thai),
      `   ${step.teacher_reading}`,
      `   ความหมายต่อชีวิต: ${step.life_meaning}`,
      `   ข้อควรระวัง: ${step.caution}`,
      "",
    ]),
    "คำอ่านสรุป",
    options.response.closing_reading,
    ...(options.includeBriefPreview
      ? [
          "",
          formatDayMasterRelationPocBriefPreview({
            rawInput: options.rawInput,
            brief: options.brief,
            model: options.model,
          }),
        ]
      : []),
    ...(options.includeAuditAppendix
      ? [
          "",
          "=== คู่มือหลักฐานแบบ Audit Companion ===",
          "",
          ...visibleInsights.flatMap((step) => [
            `Step ${step.stepNumber}: ${step.titleThai}`,
            ...formatEvidenceCatalog(options.packet, step.evidenceIds),
            "",
          ]),
          "ตาราง relation ของดิถี",
          formatRelationSummaryTable(options.packet),
          "",
          `- รุ่นที่ใช้: ${options.model}`,
        ]
      : []),
  ].join("\n");
}