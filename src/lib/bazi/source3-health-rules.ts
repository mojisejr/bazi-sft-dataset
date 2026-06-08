import { z } from "zod";

import { ELEMENT_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";
import type { BaziCallerContract } from "@/lib/bazi/symbolic-engine.caller-contract";
import {
  BaziSharedPacketFamilySchema,
  type BaziSharedPacket,
} from "@/lib/bazi/symbolic-engine.shared-packets";

const SOURCE3_STRENGTH_BAND_IDS = ["very-weak", "weak", "balanced", "strong", "very-strong"] as const;
const SOURCE3_ELEMENT_IDS = ["wood", "fire", "earth", "metal", "water"] as const;
const SOURCE3_ELEMENT_STRENGTH_IDS = ["missing", "weak", "balanced", "strong"] as const;
const SOURCE3_WATCH_BAND_IDS = ["baseline-watch", "heightened-watch", "priority-watch"] as const;
const SOURCE3_CONFLICT_TYPE_IDS = ["clash", "punishment", "harm", "destruction"] as const;
const SOURCE3_PRESSURE_LEVEL_IDS = ["none", "watch", "heightened-watch"] as const;
const SOURCE3_STAGE_SIGNAL_IDS = ["supportive", "mixed", "fragile"] as const;
const SOURCE3_TIMING_SENSITIVITY_IDS = ["background", "watch", "elevated"] as const;
const SOURCE3_TRIGGER_WINDOW_IDS = ["steady-window", "da-yun-watch", "liu-nian-watch", "dual-watch"] as const;
const SOURCE3_CAUTION_TONE_IDS = [
  "calm-watchfulness",
  "active-watchfulness",
  "extra-rest-and-monitor",
] as const;

const Source3StrengthBandSchema = z.enum(SOURCE3_STRENGTH_BAND_IDS);
const Source3ElementSchema = z.enum(SOURCE3_ELEMENT_IDS);
const Source3ElementStrengthSchema = z.enum(SOURCE3_ELEMENT_STRENGTH_IDS);
const Source3WatchBandSchema = z.enum(SOURCE3_WATCH_BAND_IDS);
const Source3ConflictTypeSchema = z.enum(SOURCE3_CONFLICT_TYPE_IDS);
const Source3PressureLevelSchema = z.enum(SOURCE3_PRESSURE_LEVEL_IDS);
const Source3StageSignalSchema = z.enum(SOURCE3_STAGE_SIGNAL_IDS);
const Source3TimingSensitivitySchema = z.enum(SOURCE3_TIMING_SENSITIVITY_IDS);
const Source3TriggerWindowSchema = z.enum(SOURCE3_TRIGGER_WINDOW_IDS);
const Source3CautionToneSchema = z.enum(SOURCE3_CAUTION_TONE_IDS);

const Source3TextureStageSchema = z.object({
  raw: z.string().trim().min(1),
  display: z.string().trim().min(1),
  signal: Source3StageSignalSchema,
});

const Source3WeakElementLaneSchema = z.object({
  element: Source3ElementSchema,
  elementLabel: z.string().trim().min(1),
  sourceStrength: Source3ElementStrengthSchema,
  rooted: z.boolean(),
  seasonalSupport: z.string().trim().min(1),
  weaknessScore: z.number().int().nonnegative(),
  weaknessBand: Source3WatchBandSchema,
  reasons: z.array(z.string().trim().min(1)).min(1),
});

const Source3HealthWeakElementRoutingResultSchema = z.object({
  kind: z.literal("health-weak-element-routing"),
  strengthBandId: Source3StrengthBandSchema,
  strengthState: z.string().trim().min(1),
  chartTexture: z.object({
    monthBranchStage: Source3TextureStageSchema,
    dayBranchStage: Source3TextureStageSchema,
  }),
  primaryWeakElement: Source3ElementSchema,
  weakElements: z.array(Source3WeakElementLaneSchema).min(1),
});

const Source3HealthOrganRiskLaneSchema = z.object({
  element: Source3ElementSchema,
  elementLabel: z.string().trim().min(1),
  organs: z.array(z.string().trim().min(1)).min(1),
  bodySystems: z.array(z.string().trim().min(1)).min(1),
  cautionBand: Source3WatchBandSchema,
  cautionNote: z.string().trim().min(1),
});

const Source3HealthOrganRiskMappingResultSchema = z.object({
  kind: z.literal("health-organ-risk-mapping"),
  primaryWeakElement: Source3ElementSchema,
  riskLanes: z.array(Source3HealthOrganRiskLaneSchema).min(1),
  careBoundary: z.literal("caution-only"),
});

const Source3HealthConflictMarkerSchema = z.object({
  conflictType: Source3ConflictTypeSchema,
  relationLabel: z.string().trim().min(1),
  symbols: z.array(z.string().trim().min(1)).min(1),
  targetedAreas: z.array(z.string().trim().min(1)).min(1),
  cautionBand: Source3WatchBandSchema,
  note: z.string().trim().min(1),
});

const Source3HealthConflictInjuryMarkersResultSchema = z.object({
  kind: z.literal("health-conflict-injury-markers"),
  activeConflictKinds: z.array(Source3ConflictTypeSchema),
  markers: z.array(Source3HealthConflictMarkerSchema),
  pressureLevel: Source3PressureLevelSchema,
  boundaryNote: z.string().trim().min(1),
});

const Source3OptionalTextureStageSchema = Source3TextureStageSchema.nullable();

const Source3BoundedHealthCautionResultSchema = z.object({
  kind: z.literal("bounded-health-caution"),
  baselineWeakness: z.object({
    primaryWeakElement: Source3ElementSchema,
    weakElementCount: z.number().int().positive(),
    conflictMarkerCount: z.number().int().nonnegative(),
  }),
  timingSensitivity: z.object({
    currentDaYunStage: Source3OptionalTextureStageSchema,
    currentLiuNianStage: Source3OptionalTextureStageSchema,
    sensitivityLevel: Source3TimingSensitivitySchema,
    triggerWindow: Source3TriggerWindowSchema,
    note: z.string().trim().min(1),
  }),
  cautionTone: Source3CautionToneSchema,
  guidanceNotes: z.array(z.string().trim().min(1)).min(2),
  forbiddenClaims: z.tuple([
    z.literal("no-diagnosis"),
    z.literal("no-treatment-instruction"),
    z.literal("no-source7-remedy"),
  ]),
  guardrail: z.literal("no-diagnosis-or-remedy"),
});

export const Source3HealthStepResultSchema = z.discriminatedUnion("kind", [
  Source3HealthWeakElementRoutingResultSchema,
  Source3HealthOrganRiskMappingResultSchema,
  Source3HealthConflictInjuryMarkersResultSchema,
  Source3BoundedHealthCautionResultSchema,
]);

export type Source3HealthStepResult = z.infer<typeof Source3HealthStepResultSchema>;
export type Source3HealthStepComputation = {
  packetFamilies: Array<z.infer<typeof BaziSharedPacketFamilySchema>>;
  result: Source3HealthStepResult;
};

type Source3Element = z.infer<typeof Source3ElementSchema>;
type Source3HealthWeakElementRoutingResult = z.infer<typeof Source3HealthWeakElementRoutingResultSchema>;
type Source3HealthConflictInjuryMarkersResult = z.infer<typeof Source3HealthConflictInjuryMarkersResultSchema>;
type Source3HealthOrganRiskMappingResult = z.infer<typeof Source3HealthOrganRiskMappingResultSchema>;

const SUPPORTIVE_STAGES = new Set(["长生", "冠带", "临官", "帝旺"]);
const FRAGILE_STAGES = new Set(["病", "死", "绝"]);

const WEAKNESS_POINTS_BY_STRENGTH: Record<z.infer<typeof Source3ElementStrengthSchema>, number> = {
  missing: 5,
  weak: 4,
  balanced: 2,
  strong: 1,
};

const HEALTH_ELEMENT_ORGAN_POLICY: Record<Source3Element, {
  organs: string[];
  bodySystems: string[];
}> = {
  wood: {
    organs: ["ตับ", "ถุงน้ำดี"],
    bodySystems: ["เส้นเอ็น", "เส้นประสาท", "เส้นผม"],
  },
  fire: {
    organs: ["หัวใจ", "ลำไส้เล็ก"],
    bodySystems: ["ความดัน", "สายตา"],
  },
  earth: {
    organs: ["กระเพาะอาหาร", "ม้าม"],
    bodySystems: ["กล้ามเนื้อ", "กระดูก", "ฟัน"],
  },
  metal: {
    organs: ["ปอด", "ลำไส้ใหญ่"],
    bodySystems: ["ทางเดินหายใจ", "การระบายของเสีย"],
  },
  water: {
    organs: ["ไต", "กระเพาะปัสสาวะ"],
    bodySystems: ["ต่อมต่าง ๆ", "ระบบสืบพันธุ์"],
  },
};

const CONFLICT_SYMBOL_HEALTH_POLICY: Record<string, string[]> = {
  "甲": ["ถุงน้ำดี"],
  "乙": ["ตับ"],
  "丙": ["ลำไส้เล็ก"],
  "丁": ["หัวใจ"],
  "戊": ["กระเพาะอาหาร"],
  "己": ["ม้าม"],
  "庚": ["ลำไส้ใหญ่"],
  "辛": ["ปอด"],
  "壬": ["กระเพาะปัสสาวะ"],
  "癸": ["ไต"],
  "子": ["กระเพาะปัสสาวะ"],
  "丑": ["ม้าม", "ท้อง"],
  "寅": ["ถุงน้ำดี", "ชีพจร"],
  "卯": ["ตับ", "นิ้วมือ"],
  "辰": ["ม้าม", "ไหล่", "หน้าอก"],
  "巳": ["ทวารหนัก", "ฟัน", "ใบหน้า"],
  "午": ["เลือด", "ตา"],
  "未": ["กระเพาะอาหาร"],
  "申": ["ลำไส้ใหญ่", "ปอด"],
  "酉": ["ไขสันหลัง"],
  "戌": ["ก้นกบ", "ขา", "เท้า"],
  "亥": ["ไต", "ถุงอัณฑะ"],
};

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function findPacket<TFamily extends BaziSharedPacket["family"]>(
  packets: readonly BaziSharedPacket[],
  family: TFamily,
): Extract<BaziSharedPacket, { family: TFamily }> {
  const packet = packets.find((candidate) => candidate.family === family);

  if (!packet) {
    throw new Error(`Source 3 rules are missing the ${family} packet.`);
  }

  return packet as Extract<BaziSharedPacket, { family: TFamily }>;
}

function getElementLabel(element: Source3Element) {
  return ELEMENT_LABELS_TH[element] ?? element;
}

function classifyStageSignal(rawStage: string) {
  if (FRAGILE_STAGES.has(rawStage)) {
    return "fragile" as const;
  }

  if (SUPPORTIVE_STAGES.has(rawStage)) {
    return "supportive" as const;
  }

  return "mixed" as const;
}

function buildTextureStage(raw: string, display: string) {
  return Source3TextureStageSchema.parse({
    raw,
    display,
    signal: classifyStageSignal(raw),
  });
}

function buildOptionalTextureStage(raw?: string, display?: string) {
  if (!raw || !display) {
    return null;
  }

  return buildTextureStage(raw, display);
}

function classifyWeaknessBand(score: number, strengthBandId: z.infer<typeof Source3StrengthBandSchema>) {
  if (score >= 6 || ((strengthBandId === "very-weak" || strengthBandId === "weak") && score >= 5)) {
    return "priority-watch" as const;
  }

  if (score >= 5) {
    return "heightened-watch" as const;
  }

  return "baseline-watch" as const;
}

function buildWeakElementRoutingResult(
  _contract: BaziCallerContract,
  packets: readonly BaziSharedPacket[],
): Source3HealthWeakElementRoutingResult {
  const strengthPacket = findPacket(packets, "strength");
  const rolePacket = findPacket(packets, "role-of-element");
  const texturePacket = findPacket(packets, "twelve-qi-texture");
  const strengthProfile = strengthPacket.sections.profile.value;
  const strengthBandId = Source3StrengthBandSchema.parse(strengthProfile.bandId);
  const dominantElements = new Set(rolePacket.sections.elementBalance.value.dominantElements);
  const missingElements = new Set(rolePacket.sections.elementBalance.value.missingElements);

  const candidates = rolePacket.sections.elementBalance.value.elementStrengths
    .filter((entry) => SOURCE3_ELEMENT_IDS.includes(entry.element as Source3Element))
    .map((entry) => {
      const element = Source3ElementSchema.parse(entry.element);
      let weaknessScore = WEAKNESS_POINTS_BY_STRENGTH[Source3ElementStrengthSchema.parse(entry.strength)];
      const reasons = [`${getElementLabel(element)} อยู่ในสถานะ ${entry.strength} จาก element balance.`];

      if (missingElements.has(element)) {
        weaknessScore += 2;
        reasons.push(`ไม่มี ${getElementLabel(element)} ใน element balance ปัจจุบัน.`);
      }

      if (!entry.rooted) {
        weaknessScore += 1;
        reasons.push(`ไม่มีรากรองรับ ${getElementLabel(element)} ในเสาหลัก.`);
      }

      if (entry.seasonalSupport === "seasonal-drained") {
        weaknessScore += 1;
        reasons.push(`${getElementLabel(element)} ถูกฤดูกาลดึงกำลังไว้.`);
      }

      if (entry.seasonalSupport === "seasonal-peak" || entry.seasonalSupport === "seasonal-support") {
        weaknessScore -= 1;
      }

      if (dominantElements.has(element)) {
        weaknessScore -= 1;
      }

      if (strengthBandId === "very-weak" || strengthBandId === "weak") {
        weaknessScore += 1;
      }

      return Source3WeakElementLaneSchema.parse({
        element,
        elementLabel: getElementLabel(element),
        sourceStrength: entry.strength,
        rooted: entry.rooted,
        seasonalSupport: entry.seasonalSupport,
        weaknessScore: Math.max(0, weaknessScore),
        weaknessBand: classifyWeaknessBand(Math.max(0, weaknessScore), strengthBandId),
        reasons,
      });
    })
    .sort((left, right) => {
      if (right.weaknessScore !== left.weaknessScore) {
        return right.weaknessScore - left.weaknessScore;
      }

      return SOURCE3_ELEMENT_IDS.indexOf(left.element) - SOURCE3_ELEMENT_IDS.indexOf(right.element);
    });

  const weakElements = candidates.filter((entry) => entry.weaknessScore >= 4);
  const routedWeakElements = weakElements.length > 0 ? weakElements : candidates.slice(0, 1);

  return Source3HealthWeakElementRoutingResultSchema.parse({
    kind: "health-weak-element-routing",
    strengthBandId,
    strengthState: strengthProfile.sourceState,
    chartTexture: {
      monthBranchStage: buildTextureStage(
        texturePacket.sections.texture.value.raw.monthBranch,
        texturePacket.sections.texture.value.display.monthBranch,
      ),
      dayBranchStage: buildTextureStage(
        texturePacket.sections.texture.value.raw.dayBranch,
        texturePacket.sections.texture.value.display.dayBranch,
      ),
    },
    primaryWeakElement: routedWeakElements[0]?.element ?? candidates[0]?.element,
    weakElements: routedWeakElements,
  });
}

function buildHealthOrganRiskMapResult(
  weakElementRouting: Source3HealthWeakElementRoutingResult,
): Source3HealthOrganRiskMappingResult {
  return Source3HealthOrganRiskMappingResultSchema.parse({
    kind: "health-organ-risk-mapping",
    primaryWeakElement: weakElementRouting.primaryWeakElement,
    riskLanes: weakElementRouting.weakElements.map((lane) => {
      const riskPolicy = HEALTH_ELEMENT_ORGAN_POLICY[lane.element];

      return {
        element: lane.element,
        elementLabel: lane.elementLabel,
        organs: riskPolicy.organs,
        bodySystems: riskPolicy.bodySystems,
        cautionBand: lane.weaknessBand,
        cautionNote: `${lane.elementLabel} อ่อนแรงจึงให้ตีความเป็นจุดเฝ้าระวังของ ${riskPolicy.organs.join(" / ")} ในเชิงแนวโน้ม ไม่ใช่การวินิจฉัยโรค.`,
      };
    }),
    careBoundary: "caution-only",
  });
}

function extractHanSymbols(value: string) {
  return unique(Array.from(value.matchAll(/[\u3400-\u9FFF]/g), (match) => match[0]));
}

function buildConflictMarkersResult(
  packets: readonly BaziSharedPacket[],
): Source3HealthConflictInjuryMarkersResult {
  const conflictPacket = findPacket(packets, "conflict-context");
  const resolution = conflictPacket.sections.resolution.value;
  const contextMap = conflictPacket.sections.contextMap.value;
  const conflictSources: Array<{ conflictType: z.infer<typeof Source3ConflictTypeSchema>; labels: readonly string[] }> = [
    { conflictType: "clash", labels: resolution.activeClashes },
    { conflictType: "punishment", labels: resolution.activePunishments },
    { conflictType: "harm", labels: resolution.activeHarms },
    { conflictType: "destruction", labels: [...resolution.activeDestructions, ...resolution.intraPillarDestructions] },
  ];

  const markers = conflictSources.flatMap(({ conflictType, labels }) => labels.map((label) => {
    const matchingEntries = contextMap.filter((entry) => (
      entry.label === label
      || entry.relationId.includes(label)
      || label.includes(entry.label)
    ));
    const symbols = unique([
      ...matchingEntries.flatMap((entry) => entry.participants.map((participant) => participant.symbol)),
      ...extractHanSymbols(label),
    ]);
    const targetedAreas = unique(symbols.flatMap((symbol) => CONFLICT_SYMBOL_HEALTH_POLICY[symbol] ?? []));

    return Source3HealthConflictMarkerSchema.parse({
      conflictType,
      relationLabel: label,
      symbols: symbols.length > 0 ? symbols : [label],
      targetedAreas: targetedAreas.length > 0 ? targetedAreas : ["จุดอ่อนที่ถูกแรงกระแทกซ้ำ"],
      cautionBand: conflictType === "clash" || conflictType === "destruction"
        ? "heightened-watch"
        : "baseline-watch",
      note: `${label} เพิ่มแรงกดหรือแรงกระแทกต่อสุขภาพในเชิงเฝ้าระวัง โดยห้ามสรุปเป็นภาวะเจ็บป่วยที่ยืนยันแล้ว.`,
    });
  }));

  const activeConflictKinds = unique(markers.map((marker) => marker.conflictType));
  const pressureLevel = markers.length === 0
    ? "none"
    : markers.some((marker) => marker.cautionBand === "heightened-watch")
      ? "heightened-watch"
      : "watch";

  return Source3HealthConflictInjuryMarkersResultSchema.parse({
    kind: "health-conflict-injury-markers",
    activeConflictKinds,
    markers,
    pressureLevel,
    boundaryNote: "Conflict markers only raise health watchfulness around impacted symbols and must not become diagnosis, emergency certainty, or remedy language.",
  });
}

function buildBoundedHealthCautionResult(
  packets: readonly BaziSharedPacket[],
  weakElementRouting: Source3HealthWeakElementRoutingResult,
  organRiskMap: Source3HealthOrganRiskMappingResult,
  conflictMarkers: Source3HealthConflictInjuryMarkersResult,
) {
  const texturePacket = findPacket(packets, "twelve-qi-texture");
  const currentDaYunStage = buildOptionalTextureStage(
    texturePacket.sections.texture.value.raw.currentDaYunBranch,
    texturePacket.sections.texture.value.display.currentDaYunBranch,
  );
  const currentLiuNianStage = buildOptionalTextureStage(
    texturePacket.sections.texture.value.raw.currentLiuNianBranch,
    texturePacket.sections.texture.value.display.currentLiuNianBranch,
  );
  const hasDaYunPressure = currentDaYunStage !== null && currentDaYunStage.signal !== "supportive";
  const hasLiuNianPressure = currentLiuNianStage !== null && currentLiuNianStage.signal !== "supportive";
  const triggerWindow = hasDaYunPressure && hasLiuNianPressure
    ? "dual-watch"
    : hasDaYunPressure
      ? "da-yun-watch"
      : hasLiuNianPressure
        ? "liu-nian-watch"
        : "steady-window";
  const sensitivityLevel = currentDaYunStage?.signal === "fragile"
    || currentLiuNianStage?.signal === "fragile"
    || conflictMarkers.pressureLevel === "heightened-watch"
    ? "elevated"
    : triggerWindow !== "steady-window" || conflictMarkers.markers.length > 0
      ? "watch"
      : "background";
  const cautionTone = sensitivityLevel === "elevated"
    ? "extra-rest-and-monitor"
    : sensitivityLevel === "watch"
      ? "active-watchfulness"
      : "calm-watchfulness";
  const primaryRiskLane = organRiskMap.riskLanes[0];
  const timingNote = triggerWindow === "steady-window"
    ? "จังหวะปัจจุบันยังไม่เร่งคำเตือนเพิ่ม แต่ยังต้องดูแลตาม baseline weakness อยู่เสมอ."
    : `จังหวะ ${triggerWindow} ทำให้คำเตือนสุขภาพต้องอ่านแบบระวังมากขึ้น โดยเฉพาะช่วงที่ twelve-qi ปัจจุบันไม่หนุนร่างกาย.`;

  return Source3BoundedHealthCautionResultSchema.parse({
    kind: "bounded-health-caution",
    baselineWeakness: {
      primaryWeakElement: weakElementRouting.primaryWeakElement,
      weakElementCount: weakElementRouting.weakElements.length,
      conflictMarkerCount: conflictMarkers.markers.length,
    },
    timingSensitivity: {
      currentDaYunStage,
      currentLiuNianStage,
      sensitivityLevel,
      triggerWindow,
      note: timingNote,
    },
    cautionTone,
    guidanceNotes: [
      `${primaryRiskLane.elementLabel} เป็น baseline weakness หลัก จึงควรเฝ้าระวัง ${primaryRiskLane.organs.join(" / ")} ในระดับแนวโน้มของดวง.`,
      timingNote,
      conflictMarkers.markers.length > 0
        ? `มี conflict marker ${conflictMarkers.markers.map((marker) => marker.relationLabel).join(", ")} จึงควรอ่านสุขภาพแบบพักจังหวะและติดตามอาการเปลี่ยนแปลงอย่างสงบ.`
        : "ยังไม่มี conflict marker เพิ่มเติม จึงคงคำเตือนไว้ที่การดูแลตัวเองและสังเกตสัญญาณร่างกายเท่านั้น.",
    ],
    forbiddenClaims: ["no-diagnosis", "no-treatment-instruction", "no-source7-remedy"],
    guardrail: "no-diagnosis-or-remedy",
  });
}

export function buildSource3HealthStepResult(
  stepId: string,
  packets: readonly BaziSharedPacket[],
  contract: BaziCallerContract,
): Source3HealthStepComputation {
  const weakElementRouting = buildWeakElementRoutingResult(contract, packets);

  if (stepId === "step-1-weak-element-routing") {
    return {
      packetFamilies: ["strength", "role-of-element", "twelve-qi-texture"],
      result: weakElementRouting,
    };
  }

  const organRiskMap = buildHealthOrganRiskMapResult(weakElementRouting);

  if (stepId === "step-2-organ-risk-mapping") {
    return {
      packetFamilies: ["role-of-element", "twelve-qi-texture"],
      result: organRiskMap,
    };
  }

  const conflictMarkers = buildConflictMarkersResult(packets);

  if (stepId === "step-3-conflict-injury-markers") {
    return {
      packetFamilies: ["conflict-context", "twelve-qi-texture"],
      result: conflictMarkers,
    };
  }

  return {
    packetFamilies: ["strength", "role-of-element", "twelve-qi-texture", "conflict-context"],
    result: buildBoundedHealthCautionResult(packets, weakElementRouting, organRiskMap, conflictMarkers),
  };
}