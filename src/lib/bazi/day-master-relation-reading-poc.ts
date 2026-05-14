import { createHash } from "node:crypto";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { getCanonicalFivePhaseRelationLabel } from "@/lib/bazi/lexicon/school-lexicon";
import {
  BRANCH_HIDDEN_STEMS,
  BRANCH_LABELS_TH,
  BRANCH_TO_ELEMENT,
  ELEMENT_LABELS_TH,
  GENERATES,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import { getGeminiApiKey } from "@/lib/env";
import type { CalculatedStateValue, RawInputValue, SupportedElementValue } from "@/lib/bazi/schema-types";

export const DEFAULT_DAY_MASTER_RELATION_POC_MODEL = "gemini-3-flash-preview";

const FORBIDDEN_READING_TERMS = [
  "payload",
  "schema",
  "json",
  "model",
  "ai",
  "enum",
  "debug",
  "ครับ",
  "ค่ะ",
] as const;
const ENGLISH_SCENE_KEY_PATTERN = /[A-Za-z_]/;

const PILLAR_SEQUENCE = ["year", "month", "day", "hour"] as const;
const RELATION_SEQUENCE = ["output", "resource", "same", "power", "wealth"] as const;
const PILLAR_LABELS = {
  year: "ปี",
  month: "เดือน",
  day: "วัน",
  hour: "ยาม",
} as const;
const PILLAR_DOMAIN_CONTEXT = {
  year: "สังคม วัยเด็ก ผู้ใหญ่",
  month: "ธุรกิจ องค์กร ครอบครัวฐานใหญ่",
  day: "ตัวตน คู่ครอง พื้นที่ชีวิตใกล้ตัว",
  hour: "ลูก บริวาร ผลงาน สิ่งที่สร้างภายหลัง",
} as const;
const LAYER_LABELS = {
  stem: "ฟ้า",
  branch: "ดิน",
  hidden: "แฝง",
} as const;

const RelationKeySchema = z.enum(["same", "resource", "output", "power", "wealth"]);

const RelationTargetSchema = z.object({
  carrierKey: z.string().trim().min(1),
  pillarKey: z.enum(PILLAR_SEQUENCE),
  pillarLabelThai: z.string().trim().min(1),
  layer: z.enum(["stem", "branch", "hidden"]),
  layerLabelThai: z.string().trim().min(1),
  symbol: z.string().trim().min(1),
  symbolThai: z.string().trim().min(1),
  element: z.enum(["wood", "fire", "earth", "metal", "water"]),
  elementLabelThai: z.string().trim().min(1),
  relationKey: RelationKeySchema,
  relationLabelThai: z.string().trim().min(1),
  contextThai: z.string().trim().min(1),
  evidence: z.string().trim().min(1),
  weight: z.number().int().nonnegative(),
});

const RelationSummarySchema = z.object({
  relationKey: RelationKeySchema,
  relationLabelThai: z.string().trim().min(1),
  targetElement: z.enum(["wood", "fire", "earth", "metal", "water"]),
  targetElementLabelThai: z.string().trim().min(1),
  carrierSummaryThai: z.string().trim().min(1),
  strongestCarrierThai: z.string().trim().min(1),
  targetCount: z.number().int().nonnegative(),
});

const EightSlotRowSchema = z.object({
  slotKey: z.string().trim().min(1),
  positionLabelThai: z.string().trim().min(1),
  layerLabelThai: z.string().trim().min(1),
  symbol: z.string().trim().min(1),
  symbolThai: z.string().trim().min(1),
  element: z.enum(["wood", "fire", "earth", "metal", "water"]),
  elementLabelThai: z.string().trim().min(1),
  relationLabelThai: z.string().trim().min(1),
  hiddenStemSummaryThai: z.string().trim().min(1),
  contextThai: z.string().trim().min(1),
});

export const RelationReadingPacketSchema = z.object({
  version: z.literal("bazi-relation-poc-v1"),
  mode: z.literal("day-master-first"),
  chartAnchor: z.object({
    dayMasterStem: z.string().trim().min(1),
    dayMasterElement: z.enum(["wood", "fire", "earth", "metal", "water"]),
    dayMasterElementLabelThai: z.string().trim().min(1),
    dayMasterStrengthLabelThai: z.string().trim().min(1),
    activeRelationKey: RelationKeySchema,
    activeRelationLabelThai: z.string().trim().min(1),
    activeTargetElement: z.enum(["wood", "fire", "earth", "metal", "water"]),
    activeTargetElementLabelThai: z.string().trim().min(1),
  }),
  eightSlots: z.array(EightSlotRowSchema).length(8),
  relationSummary: z.array(RelationSummarySchema).length(5),
  activeRelationTargets: z.array(RelationTargetSchema).min(1),
  evidenceLines: z.array(z.string().trim().min(1)).min(3),
});

const RelationSceneSchema = z.object({
  scene_key: z.string().trim().min(1),
  fact_sentence: z.string().trim().min(1),
  bridge_sentence: z.string().trim().min(1),
  interpretation: z.string().trim().min(1),
  risk_or_advice: z.string().trim().min(1),
});

export const RelationReadingResponseSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  scenes: z.array(RelationSceneSchema).min(2).max(4),
  closing_reading: z.string().trim().min(1),
}).superRefine((response, context) => {
  const fields = [
    response.title,
    response.summary,
    response.closing_reading,
    ...response.scenes.flatMap((scene) => [
      scene.scene_key,
      scene.fact_sentence,
      scene.bridge_sentence,
      scene.interpretation,
      scene.risk_or_advice,
    ]),
  ];

  for (const field of fields) {
    const normalized = field.toLowerCase();
    for (const forbiddenTerm of FORBIDDEN_READING_TERMS) {
      if (normalized.includes(forbiddenTerm)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Forbidden reading term detected: ${forbiddenTerm}`,
        });
      }
    }
  }

  response.scenes.forEach((scene, index) => {
    if (ENGLISH_SCENE_KEY_PATTERN.test(scene.scene_key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scenes", index, "scene_key"],
        message: "Scene heading must stay Thai-only on the visible surface.",
      });
    }
  });
});

const RELATION_READING_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    scenes: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          scene_key: { type: "string" },
          fact_sentence: { type: "string" },
          bridge_sentence: { type: "string" },
          interpretation: { type: "string" },
          risk_or_advice: { type: "string" },
        },
        required: ["scene_key", "fact_sentence", "bridge_sentence", "interpretation", "risk_or_advice"],
      },
    },
    closing_reading: { type: "string" },
  },
  required: ["title", "summary", "scenes", "closing_reading"],
} as const;

export type RelationReadingPacket = z.infer<typeof RelationReadingPacketSchema>;
export type RelationReadingResponse = z.infer<typeof RelationReadingResponseSchema>;

type RelationKey = z.infer<typeof RelationKeySchema>;
type PillarKey = (typeof PILLAR_SEQUENCE)[number];

function buildSeed(rawInput: RawInputValue) {
  const digest = createHash("sha256")
    .update(JSON.stringify(rawInput))
    .digest();

  return digest.readUInt32BE(0) % 2_147_483_647;
}

function getStemElement(stem: string): SupportedElementValue {
  return (STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT] ?? "wood") as SupportedElementValue;
}

function getBranchElement(branch: string): SupportedElementValue {
  return (BRANCH_TO_ELEMENT[branch as keyof typeof BRANCH_TO_ELEMENT] ?? "wood") as SupportedElementValue;
}

function getElementLabelThai(element: SupportedElementValue) {
  return ELEMENT_LABELS_TH[element];
}

function getRelationKey(dayMasterElement: SupportedElementValue, targetElement: SupportedElementValue): RelationKey {
  if (dayMasterElement === targetElement) {
    return "same";
  }

  if (GENERATES[targetElement] === dayMasterElement) {
    return "resource";
  }

  if (GENERATES[dayMasterElement] === targetElement) {
    return "output";
  }

  if (targetElement === "wood" && dayMasterElement === "earth"
    || targetElement === "earth" && dayMasterElement === "water"
    || targetElement === "water" && dayMasterElement === "fire"
    || targetElement === "fire" && dayMasterElement === "metal"
    || targetElement === "metal" && dayMasterElement === "wood") {
    return "power";
  }

  return "wealth";
}

function getTargetElementByRelation(dayMasterElement: SupportedElementValue, relationKey: RelationKey): SupportedElementValue {
  switch (relationKey) {
    case "same":
      return dayMasterElement;
    case "resource":
      return Object.entries(GENERATES).find(([, generated]) => generated === dayMasterElement)?.[0] as SupportedElementValue;
    case "output":
      return GENERATES[dayMasterElement];
    case "power":
      return Object.entries({ wood: "earth", earth: "water", water: "fire", fire: "metal", metal: "wood" }).find(([, controlled]) => controlled === dayMasterElement)?.[0] as SupportedElementValue;
    case "wealth":
      return { wood: "earth", earth: "water", water: "fire", fire: "metal", metal: "wood" }[dayMasterElement] as SupportedElementValue;
  }
}

function getHiddenStemSummary(branch: string) {
  const hiddenStems = Array.from(
    BRANCH_HIDDEN_STEMS[branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? [],
  );
  if (hiddenStems.length === 0) {
    return "-";
  }

  return hiddenStems
    .map((stem) => `${stem}(${getElementLabelThai(getStemElement(stem))})`)
    .join(", ");
}

function getSymbolThaiForBranch(branch: string) {
  return BRANCH_LABELS_TH[branch as keyof typeof BRANCH_LABELS_TH] ?? branch;
}

function getPositionLabelThai(pillarKey: PillarKey, layer: "stem" | "branch") {
  return `${PILLAR_LABELS[pillarKey]}${layer === "stem" ? "บน" : "ล่าง"}`;
}

function getCarrierWeight(layer: "stem" | "branch" | "hidden", pillarKey: PillarKey) {
  const layerWeight = { stem: 0, branch: 1, hidden: 2 }[layer];
  const pillarWeight = { day: 0, month: 1, hour: 2, year: 3 }[pillarKey];
  return pillarWeight * 10 + layerWeight;
}

function buildEightSlotRows(calculatedState: CalculatedStateValue) {
  const dayMasterElement = getStemElement(calculatedState.dayMaster);

  return PILLAR_SEQUENCE.flatMap((pillarKey) => {
    const pillar = calculatedState.fourPillars[pillarKey];
    const stemElement = getStemElement(pillar.stem);
    const branchElement = getBranchElement(pillar.branch);

    return [
      {
        slotKey: `${pillarKey}-stem`,
        positionLabelThai: getPositionLabelThai(pillarKey, "stem"),
        layerLabelThai: LAYER_LABELS.stem,
        symbol: pillar.stem,
        symbolThai: pillar.stem,
        element: stemElement,
        elementLabelThai: getElementLabelThai(stemElement),
        relationLabelThai: getCanonicalFivePhaseRelationLabel(getRelationKey(dayMasterElement, stemElement)),
        hiddenStemSummaryThai: "-",
        contextThai: PILLAR_DOMAIN_CONTEXT[pillarKey],
      },
      {
        slotKey: `${pillarKey}-branch`,
        positionLabelThai: getPositionLabelThai(pillarKey, "branch"),
        layerLabelThai: LAYER_LABELS.branch,
        symbol: pillar.branch,
        symbolThai: getSymbolThaiForBranch(pillar.branch),
        element: branchElement,
        elementLabelThai: getElementLabelThai(branchElement),
        relationLabelThai: getCanonicalFivePhaseRelationLabel(getRelationKey(dayMasterElement, branchElement)),
        hiddenStemSummaryThai: getHiddenStemSummary(pillar.branch),
        contextThai: PILLAR_DOMAIN_CONTEXT[pillarKey],
      },
    ];
  });
}

function buildRelationTargets(calculatedState: CalculatedStateValue) {
  const dayMasterElement = getStemElement(calculatedState.dayMaster);
  const targets: Array<z.infer<typeof RelationTargetSchema>> = [];

  for (const pillarKey of PILLAR_SEQUENCE) {
    const pillar = calculatedState.fourPillars[pillarKey];
    const visibleStemElement = getStemElement(pillar.stem);
    targets.push({
      carrierKey: `${pillarKey}-stem`,
      pillarKey,
      pillarLabelThai: getPositionLabelThai(pillarKey, "stem"),
      layer: "stem",
      layerLabelThai: LAYER_LABELS.stem,
      symbol: pillar.stem,
      symbolThai: pillar.stem,
      element: visibleStemElement,
      elementLabelThai: getElementLabelThai(visibleStemElement),
      relationKey: getRelationKey(dayMasterElement, visibleStemElement),
      relationLabelThai: getCanonicalFivePhaseRelationLabel(getRelationKey(dayMasterElement, visibleStemElement)),
      contextThai: PILLAR_DOMAIN_CONTEXT[pillarKey],
      evidence: `${getPositionLabelThai(pillarKey, "stem")}มี ${pillar.stem} ธาตุ${getElementLabelThai(visibleStemElement)}`,
      weight: getCarrierWeight("stem", pillarKey),
    });

    const visibleBranchElement = getBranchElement(pillar.branch);
    targets.push({
      carrierKey: `${pillarKey}-branch`,
      pillarKey,
      pillarLabelThai: getPositionLabelThai(pillarKey, "branch"),
      layer: "branch",
      layerLabelThai: LAYER_LABELS.branch,
      symbol: pillar.branch,
      symbolThai: getSymbolThaiForBranch(pillar.branch),
      element: visibleBranchElement,
      elementLabelThai: getElementLabelThai(visibleBranchElement),
      relationKey: getRelationKey(dayMasterElement, visibleBranchElement),
      relationLabelThai: getCanonicalFivePhaseRelationLabel(getRelationKey(dayMasterElement, visibleBranchElement)),
      contextThai: PILLAR_DOMAIN_CONTEXT[pillarKey],
      evidence: `${getPositionLabelThai(pillarKey, "branch")}มี ${pillar.branch} (${getSymbolThaiForBranch(pillar.branch)}) ธาตุ${getElementLabelThai(visibleBranchElement)}`,
      weight: getCarrierWeight("branch", pillarKey),
    });

    for (const hiddenStem of pillar.hiddenStems ?? BRANCH_HIDDEN_STEMS[pillar.branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? []) {
      const hiddenElement = getStemElement(hiddenStem);
      targets.push({
        carrierKey: `${pillarKey}-hidden-${hiddenStem}`,
        pillarKey,
        pillarLabelThai: `${PILLAR_LABELS[pillarKey]}ล่างแฝง`,
        layer: "hidden",
        layerLabelThai: LAYER_LABELS.hidden,
        symbol: hiddenStem,
        symbolThai: hiddenStem,
        element: hiddenElement,
        elementLabelThai: getElementLabelThai(hiddenElement),
        relationKey: getRelationKey(dayMasterElement, hiddenElement),
        relationLabelThai: getCanonicalFivePhaseRelationLabel(getRelationKey(dayMasterElement, hiddenElement)),
        contextThai: PILLAR_DOMAIN_CONTEXT[pillarKey],
        evidence: `${PILLAR_LABELS[pillarKey]}ล่างซ่อน ${hiddenStem} ธาตุ${getElementLabelThai(hiddenElement)}`,
        weight: getCarrierWeight("hidden", pillarKey),
      });
    }
  }

  return targets.sort((left, right) => left.weight - right.weight || left.carrierKey.localeCompare(right.carrierKey));
}

function summarizeCarriers(targets: Array<z.infer<typeof RelationTargetSchema>>) {
  if (targets.length === 0) {
    return "ไม่พบ";
  }

  return targets
    .map((target) => `${target.pillarLabelThai} ${target.symbol}`)
    .join(", ");
}

export function buildDayMasterRelationPacket(calculatedState: CalculatedStateValue) {
  const dayMasterElement = getStemElement(calculatedState.dayMaster);
  const allTargets = buildRelationTargets(calculatedState);
  const activeRelationKey: RelationKey = "output";
  const relationSummary = RELATION_SEQUENCE.map((relationKey) => {
    const relationTargets = allTargets.filter((target) => target.relationKey === relationKey);
    const targetElement = getTargetElementByRelation(dayMasterElement, relationKey);
    const strongestCarrier = relationTargets[0];

    return {
      relationKey,
      relationLabelThai: getCanonicalFivePhaseRelationLabel(relationKey),
      targetElement,
      targetElementLabelThai: getElementLabelThai(targetElement),
      carrierSummaryThai: summarizeCarriers(relationTargets),
      strongestCarrierThai: strongestCarrier ? `${strongestCarrier.pillarLabelThai} ${strongestCarrier.symbol}` : "ไม่พบ",
      targetCount: relationTargets.length,
    };
  });

  const activeRelationTargets = allTargets.filter((target) => target.relationKey === activeRelationKey);
  const strengthLabel = calculatedState.dayMasterStrengthProfile?.displayLabel
    ?? calculatedState.dayMasterStrengthProfile?.strengthState
    ?? "ยังไม่มีคำอธิบายกำลังดวง";

  return RelationReadingPacketSchema.parse({
    version: "bazi-relation-poc-v1",
    mode: "day-master-first",
    chartAnchor: {
      dayMasterStem: calculatedState.dayMaster,
      dayMasterElement,
      dayMasterElementLabelThai: getElementLabelThai(dayMasterElement),
      dayMasterStrengthLabelThai: strengthLabel,
      activeRelationKey,
      activeRelationLabelThai: getCanonicalFivePhaseRelationLabel(activeRelationKey),
      activeTargetElement: getTargetElementByRelation(dayMasterElement, activeRelationKey),
      activeTargetElementLabelThai: getElementLabelThai(getTargetElementByRelation(dayMasterElement, activeRelationKey)),
    },
    eightSlots: buildEightSlotRows(calculatedState),
    relationSummary,
    activeRelationTargets,
    evidenceLines: [
      `ดิถี ${calculatedState.dayMaster} เป็นธาตุ${getElementLabelThai(dayMasterElement)}`,
      `เปิดการอ่านที่ ${getCanonicalFivePhaseRelationLabel(activeRelationKey)} ไปหา${getElementLabelThai(getTargetElementByRelation(dayMasterElement, activeRelationKey))}`,
      `พบเป้าหมายของ ${getCanonicalFivePhaseRelationLabel(activeRelationKey)} ทั้งหมด ${activeRelationTargets.length} จุด`,
    ],
  });
}

function renderTable(headers: string[], rows: string[][]) {
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...rows.map((row) => (row[index] ?? "").length),
  ));
  const renderRow = (cells: string[]) => `| ${cells.map((cell, index) => cell.padEnd(widths[index])).join(" | ")} |`;
  const separator = `|-${widths.map((width) => "-".repeat(width)).join("-|-" )}-|`;

  return [renderRow(headers), separator, ...rows.map(renderRow)].join("\n");
}

function formatEightSlotTable(packet: RelationReadingPacket) {
  return renderTable(
    ["ตำแหน่ง", "ชั้น", "จีน", "ไทย", "ธาตุ", "relation ต่อดิถี", "ธาตุแฝง", "บริบท"],
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
    ["relation", "ธาตุที่มองหา", "พบตรงไหนบ้าง", "จุดเด่น", "จำนวน"],
    packet.relationSummary.map((row) => [
      row.relationLabelThai,
      row.targetElementLabelThai,
      row.carrierSummaryThai,
      row.strongestCarrierThai,
      String(row.targetCount),
    ]),
  );
}

function formatActiveRelationTable(packet: RelationReadingPacket) {
  return renderTable(
    ["ลำดับ", "ไปออกที่", "ชั้น", "ธาตุ", "หลักฐาน", "บริบท"],
    packet.activeRelationTargets.map((target, index) => [
      String(index + 1),
      `${target.pillarLabelThai} ${target.symbol}`,
      target.layerLabelThai,
      target.elementLabelThai,
      target.evidence,
      target.contextThai,
    ]),
  );
}

function formatVisibleSceneHeading(sceneKey: string, index: number) {
  const normalized = sceneKey.trim();
  if (!normalized || ENGLISH_SCENE_KEY_PATTERN.test(normalized)) {
    return `ประเด็นที่ ${index + 1}`;
  }

  return `ประเด็นที่ ${index + 1}: ${normalized}`;
}

export function buildDayMasterRelationPocSystemInstruction() {
  return [
    "You are a senior Thai Bazi master writing a client-facing relation reading from a deterministic packet.",
    "Write every field in Thai.",
    "You must never invent or recalculate facts beyond the packet.",
    "Read the packet in this order only: day master -> active relation -> targets -> life meaning.",
    "Keep relation logic separate from life-domain meaning.",
    "Every scene must contain a fact sentence, a bridge sentence, an interpretation sentence, and a risk or advice sentence.",
    "The scene_key is a short Thai heading for the visible report only. Never use English words, transliteration, snake_case, or section codes.",
    "If evidence is thin, say less instead of inventing.",
    "Do not mention JSON, schema, payload, model, AI, enum, or debug language.",
    "Do not write in generic assistant tone such as saying this is an analysis, output, response, or generated text.",
    "Do not use polite particles such as ครับ or ค่ะ.",
    "Return 2 to 4 scenes and make them read like a real sinsae explanation.",
    "Return JSON only.",
  ].join(" ");
}

export function buildDayMasterRelationPocUserPrompt(rawInput: RawInputValue, packet: RelationReadingPacket) {
  return [
    "Create one Thai relation reading from the deterministic packet below.",
    "Use the visible flow: fact -> bridge -> scene -> risk.",
    "Use the active relation as the main opening path.",
    "Keep the wording school-faithful and client-readable.",
    "Keep every visible heading in Thai only, especially scene_key.",
    "Do not leak English scene identifiers, snake_case labels, or generic assistant wording onto the visible surface.",
    "Do not use developer wording.",
    "Do not invent health, timing, marriage, or money claims unless they are directly supported by the packet.",
    "Return exactly the JSON shape requested by the system instruction.",
    "",
    "Raw input:",
    JSON.stringify(rawInput, null, 2),
    "",
    "Relation reading packet:",
    JSON.stringify(packet, null, 2),
  ].join("\n");
}

export function formatDayMasterRelationPocPreflightReport(options: {
  rawInput: RawInputValue;
  packet: RelationReadingPacket;
}) {
  return [
    "=== รายงานเตรียมอ่านความสัมพันธ์ของดิถี ===",
    "",
    "แกนหลักของดวง",
    `- วันเกิด: ${options.rawInput.birthDate} เวลา ${options.rawInput.birthTime}`,
    `- ดิถี: ${options.packet.chartAnchor.dayMasterStem} ธาตุ${options.packet.chartAnchor.dayMasterElementLabelThai}`,
    `- กำลังดวง: ${options.packet.chartAnchor.dayMasterStrengthLabelThai}`,
    `- ธาตุสัมพันธ์ที่ใช้เปิดการอ่าน: ${options.packet.chartAnchor.activeRelationLabelThai}`,
    "",
    "ตาราง 8 ช่อง",
    formatEightSlotTable(options.packet),
    "",
    "ตาราง relation ของดิถี",
    formatRelationSummaryTable(options.packet),
    "",
    `รายละเอียด${options.packet.chartAnchor.activeRelationLabelThai}`,
    formatActiveRelationTable(options.packet),
    "",
    "สัญญาณที่ใช้ยึดในการอ่าน",
    ...options.packet.evidenceLines.map((line) => `- ${line}`),
  ].join("\n");
}

export function formatDayMasterRelationPocGeneratedReport(options: {
  rawInput: RawInputValue;
  packet: RelationReadingPacket;
  response: RelationReadingResponse;
  model: string;
}) {
  return [
    "=== รายงานอ่านความสัมพันธ์แบบซินแส ===",
    "",
    "แกนหลักของดวง",
    `- วันเกิด: ${options.rawInput.birthDate} เวลา ${options.rawInput.birthTime}`,
    `- ดิถี: ${options.packet.chartAnchor.dayMasterStem} ธาตุ${options.packet.chartAnchor.dayMasterElementLabelThai}`,
    `- กำลังดวง: ${options.packet.chartAnchor.dayMasterStrengthLabelThai}`,
    `- ธาตุสัมพันธ์ที่ใช้เปิดการอ่าน: ${options.packet.chartAnchor.activeRelationLabelThai}`,
    "",
    "ตาราง 8 ช่อง",
    formatEightSlotTable(options.packet),
    "",
    "ตาราง relation ของดิถี",
    formatRelationSummaryTable(options.packet),
    "",
    `รายละเอียด${options.packet.chartAnchor.activeRelationLabelThai}`,
    formatActiveRelationTable(options.packet),
    "",
    "คำอธิบายแบบซินแส",
    options.response.title,
    options.response.summary,
    ...options.response.scenes.flatMap((scene, index) => [
      formatVisibleSceneHeading(scene.scene_key, index),
      `   ${scene.fact_sentence}`,
      `   ${scene.bridge_sentence}`,
      `   ${scene.interpretation}`,
      `   ${scene.risk_or_advice}`,
    ]),
    "",
    "คำทำนายพร้อมส่งลูกค้า",
    options.response.closing_reading,
    "",
    "ภาคผนวกเทคนิค",
    `- รุ่นที่ใช้: ${options.model}`,
  ].join("\n");
}

export async function generateDayMasterRelationReadingPoc(options: {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  apiKey?: string;
  model?: string;
}) {
  const apiKey = options.apiKey ?? getGeminiApiKey();
  const model = options.model?.trim() || DEFAULT_DAY_MASTER_RELATION_POC_MODEL;
  const packet = buildDayMasterRelationPacket(options.calculatedState);
  const prompt = buildDayMasterRelationPocUserPrompt(options.rawInput, packet);
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: buildDayMasterRelationPocSystemInstruction(),
      responseMimeType: "application/json",
      responseJsonSchema: RELATION_READING_RESPONSE_JSON_SCHEMA,
      temperature: 0.35,
      seed: buildSeed(options.rawInput),
    },
  });
  const responseText = response.text?.trim();

  if (!responseText) {
    throw new Error("Gemini returned an empty relation reading response.");
  }

  return {
    model,
    packet,
    response: RelationReadingResponseSchema.parse(JSON.parse(responseText) as unknown),
  };
}
