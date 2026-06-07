import { createHash } from "node:crypto";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { getCanonicalFivePhaseRelationLabel } from "@/lib/bazi/lexicon/school-lexicon";
import {
  BRANCH_HIDDEN_STEMS,
  BRANCH_LABELS_TH,
  BRANCH_TO_ELEMENT,
  CONFLICT_RESOLUTION_LABELS_TH,
  CONTROLS,
  ELEMENT_LABELS_TH,
  GENERATES,
  INTERACTION_CONTEXT_TAG,
  PILLAR_CONTEXT_MAP,
  ROLE_SUBTYPE_LABELS_TH,
  RELATION_SEMANTIC_MEANING_TH,
  STEM_TO_ELEMENT,
  TWELVE_QI_ADVERB_MAP,
  TWELVE_QI_CONTEXT_MAP,
  TWELVE_QI_LABELS_TH,
  VERTICAL_CONTEXT_MAP,
} from "@/lib/bazi/symbolic-engine.constants";
import { renderContextRuleNoteThai } from "@/lib/bazi/context-dictionary";
import { buildOutputTransferReading } from "@/lib/bazi/output-transfer-reading";
import { YANG_STEMS } from "@/lib/bazi/pillar-display";
import type { CalculatedStateValue, RawInputValue, SupportedElementValue } from "@/lib/bazi/schema-types";
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import { resolveBranchInteractionEffects } from "@/lib/bazi/symbolic-engine.interactions";
import { getGeminiApiKey } from "@/lib/env";

export const DEFAULT_DAY_MASTER_RELATION_POC_MODEL = "gemini-3-flash-preview";

const FORBIDDEN_READING_TERMS = [
  "payload",
  "schema",
  "json",
  "model",
  "ai",
  "enum",
  "debug",
  "assistant",
  "analysis",
  "ครับ",
  "ค่ะ",
] as const;
const ENGLISH_SCENE_KEY_PATTERN = /[A-Za-z_]/;

const PILLAR_SEQUENCE = ["year", "month", "day", "hour"] as const;
const RELATION_SEQUENCE = ["same", "resource", "output", "power", "wealth"] as const;
const READING_STEP_ORDER = [1, 2, 3, 4, 5, 6] as const;

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

const STEP_3_VISIBLE_LAYERS: ReadonlySet<string> = new Set(["stem", "branch"]);

const STEP_3_DISTURBANCE_FAMILIES = new Set([
  "heavenly-stem-clash",
  "earthly-branch-clash",
  "earthly-branch-harm",
  "earthly-branch-destruction",
  "earthly-branch-punishment",
]);

const STEP_3_ATTRACTION_FAMILIES = new Set([
  "earthly-branch-liu-he",
  "heavenly-stem-he",
  "earthly-branch-ban-san-he",
  "earthly-branch-san-he",
  "earthly-branch-san-hui",
  "earthly-branch-fang-ju",
]);

const MODIFIER_FAMILY_LABEL_THAI: Record<string, string> = {
  "heavenly-stem-clash": "ชง (ฟ้า)",
  "earthly-branch-clash": "ชง (ดิน)",
  "earthly-branch-harm": "ไห่",
  "earthly-branch-destruction": "ผั่ว",
  "earthly-branch-punishment": "เฮ้ง",
  "earthly-branch-liu-he": "ฮะ (ดิน)",
  "heavenly-stem-he": "ฮะ (ฟ้า)",
  "earthly-branch-ban-san-he": "กึ่งภาคี",
  "earthly-branch-san-he": "ภาคี",
  "earthly-branch-san-hui": "ไตรทิศ",
  "earthly-branch-fang-ju": "จู้",
};

const RelationKeySchema = z.enum(["same", "resource", "output", "power", "wealth"]);
const ReadingStepKeySchema = z.enum([
  "balance-core",
  "day-pillar-identity",
  "standard-energies",
  "result-wealth",
  "context-mapping",
  "advanced-signals",
]);

const RelationSummarySchema = z.object({
  relationKey: RelationKeySchema,
  relationLabelThai: z.string().trim().min(1),
  semanticMeaningThai: z.string().trim().min(1),
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

const AuditEvidenceSchema = z.object({
  id: z.string().trim().min(1),
  labelThai: z.string().trim().min(1),
  detailThai: z.string().trim().min(1),
  categoryThai: z.string().trim().min(1),
});

const StepInsightSchema = z.object({
  stepNumber: z.number().int().min(1).max(6),
  stepKey: ReadingStepKeySchema,
  titleThai: z.string().trim().min(1),
  summaryThai: z.string().trim().min(1),
  auditFocusThai: z.string().trim().min(1),
  evidenceIds: z.array(z.string().trim().min(1)).min(1),
  evidenceLines: z.array(z.string().trim().min(1)).min(1),
});

export const RelationReadingPacketSchema = z.object({
  version: z.literal("bazi-stepwise-cli-v2"),
  mode: z.literal("stepwise-school-reading"),
  chartAnchor: z.object({
    dayMasterStem: z.string().trim().min(1),
    dayMasterElement: z.enum(["wood", "fire", "earth", "metal", "water"]),
    dayMasterElementLabelThai: z.string().trim().min(1),
    dayMasterStrengthLabelThai: z.string().trim().min(1),
    dayMasterStrengthScore: z.number().finite(),
    dayBranch: z.string().trim().min(1),
    dayBranchLabelThai: z.string().trim().min(1),
    balanceNarrativeThai: z.string().trim().min(1),
    identityNarrativeThai: z.string().trim().min(1),
  }),
  eightSlots: z.array(EightSlotRowSchema).length(8),
  relationSummary: z.array(RelationSummarySchema).length(5),
  stepInsights: z.array(StepInsightSchema).length(6),
  evidenceCatalog: z.array(AuditEvidenceSchema).min(6),
  advancedSignals: z.array(z.string().trim().min(1)).min(1),
});

const BriefStepSchema = z.object({
  stepNumber: z.number().int().min(1).max(6),
  titleThai: z.string().trim().min(1),
  briefThai: z.string().trim().min(1),
  evidenceRefs: z.array(z.string().trim().min(1)).min(1),
  evidenceLines: z.array(z.string().trim().min(1)).min(1),
});

export const DayMasterRelationBriefSchema = z.object({
  version: z.literal("bazi-stepwise-brief-v2"),
  openingDoctrineThai: z.string().trim().min(1),
  chartAnchor: z.object({
    dayMasterStem: z.string().trim().min(1),
    dayMasterElementLabelThai: z.string().trim().min(1),
    dayMasterStrengthLabelThai: z.string().trim().min(1),
    dayMasterStrengthScore: z.number().finite(),
    dayBranchLabelThai: z.string().trim().min(1),
  }),
  steps: z.array(BriefStepSchema).length(6),
});

const StepReadingSchema = z.object({
  step_number: z.number().int().min(1).max(6),
  heading_thai: z.string().trim().min(1),
  teacher_reading: z.string().trim().min(1),
  life_meaning: z.string().trim().min(1),
  caution: z.string().trim().min(1),
  evidence_refs: z.array(z.string().trim().min(1)).min(1),
});

export const RelationReadingResponseSchema = z.object({
  openingSummary: z.string().trim().min(1),
  step_readings: z.array(StepReadingSchema).length(6),
  closing_reading: z.string().trim().min(1),
}).superRefine((response, context) => {
  const fields = [
    response.openingSummary,
    response.closing_reading,
    ...response.step_readings.flatMap((step) => [
      step.heading_thai,
      step.teacher_reading,
      step.life_meaning,
      step.caution,
      ...step.evidence_refs,
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

  const seenStepNumbers = new Set<number>();
  response.step_readings.forEach((step, index) => {
    if (ENGLISH_SCENE_KEY_PATTERN.test(step.heading_thai)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["step_readings", index, "heading_thai"],
        message: "Step heading must stay Thai-only on the visible surface.",
      });
    }

    if (seenStepNumbers.has(step.step_number)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["step_readings", index, "step_number"],
        message: "Each reading step must appear exactly once.",
      });
    }
    seenStepNumbers.add(step.step_number);
  });

  for (const requiredStep of READING_STEP_ORDER) {
    if (!seenStepNumbers.has(requiredStep)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Missing required reading step: ${requiredStep}`,
      });
    }
  }
});

const RELATION_READING_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    openingSummary: { type: "string" },
    step_readings: {
      type: "array",
      minItems: 6,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          step_number: { type: "integer" },
          heading_thai: { type: "string" },
          teacher_reading: { type: "string" },
          life_meaning: { type: "string" },
          caution: { type: "string" },
          evidence_refs: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
        },
        required: ["step_number", "heading_thai", "teacher_reading", "life_meaning", "caution", "evidence_refs"],
      },
    },
    closing_reading: { type: "string" },
  },
  required: ["openingSummary", "step_readings", "closing_reading"],
} as const;

export type RelationReadingPacket = z.infer<typeof RelationReadingPacketSchema>;
export type DayMasterRelationBrief = z.infer<typeof DayMasterRelationBriefSchema>;
export type RelationReadingResponse = z.infer<typeof RelationReadingResponseSchema>;

type RelationKey = z.infer<typeof RelationKeySchema>;
type PillarKey = (typeof PILLAR_SEQUENCE)[number];
type RelationSummary = z.infer<typeof RelationSummarySchema>;
type AuditEvidence = z.infer<typeof AuditEvidenceSchema>;
type RelationTarget = {
  carrierKey: string;
  pillarKey: PillarKey;
  pillarLabelThai: string;
  layer: "stem" | "branch" | "hidden";
  layerLabelThai: string;
  symbol: string;
  symbolThai: string;
  element: SupportedElementValue;
  elementLabelThai: string;
  relationKey: RelationKey;
  relationLabelThai: string;
  contextThai: string;
  evidence: string;
  weight: number;
};

type Step3ActionVector = {
  actionElement: SupportedElementValue;
  actionElementLabelThai: string;
  visibleActionCarriers: RelationTarget[];
  strongestVisibleActionCarrier: RelationTarget | null;
  actionCarrierCount: number;
  disturbanceModifiers: Array<{ familyKey: string; label: string; categoryThai: string; resolutionStatus?: string }>;
  attractionModifiers: Array<{ familyKey: string; label: string; categoryThai: string; resolutionStatus?: string }>;
  twelveQiBadges: Array<{ carrierLabel: string; pillarKey: string; stageLabel: string; adverb: string }>;
  hiddenActionCarrierCount: number;
  hiddenActionCarrierSummary: string;
  subtypeBadges: Array<{ carrierLabel: string; pillarKey: string; subtypeLabel: string }>;
};

const WEALTH_CAPACITY_MAP: Record<string, { id: string; label: string; metaphor: string; canGrab: boolean }> = {
  "very-weak": { id: "very-weak", label: "คว้าไม่ได้", metaphor: "ดินเหลว/โคลน เห็นโชคแต่ไขว่คว้าไม่ได้", canGrab: false },
  "weak": { id: "weak", label: "คว้ายาก", metaphor: "ต้องมีธาตุเสริม (เพื่อน/ผู้ใหญ่) ถึงจะรอด", canGrab: false },
  "balanced": { id: "balanced", label: "คว้าได้", metaphor: "สมดุล ทำงานได้ผลตามวัฏจักร", canGrab: true },
  "strong": { id: "strong", label: "คว้าได้ดี", metaphor: "มีศักยภาพ ยืนหยัดได้ด้วยตนเอง", canGrab: true },
  "very-strong": { id: "very-strong", label: "เก็บกักไม่ได้", metaphor: "ภูเขาหิน โชคไหลมาแต่เก็บไม่อยู่", canGrab: false },
};

type Step4WealthVector = {
  wealthElement: SupportedElementValue;
  wealthElementLabelThai: string;
  visibleWealthCarriers: RelationTarget[];
  strongestVisibleWealthCarrier: RelationTarget | null;
  hiddenWealthCarrierCount: number;
  hiddenWealthCarrierSummary: string;
  capacity: { id: string; label: string; metaphor: string; canGrab: boolean };
  pianCaiBadges: Array<{ carrierLabel: string; pillarKey: string; isPianCai: boolean }>;
  muYuBadges: Array<{ carrierLabel: string; pillarKey: string; stageLabel: string }>;
  twelveQiBadges: Array<{ carrierLabel: string; pillarKey: string; stageLabel: string; adverb: string }>;
  absentWealth: boolean;
};

type Step3CompanionVector = {
  companionElement: SupportedElementValue;
  companionElementLabelThai: string;
  visibleCompanionCarriers: RelationTarget[];
  strongestVisibleCompanionCarrier: RelationTarget | null;
  companionCarrierCount: number;
  disturbanceModifiers: Array<{ familyKey: string; label: string; categoryThai: string; resolutionStatus?: string }>;
  attractionModifiers: Array<{ familyKey: string; label: string; categoryThai: string; resolutionStatus?: string }>;
  twelveQiBadges: Array<{ carrierLabel: string; pillarKey: string; stageLabel: string; adverb: string }>;
  hiddenCompanionCarrierCount: number;
  hiddenCompanionCarrierSummary: string;
  subtypeBadges: Array<{ carrierLabel: string; pillarKey: string; subtypeLabel: string }>;
};

type Step3ResourceVector = {
  resourceElement: SupportedElementValue;
  resourceElementLabelThai: string;
  visibleResourceCarriers: RelationTarget[];
  strongestVisibleResourceCarrier: RelationTarget | null;
  resourceCarrierCount: number;
  disturbanceModifiers: Array<{ familyKey: string; label: string; categoryThai: string; resolutionStatus?: string }>;
  attractionModifiers: Array<{ familyKey: string; label: string; categoryThai: string; resolutionStatus?: string }>;
  twelveQiBadges: Array<{ carrierLabel: string; pillarKey: string; stageLabel: string; adverb: string }>;
  hiddenResourceCarrierCount: number;
  hiddenResourceCarrierSummary: string;
  subtypeBadges: Array<{ carrierLabel: string; pillarKey: string; subtypeLabel: string }>;
};

type Step3PowerVector = {
  powerElement: SupportedElementValue;
  powerElementLabelThai: string;
  visiblePowerCarriers: RelationTarget[];
  strongestVisiblePowerCarrier: RelationTarget | null;
  powerCarrierCount: number;
  disturbanceModifiers: Array<{ familyKey: string; label: string; categoryThai: string; resolutionStatus?: string }>;
  attractionModifiers: Array<{ familyKey: string; label: string; categoryThai: string; resolutionStatus?: string }>;
  twelveQiBadges: Array<{ carrierLabel: string; pillarKey: string; stageLabel: string; adverb: string }>;
  hiddenPowerCarrierCount: number;
  hiddenPowerCarrierSummary: string;
  subtypeBadges: Array<{ carrierLabel: string; pillarKey: string; subtypeLabel: string }>;
};

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

function formatElementListThai(elements: readonly SupportedElementValue[], fallback: string) {
  if (elements.length === 0) {
    return fallback;
  }

  return elements.map((element) => getElementLabelThai(element)).join(", ");
}

function formatGenderThai(gender: string) {
  return gender === "female" ? "หญิง" : gender === "male" ? "ชาย" : gender;
}

function formatProvinceThai(province: string) {
  return province === "Bangkok" ? "กรุงเทพมหานคร" : province;
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

  if (
    targetElement === "wood" && dayMasterElement === "earth"
    || targetElement === "earth" && dayMasterElement === "water"
    || targetElement === "water" && dayMasterElement === "fire"
    || targetElement === "fire" && dayMasterElement === "metal"
    || targetElement === "metal" && dayMasterElement === "wood"
  ) {
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
    .map((stem) => `${stem}(${getElementLabelThai(getStemElement(stem))}${YANG_STEMS.has(stem) ? "หยาง" : "หยิน"})`)
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

function buildStep3ActionVector(
  allTargets: RelationTarget[],
  dayMasterElement: SupportedElementValue,
  dayMasterStem: string,
  interactionState: CalculatedStateValue["interactionState"],
  twelveQi: Record<string, string>,
  neutralizedClashes: string[] = [],
): Step3ActionVector {
  const actionElement = GENERATES[dayMasterElement as keyof typeof GENERATES] as SupportedElementValue;

  const visibleActionCarriers = allTargets
    .filter((t) => STEP_3_VISIBLE_LAYERS.has(t.layer) && t.relationKey === "output")
    .sort((a, b) => a.weight - b.weight);

  const hiddenActionCarriers = allTargets
    .filter((t) => t.layer === "hidden" && t.relationKey === "output");

  const strongestVisibleActionCarrier = visibleActionCarriers[0] ?? null;
  const dayMasterIsYang = YANG_STEMS.has(dayMasterStem);

  const { disturbanceModifiers, attractionModifiers } = buildModifiersWithResolution(interactionState, neutralizedClashes);

  const twelveQiBadges: Step3ActionVector["twelveQiBadges"] = visibleActionCarriers
    .filter((c) => c.layer === "branch")
    .map((c) => {
      const stage = twelveQi[`${c.pillarKey}Branch`];
      return {
        carrierLabel: c.pillarLabelThai,
        pillarKey: c.pillarKey,
        stageLabel: stage ?? "ไม่ระบุ",
        adverb: getTwelveQiAdverb(stage),
      };
    });

  const subtypeBadges: Step3ActionVector["subtypeBadges"] = visibleActionCarriers.map((c) => {
    const carrierIsYang = getCarrierPolarityIsYang(c);
    return {
      carrierLabel: `${c.pillarLabelThai} ${c.symbol}`,
      pillarKey: c.pillarKey,
      subtypeLabel: getRoleSubtypeLabel("output", dayMasterIsYang === carrierIsYang),
    };
  });

  return {
    actionElement,
    actionElementLabelThai: getElementLabelThai(actionElement),
    visibleActionCarriers,
    strongestVisibleActionCarrier,
    actionCarrierCount: visibleActionCarriers.length,
    disturbanceModifiers,
    attractionModifiers,
    twelveQiBadges,
    hiddenActionCarrierCount: hiddenActionCarriers.length,
    hiddenActionCarrierSummary: hiddenActionCarriers.length > 0
      ? hiddenActionCarriers.map((t) => `${t.pillarLabelThai} ${t.symbol}`).join(", ")
      : "ไม่มี",
    subtypeBadges,
  };
}

function getCarrierPolarityIsYang(carrier: RelationTarget): boolean {
  if (carrier.layer === "stem") {
    return YANG_STEMS.has(carrier.symbol);
  }
  const mainQi = BRANCH_HIDDEN_STEMS[carrier.symbol as keyof typeof BRANCH_HIDDEN_STEMS]?.[0];
  return mainQi ? YANG_STEMS.has(mainQi) : false;
}

function getRoleSubtypeLabel(relationKey: RelationKey, isSamePolarity: boolean): string {
  const labels = ROLE_SUBTYPE_LABELS_TH[relationKey];
  if (!labels) return isSamePolarity ? "เฉียว" : "ตรง";
  return isSamePolarity ? labels.indirect : labels.direct;
}

function getTwelveQiAdverb(stage: string | undefined): string {
  if (!stage) return "ไม่ระบุ";
  const entry = TWELVE_QI_ADVERB_MAP[stage];
  return entry ? `${entry.thai} (${entry.meaning})` : stage;
}

function buildModifiersWithResolution(
  interactionState: CalculatedStateValue["interactionState"],
  neutralizedClashes: string[],
): {
  disturbanceModifiers: Array<{ familyKey: string; label: string; categoryThai: string; resolutionStatus?: string }>;
  attractionModifiers: Array<{ familyKey: string; label: string; categoryThai: string; resolutionStatus?: string }>;
} {
  const disturbanceModifiers: Array<{ familyKey: string; label: string; categoryThai: string; resolutionStatus?: string }> = [];
  const attractionModifiers: Array<{ familyKey: string; label: string; categoryThai: string; resolutionStatus?: string }> = [];

  if (interactionState?.relations?.length) {
    for (const relation of interactionState.relations) {
      const family = relation.familyKey;
      const isClash = family.includes("clash");
      const isNeutralized = isClash && neutralizedClashes.some((nc) => relation.label.includes(nc) || nc.includes(relation.label));
      const resolutionStatus = isNeutralized ? CONFLICT_RESOLUTION_LABELS_TH.neutralized : undefined;

      if (STEP_3_DISTURBANCE_FAMILIES.has(family)) {
        disturbanceModifiers.push({
          familyKey: family,
          label: relation.label,
          categoryThai: MODIFIER_FAMILY_LABEL_THAI[family] ?? family,
          resolutionStatus,
        });
      } else if (STEP_3_ATTRACTION_FAMILIES.has(family)) {
        attractionModifiers.push({
          familyKey: family,
          label: relation.label,
          categoryThai: MODIFIER_FAMILY_LABEL_THAI[family] ?? family,
          resolutionStatus,
        });
      }
    }
  }

  return { disturbanceModifiers, attractionModifiers };
}

function buildStepCompanionVector(
  allTargets: RelationTarget[],
  dayMasterElement: SupportedElementValue,
  dayMasterStem: string,
  interactionState: CalculatedStateValue["interactionState"],
  twelveQi: Record<string, string>,
  neutralizedClashes: string[] = [],
): Step3CompanionVector {
  const companionElement = dayMasterElement;
  const visibleCompanionCarriers = allTargets
    .filter((t) => STEP_3_VISIBLE_LAYERS.has(t.layer) && t.relationKey === "same")
    .sort((a, b) => a.weight - b.weight);
  const hiddenCompanionCarriers = allTargets
    .filter((t) => t.layer === "hidden" && t.relationKey === "same");
  const strongestVisibleCompanionCarrier = visibleCompanionCarriers[0] ?? null;
  const dayMasterIsYang = YANG_STEMS.has(dayMasterStem);

  const { disturbanceModifiers, attractionModifiers } = buildModifiersWithResolution(interactionState, neutralizedClashes);

  const twelveQiBadges: Step3CompanionVector["twelveQiBadges"] = visibleCompanionCarriers
    .filter((c) => c.layer === "branch")
    .map((c) => {
      const stage = twelveQi[`${c.pillarKey}Branch`];
      return {
        carrierLabel: c.pillarLabelThai,
        pillarKey: c.pillarKey,
        stageLabel: stage ?? "ไม่ระบุ",
        adverb: getTwelveQiAdverb(stage),
      };
    });

  const subtypeBadges: Step3CompanionVector["subtypeBadges"] = visibleCompanionCarriers.map((c) => {
    const carrierIsYang = getCarrierPolarityIsYang(c);
    return {
      carrierLabel: `${c.pillarLabelThai} ${c.symbol}`,
      pillarKey: c.pillarKey,
      subtypeLabel: getRoleSubtypeLabel("same", dayMasterIsYang === carrierIsYang),
    };
  });

  return {
    companionElement,
    companionElementLabelThai: getElementLabelThai(companionElement),
    visibleCompanionCarriers,
    strongestVisibleCompanionCarrier,
    companionCarrierCount: visibleCompanionCarriers.length,
    disturbanceModifiers,
    attractionModifiers,
    twelveQiBadges,
    hiddenCompanionCarrierCount: hiddenCompanionCarriers.length,
    hiddenCompanionCarrierSummary: hiddenCompanionCarriers.length > 0
      ? hiddenCompanionCarriers.map((t) => `${t.pillarLabelThai} ${t.symbol}`).join(", ")
      : "ไม่มี",
    subtypeBadges,
  };
}

function buildStepResourceVector(
  allTargets: RelationTarget[],
  dayMasterElement: SupportedElementValue,
  dayMasterStem: string,
  interactionState: CalculatedStateValue["interactionState"],
  twelveQi: Record<string, string>,
  neutralizedClashes: string[] = [],
): Step3ResourceVector {
  const resourceElement = getTargetElementByRelation(dayMasterElement, "resource");
  const visibleResourceCarriers = allTargets
    .filter((t) => STEP_3_VISIBLE_LAYERS.has(t.layer) && t.relationKey === "resource")
    .sort((a, b) => a.weight - b.weight);
  const hiddenResourceCarriers = allTargets
    .filter((t) => t.layer === "hidden" && t.relationKey === "resource");
  const strongestVisibleResourceCarrier = visibleResourceCarriers[0] ?? null;
  const dayMasterIsYang = YANG_STEMS.has(dayMasterStem);

  const { disturbanceModifiers, attractionModifiers } = buildModifiersWithResolution(interactionState, neutralizedClashes);

  const twelveQiBadges: Step3ResourceVector["twelveQiBadges"] = visibleResourceCarriers
    .filter((c) => c.layer === "branch")
    .map((c) => {
      const stage = twelveQi[`${c.pillarKey}Branch`];
      return {
        carrierLabel: c.pillarLabelThai,
        pillarKey: c.pillarKey,
        stageLabel: stage ?? "ไม่ระบุ",
        adverb: getTwelveQiAdverb(stage),
      };
    });

  const subtypeBadges: Step3ResourceVector["subtypeBadges"] = visibleResourceCarriers.map((c) => {
    const carrierIsYang = getCarrierPolarityIsYang(c);
    return {
      carrierLabel: `${c.pillarLabelThai} ${c.symbol}`,
      pillarKey: c.pillarKey,
      subtypeLabel: getRoleSubtypeLabel("resource", dayMasterIsYang === carrierIsYang),
    };
  });

  return {
    resourceElement,
    resourceElementLabelThai: getElementLabelThai(resourceElement),
    visibleResourceCarriers,
    strongestVisibleResourceCarrier,
    resourceCarrierCount: visibleResourceCarriers.length,
    disturbanceModifiers,
    attractionModifiers,
    twelveQiBadges,
    hiddenResourceCarrierCount: hiddenResourceCarriers.length,
    hiddenResourceCarrierSummary: hiddenResourceCarriers.length > 0
      ? hiddenResourceCarriers.map((t) => `${t.pillarLabelThai} ${t.symbol}`).join(", ")
      : "ไม่มี",
    subtypeBadges,
  };
}

function buildStepPowerVector(
  allTargets: RelationTarget[],
  dayMasterElement: SupportedElementValue,
  dayMasterStem: string,
  interactionState: CalculatedStateValue["interactionState"],
  twelveQi: Record<string, string>,
  neutralizedClashes: string[] = [],
): Step3PowerVector {
  const powerElement = getTargetElementByRelation(dayMasterElement, "power");
  const visiblePowerCarriers = allTargets
    .filter((t) => STEP_3_VISIBLE_LAYERS.has(t.layer) && t.relationKey === "power")
    .sort((a, b) => a.weight - b.weight);
  const hiddenPowerCarriers = allTargets
    .filter((t) => t.layer === "hidden" && t.relationKey === "power");
  const strongestVisiblePowerCarrier = visiblePowerCarriers[0] ?? null;
  const dayMasterIsYang = YANG_STEMS.has(dayMasterStem);

  const { disturbanceModifiers, attractionModifiers } = buildModifiersWithResolution(interactionState, neutralizedClashes);

  const twelveQiBadges: Step3PowerVector["twelveQiBadges"] = visiblePowerCarriers
    .filter((c) => c.layer === "branch")
    .map((c) => {
      const stage = twelveQi[`${c.pillarKey}Branch`];
      return {
        carrierLabel: c.pillarLabelThai,
        pillarKey: c.pillarKey,
        stageLabel: stage ?? "ไม่ระบุ",
        adverb: getTwelveQiAdverb(stage),
      };
    });

  const subtypeBadges: Step3PowerVector["subtypeBadges"] = visiblePowerCarriers.map((c) => {
    const carrierIsYang = getCarrierPolarityIsYang(c);
    return {
      carrierLabel: `${c.pillarLabelThai} ${c.symbol}`,
      pillarKey: c.pillarKey,
      subtypeLabel: getRoleSubtypeLabel("power", dayMasterIsYang === carrierIsYang),
    };
  });

  return {
    powerElement,
    powerElementLabelThai: getElementLabelThai(powerElement),
    visiblePowerCarriers,
    strongestVisiblePowerCarrier,
    powerCarrierCount: visiblePowerCarriers.length,
    disturbanceModifiers,
    attractionModifiers,
    twelveQiBadges,
    hiddenPowerCarrierCount: hiddenPowerCarriers.length,
    hiddenPowerCarrierSummary: hiddenPowerCarriers.length > 0
      ? hiddenPowerCarriers.map((t) => `${t.pillarLabelThai} ${t.symbol}`).join(", ")
      : "ไม่มี",
    subtypeBadges,
  };
}

function buildStep4WealthVector(
  allTargets: RelationTarget[],
  dayMasterElement: SupportedElementValue,
  dayMasterStem: string,
  strengthScore: number,
  twelveQi: Record<string, string>,
): Step4WealthVector {
  const wealthElement = CONTROLS[dayMasterElement as keyof typeof CONTROLS] as SupportedElementValue;

  const visibleWealthCarriers = allTargets
    .filter((t) => STEP_3_VISIBLE_LAYERS.has(t.layer) && t.relationKey === "wealth")
    .sort((a, b) => a.weight - b.weight);

  const hiddenWealthCarriers = allTargets
    .filter((t) => t.layer === "hidden" && t.relationKey === "wealth");

  const strongestVisibleWealthCarrier = visibleWealthCarriers[0] ?? null;

  const dayMasterIsYang = YANG_STEMS.has(dayMasterStem);

  const capacityFallback = WEALTH_CAPACITY_MAP["balanced"]!;
  let capacityKey: string;
  try {
    capacityKey = classifyOperatorStrengthScore(strengthScore).id;
  } catch {
    capacityKey = "balanced";
  }
  const capacity = WEALTH_CAPACITY_MAP[capacityKey] ?? capacityFallback;

  const pianCaiBadges: Step4WealthVector["pianCaiBadges"] = visibleWealthCarriers.map((c) => {
    const carrierIsYang = getCarrierPolarityIsYang(c);
    return {
      carrierLabel: `${c.pillarLabelThai} ${c.symbol}`,
      pillarKey: c.pillarKey,
      isPianCai: dayMasterIsYang === carrierIsYang,
    };
  });

  const muYuBadges: Step4WealthVector["muYuBadges"] = visibleWealthCarriers
    .filter((c) => c.layer === "branch")
    .filter((c) => {
      const stage = twelveQi[`${c.pillarKey}Branch`];
      return stage === "沐浴";
    })
    .map((c) => ({
      carrierLabel: `${c.pillarLabelThai} ${c.symbol}`,
      pillarKey: c.pillarKey,
      stageLabel: TWELVE_QI_LABELS_TH["沐浴"] ?? "หมกยก",
    }));

  const twelveQiBadges: Step4WealthVector["twelveQiBadges"] = visibleWealthCarriers
    .filter((c) => c.layer === "branch")
    .map((c) => {
      const stage = twelveQi[`${c.pillarKey}Branch`];
      return {
        carrierLabel: `${c.pillarLabelThai} ${c.symbol}`,
        pillarKey: c.pillarKey,
        stageLabel: stage
          ? (TWELVE_QI_LABELS_TH[stage as keyof typeof TWELVE_QI_LABELS_TH] ?? "ไม่ระบุ")
          : "ไม่ระบุ",
        adverb: getTwelveQiAdverb(stage),
      };
    });

  return {
    wealthElement,
    wealthElementLabelThai: getElementLabelThai(wealthElement),
    visibleWealthCarriers,
    strongestVisibleWealthCarrier,
    hiddenWealthCarrierCount: hiddenWealthCarriers.length,
    hiddenWealthCarrierSummary: hiddenWealthCarriers.length > 0
      ? hiddenWealthCarriers.map((t) => `${t.pillarLabelThai} ${t.symbol}`).join(", ")
      : "ไม่มี",
    capacity,
    pianCaiBadges,
    muYuBadges,
    twelveQiBadges,
    absentWealth: visibleWealthCarriers.length === 0,
  };
}

type Step5CarrierContext = {
  carrierKey: string;
  pillarKey: PillarKey;
  layer: "stem" | "branch";
  symbol: string;
  relationKey: RelationKey;
  relationLabelThai: string;
  pillarContext: {
    traditionalPerson: string;
    businessPerson: string;
    administrationRole: string;
    agePhase: string;
    healthZone: string;
    nature: string;
  };
  verticalContext: {
    natureLabel: string;
    meaningThai: string;
    businessLens: string;
    agency: string;
  };
  twelveQiContext: string | null;
  interactionContexts: string[];
};

type Step5ContextMapping = {
  carrierContexts: Step5CarrierContext[];
  pillarDimensionSummary: Array<{
    pillarKey: PillarKey;
    pillarLabelThai: string;
    carriers: Array<{
      carrierKey: string;
      layer: "stem" | "branch";
      symbol: string;
      relationLabelThai: string;
      contextLine: string;
    }>;
  }>;
};

type Step6AdvancedVector = {
  summaryLines: string[];
  shenShaDetail: string;
  hiddenStemDetails: Array<{ pillarKey: PillarKey; detail: string }>;
  hiddenWealthDetail: string;
  hiddenPowerDetail: string;
  seasonalDetail: string;
  interactionDetail: string;
  readingOrderDetail: string;
  /** Step 6.2 — ธาตุถ่ายเทตกเชี่ยงแซราย "หลัก": คำทำนายการเรียน/การพูด */
  outputTransferSummary: string;
  outputTransferDetails: Array<{ pillarKey: PillarKey; detail: string }>;
};

function buildStep5ContextMapping(
  actionVector: Step3ActionVector,
  wealthVector: Step4WealthVector,
  companionVector: Step3CompanionVector,
  resourceVector: Step3ResourceVector,
  powerVector: Step3PowerVector,
  allTargets: RelationTarget[],
  interactionState: CalculatedStateValue["interactionState"],
  twelveQi: Record<string, string>,
): Step5ContextMapping {
  const visibleActionKeys = new Set(actionVector.visibleActionCarriers.map((c) => c.carrierKey));
  const visibleWealthKeys = new Set(wealthVector.visibleWealthCarriers.map((c) => c.carrierKey));
  const visibleCompanionKeys = new Set(companionVector.visibleCompanionCarriers.map((c) => c.carrierKey));
  const visibleResourceKeys = new Set(resourceVector.visibleResourceCarriers.map((c) => c.carrierKey));
  const visiblePowerKeys = new Set(powerVector.visiblePowerCarriers.map((c) => c.carrierKey));

  const relevantCarrierKeys = new Set([
    ...visibleActionKeys,
    ...visibleWealthKeys,
    ...visibleCompanionKeys,
    ...visibleResourceKeys,
    ...visiblePowerKeys,
  ]);

  const interactionMap = new Map<string, string[]>();
  if (interactionState?.relations?.length) {
    for (const relation of interactionState.relations) {
      const tag = INTERACTION_CONTEXT_TAG[relation.familyKey];
      if (!tag) continue;
      const participants = relation.participantEntityIds ?? [];
      for (const pid of participants) {
        const existing = interactionMap.get(pid) ?? [];
        existing.push(tag);
        interactionMap.set(pid, existing);
      }
    }
  }

  const relevantCarriers = allTargets.filter(
    (t) => relevantCarrierKeys.has(t.carrierKey) && STEP_3_VISIBLE_LAYERS.has(t.layer),
  );

  const carrierContexts: Step5CarrierContext[] = relevantCarriers.map((carrier) => {
    const pillarContext = PILLAR_CONTEXT_MAP[carrier.pillarKey];
    const verticalKey = carrier.layer === "stem" ? "stem" : "branch";
    const verticalContext = VERTICAL_CONTEXT_MAP[verticalKey];
    const resolvedLayer = verticalKey as "stem" | "branch";

    const qiKey = carrier.layer === "branch"
      ? twelveQi[`${carrier.pillarKey}Branch`]
      : undefined;
    const twelveQiEntry = qiKey ? TWELVE_QI_CONTEXT_MAP[qiKey] : undefined;

    const interactionContexts = interactionMap.get(carrier.carrierKey) ?? [];

    return {
      carrierKey: carrier.carrierKey,
      pillarKey: carrier.pillarKey,
      layer: resolvedLayer,
      symbol: carrier.symbol,
      relationKey: carrier.relationKey,
      relationLabelThai: carrier.relationLabelThai,
      pillarContext,
      verticalContext,
      twelveQiContext: twelveQiEntry ? `${twelveQiEntry.labelThai}: ${twelveQiEntry.contextTag}` : null,
      interactionContexts,
    };
  });

  const pillarDimensionSummary = (["year", "month", "day", "hour"] as const).map((pillarKey) => {
    const pillarLabel = PILLAR_LABELS[pillarKey];
    const carriersInPillar = carrierContexts.filter((c) => c.pillarKey === pillarKey);

    return {
      pillarKey,
      pillarLabelThai: pillarLabel,
      carriers: carriersInPillar.map((c) => ({
        carrierKey: c.carrierKey,
        layer: c.layer,
        symbol: c.symbol,
        relationLabelThai: c.relationLabelThai,
        contextLine: `${c.relationLabelThai} ${c.layer === "stem" ? "ฟ้า" : "ดิน"} → ${c.pillarContext.businessPerson} (${c.verticalContext.agency})${c.twelveQiContext ? ` [${c.twelveQiContext}]` : ""}${c.interactionContexts.length > 0 ? ` ⚡${c.interactionContexts.join("; ")}` : ""}`,
      })),
    };
  });

  return { carrierContexts, pillarDimensionSummary };
}

function buildEightSlotRows(calculatedState: CalculatedStateValue) {
  const dayMasterElement = getStemElement(calculatedState.dayMaster);

  return PILLAR_SEQUENCE.flatMap((pillarKey) => {
    const pillar = calculatedState.fourPillars[pillarKey];
    const stemElement = getStemElement(pillar.stem);
    const branchElement = getBranchElement(pillar.branch);
    
    const stemPolarityThai = YANG_STEMS.has(pillar.stem) ? "(หยาง)" : "(หยิน)";
    const branchMainQi = BRANCH_HIDDEN_STEMS[pillar.branch as keyof typeof BRANCH_HIDDEN_STEMS]?.[0];
    const branchPolarityThai = branchMainQi && YANG_STEMS.has(branchMainQi) ? "(หยาง)" : "(หยิน)";

    return [
      {
        slotKey: `${pillarKey}-stem`,
        positionLabelThai: getPositionLabelThai(pillarKey, "stem"),
        layerLabelThai: LAYER_LABELS.stem,
        symbol: pillar.stem,
        symbolThai: pillar.stem,
        element: stemElement,
        elementLabelThai: `${getElementLabelThai(stemElement)} ${stemPolarityThai}`,
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
        elementLabelThai: `${getElementLabelThai(branchElement)} ${branchPolarityThai}`,
        relationLabelThai: getCanonicalFivePhaseRelationLabel(getRelationKey(dayMasterElement, branchElement)),
        hiddenStemSummaryThai: getHiddenStemSummary(pillar.branch),
        contextThai: PILLAR_DOMAIN_CONTEXT[pillarKey],
      },
    ];
  });
}

function buildRelationTargets(calculatedState: CalculatedStateValue) {
  const dayMasterElement = getStemElement(calculatedState.dayMaster);
  const targets: RelationTarget[] = [];

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

function summarizeCarriers(targets: RelationTarget[]) {
  if (targets.length === 0) {
    return "ไม่พบ";
  }

  return targets.map((target) => `${target.pillarLabelThai} ${target.symbol}`).join(", ");
}

function addEvidence(catalog: AuditEvidence[], id: string, labelThai: string, detailThai: string, categoryThai: string) {
  catalog.push({ id, labelThai, detailThai, categoryThai });
  return id;
}

function buildRelationSummary(allTargets: RelationTarget[], dayMasterElement: SupportedElementValue) {
  return RELATION_SEQUENCE.map((relationKey) => {
    const relationTargets = allTargets.filter((target) => target.relationKey === relationKey);
    const targetElement = getTargetElementByRelation(dayMasterElement, relationKey);
    const strongestCarrier = relationTargets[0];

    return {
      relationKey,
      relationLabelThai: getCanonicalFivePhaseRelationLabel(relationKey),
      semanticMeaningThai: RELATION_SEMANTIC_MEANING_TH[relationKey] ?? "ไม่ระบุ",
      targetElement,
      targetElementLabelThai: getElementLabelThai(targetElement),
      carrierSummaryThai: summarizeCarriers(relationTargets),
      strongestCarrierThai: strongestCarrier ? `${strongestCarrier.pillarLabelThai} ${strongestCarrier.symbol}` : "ไม่พบ",
      targetCount: relationTargets.length,
    };
  });
}

function buildPillarContextLines(calculatedState: CalculatedStateValue) {
  const dayMasterElement = getStemElement(calculatedState.dayMaster);

  return PILLAR_SEQUENCE.map((pillarKey) => {
    const pillar = calculatedState.fourPillars[pillarKey];
    const stemRelation = getCanonicalFivePhaseRelationLabel(getRelationKey(dayMasterElement, getStemElement(pillar.stem)));
    const branchRelation = getCanonicalFivePhaseRelationLabel(getRelationKey(dayMasterElement, getBranchElement(pillar.branch)));

    return `${PILLAR_LABELS[pillarKey]}: ฟ้า ${pillar.stem} เป็น${stemRelation} | ดิน ${pillar.branch} (${getSymbolThaiForBranch(pillar.branch)}) เป็น${branchRelation} | บริบท ${PILLAR_DOMAIN_CONTEXT[pillarKey]}`;
  });
}

function localizePrecedenceNotes(sixtyJiazi: CalculatedStateValue["sixtyJiaziCorePersona"] | undefined) {
  const precedenceSignals = sixtyJiazi?.precedenceNoteSignals ?? [];
  if (precedenceSignals.length > 0) {
    return precedenceSignals.map((signal, index) => renderContextRuleNoteThai(signal) ?? sixtyJiazi?.precedenceNotes[index] ?? signal.key);
  }

  const precedenceNotes = sixtyJiazi?.precedenceNotes ?? [];
  if (precedenceNotes.length > 0) {
    return precedenceNotes;
  }

  return ["ยังไม่มีหมายเหตุการจัดลำดับการอ่านเพิ่มเติม"];
}

function formatHiddenStemAdvancedSignal(target: RelationTarget) {
  const polarityThai = YANG_STEMS.has(target.symbol) ? "หยาง" : "หยิน";
  return `${target.symbol}(${target.relationLabelThai}/ธาตุ${target.elementLabelThai} ${polarityThai})`;
}

function buildAdvancedSignals(
  calculatedState: CalculatedStateValue,
  relationTargets: RelationTarget[],
): Step6AdvancedVector {
  const shenShaDetail = calculatedState.shenSha.length > 0
    ? calculatedState.shenSha.map((entry) => `${entry.starName} ที่${entry.relatedPillar}: ${entry.meaning}`).join(" | ")
    : "ยังไม่มีดาวพิเศษที่ต้องยกขึ้นมาเป็นจุดอ่านเสริม";

  const hiddenStemDetails = PILLAR_SEQUENCE.map((pillarKey) => {
    const pillar = calculatedState.fourPillars[pillarKey];
    const hiddenTargets = relationTargets.filter((target) => target.pillarKey === pillarKey && target.layer === "hidden");
    const branchLabelThai = getSymbolThaiForBranch(pillar.branch);

    return {
      pillarKey,
      detail: hiddenTargets.length > 0
        ? `${PILLAR_LABELS[pillarKey]} ${pillar.branch} (${branchLabelThai}) แฝง ${hiddenTargets.map(formatHiddenStemAdvancedSignal).join(", ")}`
        : `${PILLAR_LABELS[pillarKey]} ${pillar.branch} (${branchLabelThai}) ไม่มีราศีแฝงให้ยกอ่านเพิ่ม`,
    };
  });

  const hiddenWealthCarriers = relationTargets
    .filter((target) => target.layer === "hidden" && target.relationKey === "wealth")
    .sort((left, right) => left.weight - right.weight);
  const hiddenPowerCarriers = relationTargets
    .filter((target) => target.layer === "hidden" && target.relationKey === "power")
    .sort((left, right) => left.weight - right.weight);

  const hiddenWealthDetail = hiddenWealthCarriers.length > 0
    ? `คลังทรัพย์แฝงอยู่ที่ ${hiddenWealthCarriers.map((target) => `${target.pillarLabelThai} ${target.symbol}`).join(", ")}`
    : "คลังทรัพย์แฝงยังไม่เปิดบนดวงนี้";
  const hiddenPowerDetail = hiddenPowerCarriers.length > 0
    ? `คลังอำนาจแฝงอยู่ที่ ${hiddenPowerCarriers.map((target) => `${target.pillarLabelThai} ${target.symbol}`).join(", ")}`
    : "คลังอำนาจแฝงยังไม่เปิดบนดวงนี้";

  const seasonalDetail = calculatedState.seasonalInteraction
    ? `ฤดูกาล ${calculatedState.seasonalInteraction.seasonLabel} ให้ภาพว่า ${calculatedState.seasonalInteraction.metaphor}`
    : "ฤดูกาลไม่มีสัญญาณพิเศษเพิ่ม จึงยืนบนแกนดิถีและสี่เสาเป็นหลัก";
  const interactionDetail = calculatedState.interactionState?.relations.length
    ? `ฐานคำนวณพบปฏิกิริยา ${calculatedState.interactionState.relations.length} ชุด เช่น ${calculatedState.interactionState.relations.slice(0, 3).map((relation) => relation.label).join(", ")}`
    : "ฐานคำนวณยังไม่มีปฏิกิริยาพิเศษที่ต้องยกเป็นเงื่อนไขนำ";
  const readingOrderDetail = calculatedState.baseChartReading?.readingOrderSteps?.length
    ? `ลำดับอ่านจากฐานชาร์ตคือ ${calculatedState.baseChartReading.readingOrderSteps.slice(0, 3).join(" -> ")}`
    : "ฐานชาร์ตยังไม่มี reading order เสริมเพิ่มเติม";

  // Step 6.2 — ธาตุถ่ายเท (食傷) ตกเชี่ยงแซราย "หลัก" → คำทำนายการเรียน/การพูด
  const outputTransfer = buildOutputTransferReading(calculatedState);
  const outputTransferDetails = outputTransfer.pillars.map((pillar) => ({
    pillarKey: pillar.pillarKey,
    detail: `${PILLAR_LABELS[pillar.pillarKey]} ${pillar.sentence}`,
  }));
  const outputTransferSummary =
    `ธาตุถ่ายเทคือ${outputTransfer.outputElementLabelThai} (${outputTransfer.outputStem}) ` +
    `ตกเชี่ยงแซ: ${outputTransfer.pillars
      .map((pillar) => `${PILLAR_LABELS[pillar.pillarKey]}=${pillar.stageThai}`)
      .join(", ")}`;

  return {
    summaryLines: [
      shenShaDetail,
      ...hiddenStemDetails.map((entry) => entry.detail),
      hiddenWealthDetail,
      hiddenPowerDetail,
      seasonalDetail,
      interactionDetail,
      readingOrderDetail,
      outputTransferSummary,
      ...outputTransferDetails.map((entry) => entry.detail),
    ],
    shenShaDetail,
    hiddenStemDetails,
    hiddenWealthDetail,
    hiddenPowerDetail,
    seasonalDetail,
    interactionDetail,
    readingOrderDetail,
    outputTransferSummary,
    outputTransferDetails,
  };
}

function buildStepInsights(options: {
  calculatedState: CalculatedStateValue;
  relationTargets: RelationTarget[];
  relationSummary: RelationSummary[];
  advancedSignals: Step6AdvancedVector;
}) {
  const { calculatedState, relationTargets, advancedSignals } = options;
  const evidenceCatalog: AuditEvidence[] = [];
  const dayMasterElement = getStemElement(calculatedState.dayMaster);
  const dayBranchLabelThai = getSymbolThaiForBranch(calculatedState.fourPillars.day.branch);
  const strengthProfile = calculatedState.dayMasterStrengthProfile;
  const sixtyJiazi = calculatedState.sixtyJiaziCorePersona;

  // Compute branch interaction resolution for ฮะแก้ชง
  const branchResolution = resolveBranchInteractionEffects(calculatedState.fourPillars);
  const neutralizedClashes = branchResolution.neutralizedClashes;

  const actionVector = buildStep3ActionVector(
    relationTargets,
    dayMasterElement,
    calculatedState.dayMaster,
    calculatedState.interactionState,
    calculatedState.twelveQi,
    neutralizedClashes,
  );
  const companionVector = buildStepCompanionVector(
    relationTargets,
    dayMasterElement,
    calculatedState.dayMaster,
    calculatedState.interactionState,
    calculatedState.twelveQi,
    neutralizedClashes,
  );
  const resourceVector = buildStepResourceVector(
    relationTargets,
    dayMasterElement,
    calculatedState.dayMaster,
    calculatedState.interactionState,
    calculatedState.twelveQi,
    neutralizedClashes,
  );
  const powerVector = buildStepPowerVector(
    relationTargets,
    dayMasterElement,
    calculatedState.dayMaster,
    calculatedState.interactionState,
    calculatedState.twelveQi,
    neutralizedClashes,
  );
  const wealthVector = buildStep4WealthVector(
    relationTargets,
    dayMasterElement,
    calculatedState.dayMaster,
    calculatedState.strengthScore,
    calculatedState.twelveQi,
  );
  const pillarContextLines = buildPillarContextLines(calculatedState);
  const contextMapping = buildStep5ContextMapping(
    actionVector,
    wealthVector,
    companionVector,
    resourceVector,
    powerVector,
    relationTargets,
    calculatedState.interactionState,
    calculatedState.twelveQi,
  );

  const step1EvidenceIds = [
    addEvidence(
      evidenceCatalog,
      "S1-core-balance",
      "แกนดิถีและกำลังดวง",
      `ดิถี ${calculatedState.dayMaster} ธาตุ${getElementLabelThai(dayMasterElement)} อยู่ในภาวะ ${strengthProfile?.displayLabel ?? strengthProfile?.strengthState ?? "ยังไม่มีคำอธิบายกำลังดวง"}`,
      "Step 1",
    ),
    addEvidence(
      evidenceCatalog,
      "S1-strength-narrative",
      "คำอธิบายสมดุลดวง",
      strengthProfile?.narrative ?? "ยังไม่มีคำอธิบาย narrative ของกำลังดวง",
      "Step 1",
    ),
    addEvidence(
      evidenceCatalog,
      "S1-elements",
      "ภาพรวมธาตุเด่นและธาตุขาด",
      `ธาตุเด่น ${formatElementListThai(calculatedState.elementAnalysis.dominantElements, "ไม่มีธาตุเด่นจัด")} | ธาตุขาด ${formatElementListThai(calculatedState.elementAnalysis.missingElements, "ไม่มีธาตุขาดชัด")}`,
      "Step 1",
    ),
  ];

  const step2EvidenceIds = [
    addEvidence(
      evidenceCatalog,
      "S2-day-pillar",
      "หลักวันและราศีล่าง",
      `หลักวันคือ ${calculatedState.dayMaster}${calculatedState.fourPillars.day.branch} โดยราศีล่างวันเป็น ${dayBranchLabelThai}`,
      "Step 2",
    ),
    addEvidence(
      evidenceCatalog,
      "S2-persona",
      "60 กะจื่อและคาแรกเตอร์ฐานวัน",
      sixtyJiazi?.narrative ?? "ยังไม่มี narrative 60 กะจื่อที่เติมเข้ามาในฐานคำนวณ",
      "Step 2",
    ),
    addEvidence(
      evidenceCatalog,
      "S2-precedence",
      "หมายเหตุการจัดลำดับการอ่าน",
      localizePrecedenceNotes(sixtyJiazi).join(" | "),
      "Step 2",
    ),
  ];

  const step3EvidenceIds = [
    addEvidence(
      evidenceCatalog,
      "S3-action-element",
      "ธาตุถ่ายเท (พลังมาตรฐานแรงกระทำ)",
      `ดิถีธาตุ${getElementLabelThai(dayMasterElement)} ถ่ายเทไปธาตุ${actionVector.actionElementLabelThai}`,
      "Step 3",
    ),
    addEvidence(
      evidenceCatalog,
      "S3-visible-action-carriers",
      "จุดที่มองเห็นธาตุถ่ายเท",
      actionVector.visibleActionCarriers.length > 0
        ? actionVector.visibleActionCarriers.map((t) => `${t.pillarLabelThai} ${t.symbol}`).join(", ")
        : "ไม่พบธาตุถ่ายเทบนชั้นมองเห็น",
      "Step 3",
    ),
    addEvidence(
      evidenceCatalog,
      "S3-strongest-visible-carrier",
      "จุดแรงสุดของธาตุถ่ายเท",
      actionVector.strongestVisibleActionCarrier
        ? `${actionVector.strongestVisibleActionCarrier.pillarLabelThai} ${actionVector.strongestVisibleActionCarrier.symbol} (${actionVector.strongestVisibleActionCarrier.elementLabelThai})`
        : "ไม่มีจุดมองเห็น",
      "Step 3",
    ),
    addEvidence(
      evidenceCatalog,
      "S3-hidden-deferred",
      "ธาตุถ่ายเทที่เก็บไว้อ่านขั้นสูง",
      `ซ่อน ${actionVector.hiddenActionCarrierCount} จุด: ${actionVector.hiddenActionCarrierSummary}`,
      "Step 3",
    ),
    addEvidence(
      evidenceCatalog,
      "S3-companion-element",
      "ธาตุคู่ (คู่ธาตุและเปรียว)",
      `ดิถีธาตุ${getElementLabelThai(dayMasterElement)} มีคู่ธาตุเป็นธาตุ${companionVector.companionElementLabelThai}`,
      "Step 3",
    ),
    addEvidence(
      evidenceCatalog,
      "S3-visible-companion-carriers",
      "จุดที่มองเห็นคู่ธาตุ",
      companionVector.visibleCompanionCarriers.length > 0
        ? companionVector.visibleCompanionCarriers.map((t) => `${t.pillarLabelThai} ${t.symbol}`).join(", ")
        : "ไม่พบคู่ธาตุบนชั้นมองเห็น",
      "Step 3",
    ),
    addEvidence(
      evidenceCatalog,
      "S3-resource-element",
      "ธาตุเสริม (ผู้สนับสนุนและความรู้)",
      `ดิถีธาตุ${getElementLabelThai(dayMasterElement)} ได้รับการสนับสนุนจากธาตุ${resourceVector.resourceElementLabelThai}`,
      "Step 3",
    ),
    addEvidence(
      evidenceCatalog,
      "S3-visible-resource-carriers",
      "จุดที่มองเห็นธาตุเสริม",
      resourceVector.visibleResourceCarriers.length > 0
        ? resourceVector.visibleResourceCarriers.map((t) => `${t.pillarLabelThai} ${t.symbol}`).join(", ")
        : "ไม่พบธาตุเสริมบนชั้นมองเห็น",
      "Step 3",
    ),
    addEvidence(
      evidenceCatalog,
      "S3-power-element",
      "ธาตุอำนาจ (ผู้มีอำนาจและกฎระเบียบ)",
      `ดิถีธาตุ${getElementLabelThai(dayMasterElement)} ถูกควบคุมโดยธาตุ${powerVector.powerElementLabelThai}`,
      "Step 3",
    ),
    addEvidence(
      evidenceCatalog,
      "S3-visible-power-carriers",
      "จุดที่มองเห็นธาตุอำนาจ",
      powerVector.visiblePowerCarriers.length > 0
        ? powerVector.visiblePowerCarriers.map((t) => `${t.pillarLabelThai} ${t.symbol}`).join(", ")
        : "ไม่พบธาตุอำนาจบนชั้นมองเห็น",
      "Step 3",
    ),
    ...actionVector.disturbanceModifiers.length > 0
      ? [addEvidence(
          evidenceCatalog,
          "S3-disturbance-modifiers",
          "แรงรบกวน (ชง เฮ้ง ไห่ ผว กุ้ยนั้ง)",
          actionVector.disturbanceModifiers.map((m) => `${m.categoryThai}: ${m.label}${m.resolutionStatus ? ` [${m.resolutionStatus}]` : ""}`).join(" | "),
          "Step 3",
        )]
      : [],
    ...actionVector.attractionModifiers.length > 0
      ? [addEvidence(
          evidenceCatalog,
          "S3-attraction-modifiers",
          "แรงดึงดูด (ฮะ ภาคี ที่ไม่แปลงธาตุ)",
          actionVector.attractionModifiers.map((m) => `${m.categoryThai}: ${m.label}`).join(" | "),
          "Step 3",
        )]
      : [],
    ...actionVector.twelveQiBadges.length > 0
      ? [addEvidence(
          evidenceCatalog,
          "S3-twelve-qi-badges",
          "12 เซงแซ (ลีลาการกระทำ)",
          actionVector.twelveQiBadges.map((b) => `${b.carrierLabel}: ${b.stageLabel} → ${b.adverb}`).join(" | "),
          "Step 3",
        )]
      : [],
    ...companionVector.subtypeBadges.length > 0
      ? [addEvidence(
          evidenceCatalog,
          "S3-companion-subtypes",
          "ประเภทคู่ธาตุ (คู่/เปรียว)",
          companionVector.subtypeBadges.map((b) => `${b.carrierLabel}: ${b.subtypeLabel}`).join(" | "),
          "Step 3",
        )]
      : [],
    ...resourceVector.subtypeBadges.length > 0
      ? [addEvidence(
          evidenceCatalog,
          "S3-resource-subtypes",
          "ประเภทธาตุเสริม (ตรง/เฉียว)",
          resourceVector.subtypeBadges.map((b) => `${b.carrierLabel}: ${b.subtypeLabel}`).join(" | "),
          "Step 3",
        )]
      : [],
    ...powerVector.subtypeBadges.length > 0
      ? [addEvidence(
          evidenceCatalog,
          "S3-power-subtypes",
          "ประเภทธาตุอำนาจ (ตรง/เฉียว)",
          powerVector.subtypeBadges.map((b) => `${b.carrierLabel}: ${b.subtypeLabel}`).join(" | "),
          "Step 3",
        )]
      : [],
  ];

  const step4EvidenceIds = [
    addEvidence(
      evidenceCatalog,
      "S4-wealth-element",
      "ธาตุโชคลาภ (สิ่งที่ดิถีพิฆาต)",
      `ดิถีธาตุ${getElementLabelThai(dayMasterElement)} พิฆาตธาตุ${wealthVector.wealthElementLabelThai} จึงใช้ธาตุ${wealthVector.wealthElementLabelThai}เป็นแกนอ่านโชคลาภ`,
      "Step 4",
    ),
    addEvidence(
      evidenceCatalog,
      "S4-visible-wealth-carriers",
      "จุดที่มองเห็นธาตุโชคลาภ",
      wealthVector.visibleWealthCarriers.length > 0
        ? wealthVector.visibleWealthCarriers.map((t) => `${t.pillarLabelThai} ${t.symbol} (${t.elementLabelThai})`).join(", ")
        : "ไม่พบธาตุโชคลาภบนชั้นมองเห็น ต้องรอรอบเวลาจร",
      "Step 4",
    ),
    addEvidence(
      evidenceCatalog,
      "S4-strongest-visible-wealth-carrier",
      "จุดแรงสุดของธาตุโชคลาภ",
      wealthVector.strongestVisibleWealthCarrier
        ? `${wealthVector.strongestVisibleWealthCarrier.pillarLabelThai} ${wealthVector.strongestVisibleWealthCarrier.symbol} (${wealthVector.strongestVisibleWealthCarrier.elementLabelThai})`
        : "ไม่มีจุดมองเห็น",
      "Step 4",
    ),
    addEvidence(
      evidenceCatalog,
      "S4-hidden-deferred",
      "ธาตุโชคลาภที่เก็บไว้อ่านขั้นสูง",
      `ซ่อน ${wealthVector.hiddenWealthCarrierCount} จุด: ${wealthVector.hiddenWealthCarrierSummary}`,
      "Step 4",
    ),
    addEvidence(
      evidenceCatalog,
      "S4-capacity",
      `ศักยภาพคว้าโชค: ${wealthVector.capacity.label}`,
      `${wealthVector.capacity.metaphor} (สามารถคว้า: ${wealthVector.capacity.canGrab ? "ได้" : "ไม่ได้"})`,
      "Step 4",
    ),
    ...wealthVector.pianCaiBadges.some((b) => b.isPianCai)
      ? [addEvidence(
          evidenceCatalog,
          "S4-pian-cai",
          "ลาภเปีย (ธาตุโชคลาภที่ต่างขั้วกับดิถี)",
          wealthVector.pianCaiBadges.filter((b) => b.isPianCai).map((b) => b.carrierLabel).join(", "),
          "Step 4",
        )]
      : [],
    ...wealthVector.muYuBadges.length > 0
      ? [addEvidence(
          evidenceCatalog,
          "S4-mu-yu",
          "ลาภหมกยก (ธาตุโชคลาภอยู่ช่วงหมกยก)",
          wealthVector.muYuBadges.map((b) => `${b.carrierLabel}: ${b.stageLabel}`).join(" | "),
          "Step 4",
        )]
      : [],
    ...wealthVector.twelveQiBadges.length > 0
      ? [addEvidence(
          evidenceCatalog,
          "S4-twelve-qi-badges",
          "12 เซงแซ (ลีลาโชคลาภ)",
          wealthVector.twelveQiBadges.map((b) => `${b.carrierLabel}: ${b.stageLabel}`).join(" | "),
          "Step 4",
        )]
      : [],
  ];

  const step5EvidenceIds: string[] = [];

  const hasRelevantCarriers = contextMapping.carrierContexts.length > 0;

  if (hasRelevantCarriers) {
    step5EvidenceIds.push(
      addEvidence(
        evidenceCatalog,
        "S5-horizontal-pillar-context",
        "บริบทแนวราบสี่เสา",
        contextMapping.pillarDimensionSummary
          .filter((p) => p.carriers.length > 0)
          .map((p) => `เสา${p.pillarLabelThai}: ${p.carriers.map((c) => c.contextLine).join(" | ")}`)
          .join("\n"),
        "Step 5",
      ),
    );

    step5EvidenceIds.push(
      addEvidence(
        evidenceCatalog,
        "S5-vertical-context",
        "บริบทแนวตั้ง ฟ้า/ดิน",
        contextMapping.carrierContexts
          .map((c) => `${c.carrierKey} → ${c.verticalContext.natureLabel}: ${c.verticalContext.meaningThai}`)
          .join("\n"),
        "Step 5",
      ),
    );
  }

  const carriersWithQi = contextMapping.carrierContexts.filter((c) => c.twelveQiContext !== null);
  if (carriersWithQi.length > 0) {
    step5EvidenceIds.push(
      addEvidence(
        evidenceCatalog,
        "S5-twelve-qi-modifier",
        "12 เซงแซ ต่อบริบท",
        carriersWithQi.map((c) => `${c.carrierKey}: ${c.twelveQiContext}`).join(" | "),
        "Step 5",
      ),
    );
  }

  const carriersWithInteraction = contextMapping.carrierContexts.filter((c) => c.interactionContexts.length > 0);
  if (carriersWithInteraction.length > 0) {
    step5EvidenceIds.push(
      addEvidence(
        evidenceCatalog,
        "S5-interaction-modifier",
        "ปฏิกิริยาต่อบริบท",
        carriersWithInteraction.map((c) => `${c.carrierKey}: ${c.interactionContexts.join("; ")}`).join(" | "),
        "Step 5",
      ),
    );
  }

  step5EvidenceIds.push(
    ...pillarContextLines.map((line, index) => addEvidence(
      evidenceCatalog,
      `S5-context-${index + 1}`,
      `บริบท${PILLAR_LABELS[PILLAR_SEQUENCE[index]]}`,
      line,
      "Step 5",
    )),
  );

  const step6EvidenceIds: string[] = [
    addEvidence(
      evidenceCatalog,
      "S6-shen-sha",
      "ดาวพิเศษที่ทำงานในดวง",
      advancedSignals.shenShaDetail,
      "Step 6",
    ),
    ...advancedSignals.hiddenStemDetails.map((entry) => addEvidence(
      evidenceCatalog,
      `S6-hidden-stems-${entry.pillarKey}`,
      `ราศีแฝงของเสา${PILLAR_LABELS[entry.pillarKey]}`,
      entry.detail,
      "Step 6",
    )),
    addEvidence(
      evidenceCatalog,
      "S6-hidden-wealth",
      "คลังทรัพย์แฝง",
      advancedSignals.hiddenWealthDetail,
      "Step 6",
    ),
    addEvidence(
      evidenceCatalog,
      "S6-hidden-power",
      "คลังอำนาจแฝง",
      advancedSignals.hiddenPowerDetail,
      "Step 6",
    ),
    addEvidence(
      evidenceCatalog,
      "S6-seasonal",
      "สัญญาณฤดูกาล",
      advancedSignals.seasonalDetail,
      "Step 6",
    ),
    addEvidence(
      evidenceCatalog,
      "S6-interactions",
      "ปฏิกิริยาที่ต้องยกปลาย",
      advancedSignals.interactionDetail,
      "Step 6",
    ),
    addEvidence(
      evidenceCatalog,
      "S6-reading-order",
      "ลำดับอ่านจากฐานชาร์ต",
      advancedSignals.readingOrderDetail,
      "Step 6",
    ),
  ];

  const stepInsights = [
    {
      stepNumber: 1,
      stepKey: "balance-core",
      titleThai: "สมดุลดวงและแกนหลัก",
      summaryThai: `ดวงนี้ยืนบนดิถี ${calculatedState.dayMaster} ธาตุ${getElementLabelThai(dayMasterElement)} ในภาวะ ${strengthProfile?.displayLabel ?? strengthProfile?.strengthState ?? "ยังไม่มีคำอธิบายกำลังดวง"}; ${strengthProfile?.narrative ?? "จึงต้องอ่านจากน้ำหนักธาตุรวมและการทรงตัวของดวง"}`,
      auditFocusThai: "ดูว่าดวงนี้ยืนด้วยความแข็ง อ่อน หรือสมดุล และธาตุใดพยุงหรือดึงกำลังดวง",
      evidenceIds: step1EvidenceIds,
      evidenceLines: step1EvidenceIds.map((id) => evidenceCatalog.find((entry) => entry.id === id)!.detailThai),
    },
    {
      stepNumber: 2,
      stepKey: "day-pillar-identity",
      titleThai: "หลักวันและตัวตน",
      summaryThai: `หลักวัน ${calculatedState.dayMaster}${calculatedState.fourPillars.day.branch} ทำให้ตัวตนหลักไปยืนที่ ${dayBranchLabelThai}; ${sixtyJiazi?.narrative ?? "จุดนี้จึงต้องอ่านจากหลักวันกับราศีล่างวันเป็นแกน"}`,
      auditFocusThai: "ยึดดิถีและราศีล่างวันเป็นตัวตนหลัก แล้วค่อยใช้ 60 กะจื่อแต้มคาแรกเตอร์",
      evidenceIds: step2EvidenceIds,
      evidenceLines: step2EvidenceIds.map((id) => evidenceCatalog.find((entry) => entry.id === id)!.detailThai),
    },
    {
      stepNumber: 3,
      stepKey: "standard-energies",
      titleThai: "พลังมาตรฐาน: ธาตุถ่ายเท + อีก 4 บทบาท (เสริม คู่ อำนาจ โชคลาภ)",
      summaryThai: [
        `ดิถีธาตุ${getElementLabelThai(dayMasterElement)} มี 5 บทบาท: `,
        actionVector.actionCarrierCount > 0
          ? `ถ่ายเทไปธาตุ${actionVector.actionElementLabelThai} ${actionVector.actionCarrierCount} จุด`
          : `ถ่ายเทไปธาตุ${actionVector.actionElementLabelThai} ไม่มีจุดมองเห็น`,
        companionVector.companionCarrierCount > 0
          ? `; คู่ธาตุ${companionVector.companionElementLabelThai} ${companionVector.companionCarrierCount} จุด`
          : `; ไม่มีคู่ธาตุมองเห็น`,
        resourceVector.resourceCarrierCount > 0
          ? `; เสริมจากธาตุ${resourceVector.resourceElementLabelThai} ${resourceVector.resourceCarrierCount} จุด`
          : `; ไม่มีธาตุเสริมมองเห็น`,
        powerVector.powerCarrierCount > 0
          ? `; ถูกกดจากธาตุ${powerVector.powerElementLabelThai} ${powerVector.powerCarrierCount} จุด`
          : `; ไม่มีธาตุอำนาจมองเห็น`,
        actionVector.disturbanceModifiers.length > 0
          ? `; ติด${actionVector.disturbanceModifiers.map((m) => m.categoryThai).join(" ")}`
          : "",
        actionVector.attractionModifiers.length > 0
          ? `; มี${actionVector.attractionModifiers.map((m) => m.categoryThai).join(" ")}ดึงดูด`
          : "",
        actionVector.twelveQiBadges.length > 0
          ? `; ลีลา: ${actionVector.twelveQiBadges.map((b) => `${b.carrierLabel}${b.adverb}`).join(" ")}`
          : "",
        actionVector.hiddenActionCarrierCount > 0
          ? `; ซ่อนถ่ายเท ${actionVector.hiddenActionCarrierCount} จุด`
          : "",
        companionVector.hiddenCompanionCarrierCount > 0
          ? `; ซ่อนคู่ ${companionVector.hiddenCompanionCarrierCount} จุด`
          : "",
        resourceVector.hiddenResourceCarrierCount > 0
          ? `; ซ่อนเสริม ${resourceVector.hiddenResourceCarrierCount} จุด`
          : "",
        powerVector.hiddenPowerCarrierCount > 0
          ? `; ซ่อนอำนาจ ${powerVector.hiddenPowerCarrierCount} จุด`
          : "",
      ].join(""),
      auditFocusThai: "ดู 5 บทบาทธาตุทั้งหมด: ถ่ายเท (output), คู่ธาตุ (same), เสริม (resource), อำนาจ (power), โชคลาภ (wealth) — ว่ามีจุดมองเห็นกี่จุด จุดไหนแรงสุด มีแรงรบกวนอะไร (ชง เฮ้ง ไห่ ผว) มีแรงดึงดูดอะไร (ฮะ ภาคี) 12 เซงแซเป็นอย่างไร และฮะแก้ชงหรือไม่ ส่วนที่ซ่อนเก็บไว้อ่านขั้นสูง",
      evidenceIds: step3EvidenceIds,
      evidenceLines: step3EvidenceIds.map((id) => evidenceCatalog.find((entry) => entry.id === id)!.detailThai),
    },
    {
      stepNumber: 4,
      stepKey: "result-wealth",
      titleThai: "ผลลัพธ์และโชคลาภ",
      summaryThai: [
        wealthVector.absentWealth
          ? `ดิถีธาตุ${getElementLabelThai(dayMasterElement)} พิฆาตธาตุ${wealthVector.wealthElementLabelThai} แต่ไม่มีจุดมองเห็นบนชั้นฟ้าดิน ต้องรอรอบเวลาจร`
          : `ดิถีธาตุ${getElementLabelThai(dayMasterElement)} พิฆาตธาตุ${wealthVector.wealthElementLabelThai} มองเห็น ${wealthVector.visibleWealthCarriers.length} จุด แรงสุดที่ ${wealthVector.strongestVisibleWealthCarrier!.pillarLabelThai} ${wealthVector.strongestVisibleWealthCarrier!.symbol}`,
        `; ศักยภาพคว้าโชค: ${wealthVector.capacity.label}`,
        wealthVector.pianCaiBadges.some((b) => b.isPianCai)
          ? `; ลาภเปีย (ต่างขั้ว): ${wealthVector.pianCaiBadges.filter((b) => b.isPianCai).map((b) => b.carrierLabel).join(", ")}`
          : "",
        wealthVector.muYuBadges.length > 0
          ? `; ลาภหมกยก: ${wealthVector.muYuBadges.map((b) => `${b.carrierLabel}อยู่${b.stageLabel}`).join(" ")}`
          : "",
        wealthVector.twelveQiBadges.length > 0
          ? `; ${wealthVector.twelveQiBadges.map((b) => `${b.carrierLabel}อยู่${b.stageLabel}`).join(" ")}`
          : "",
        wealthVector.hiddenWealthCarrierCount > 0
          ? `; ซ่อนอีก ${wealthVector.hiddenWealthCarrierCount} จุด เก็บไว้อ่านขั้นสูง`
          : "",
      ].join(""),
      auditFocusThai: "ดูว่าดิถีพิฆาตธาตุไหน มีจุดมองเห็นกี่จุด จุดไหนแรงสุด ศักยภาพคว้าโชคเป็นอย่างไร มีลาภเปีย (ต่างขั้ว) หรือลาภหมกยกไหม และลีลา 12 เซงแซเป็นอย่างไร ส่วนที่ซ่อนอยู่เก็บไว้อ่านขั้นสูง",
      evidenceIds: step4EvidenceIds,
      evidenceLines: step4EvidenceIds.map((id) => evidenceCatalog.find((entry) => entry.id === id)!.detailThai),
    },
    {
      stepNumber: 5,
      stepKey: "context-mapping",
      titleThai: "บริบทสี่เสา",
      summaryThai: [
        "สี่เสาแยกหน้าที่กันชัด: ปีคือสังคม เดือนคือองค์กรและฐานใหญ่ วันคือชีวิตใกล้ตัว ยามคือผลงานและสิ่งที่จะสร้างต่อจากนี้",
        ...hasRelevantCarriers
          ? contextMapping.pillarDimensionSummary
              .filter((p) => p.carriers.length > 0)
              .map((p) => `เสา${p.pillarLabelThai}: ${p.carriers.map((c) => `${c.relationLabelThai}(${c.layer === "stem" ? "ฟ้า" : "ดิน"})`).join(" ")}`)
          : ["ยังไม่มีพลังถ่ายเทหรือโชคลาภที่มองเห็นบนชั้นฟ้าดิน จึงต้องอ่านบริบทจากสี่เสาโดยรวมก่อน"],
        ...hasRelevantCarriers && contextMapping.carrierContexts.filter((c) => c.twelveQiContext !== null).length > 0
          ? [`; ลีลาเซงแซ: ${contextMapping.carrierContexts.filter((c) => c.twelveQiContext !== null).map((c) => `${c.carrierKey}→${c.twelveQiContext}`).join(" ")}`]
          : [],
      ].join(" | "),
      auditFocusThai: "ดูว่าพลังเดียวกันไปตกคนละเสาแล้วให้ความหมายคนละเรื่องอย่างไร และชั้นฟ้า/ดินเปลี่ยนธรรมชาติของพลังอย่างไร",
      evidenceIds: step5EvidenceIds,
      evidenceLines: step5EvidenceIds.map((id) => evidenceCatalog.find((entry) => entry.id === id)!.detailThai),
    },
    {
      stepNumber: 6,
      stepKey: "advanced-signals",
      titleThai: "ดาวพิเศษ ราศีแฝง และสัญญาณขั้นสูง",
      summaryThai: advancedSignals.summaryLines.join(" | "),
      auditFocusThai: "ใช้ดาวพิเศษ ราศีแฝง คลังทรัพย์/อำนาจแฝง รวมถึงฤดูกาลและลำดับอ่านจากฐานชาร์ตเป็นตัวเก็บปลาย โดยไม่ให้แย่งแกนหลัก",
      evidenceIds: step6EvidenceIds,
      evidenceLines: step6EvidenceIds.map((id) => evidenceCatalog.find((entry) => entry.id === id)!.detailThai),
    },
  ] as const;

  return {
    evidenceCatalog,
    stepInsights,
  };
}

export function buildDayMasterRelationPacket(calculatedState: CalculatedStateValue) {
  const dayMasterElement = getStemElement(calculatedState.dayMaster);
  const relationTargets = buildRelationTargets(calculatedState);
  const relationSummary = buildRelationSummary(relationTargets, dayMasterElement);
  const advancedSignals = buildAdvancedSignals(calculatedState, relationTargets);
  const strengthLabel = calculatedState.dayMasterStrengthProfile?.displayLabel
    ?? calculatedState.dayMasterStrengthProfile?.strengthState
    ?? "ยังไม่มีคำอธิบายกำลังดวง";
  const balanceNarrativeThai = calculatedState.dayMasterStrengthProfile?.narrative
    ?? "ให้ยืนบนสมดุลของดิถีและน้ำหนักธาตุรวมก่อน";
  const identityNarrativeThai = calculatedState.sixtyJiaziCorePersona?.narrative
    ?? `หลักวัน ${calculatedState.dayMaster}${calculatedState.fourPillars.day.branch} เป็นแกนตัวตนหลักของดวงนี้`;
  const { evidenceCatalog, stepInsights } = buildStepInsights({
    calculatedState,
    relationTargets,
    relationSummary,
    advancedSignals,
  });

  return RelationReadingPacketSchema.parse({
    version: "bazi-stepwise-cli-v2",
    mode: "stepwise-school-reading",
    chartAnchor: {
      dayMasterStem: calculatedState.dayMaster,
      dayMasterElement,
      dayMasterElementLabelThai: getElementLabelThai(dayMasterElement),
      dayMasterStrengthLabelThai: strengthLabel,
      dayMasterStrengthScore: calculatedState.strengthScore,
      dayBranch: calculatedState.fourPillars.day.branch,
      dayBranchLabelThai: getSymbolThaiForBranch(calculatedState.fourPillars.day.branch),
      balanceNarrativeThai,
      identityNarrativeThai,
    },
    eightSlots: buildEightSlotRows(calculatedState),
    relationSummary,
    stepInsights,
    evidenceCatalog,
    advancedSignals: advancedSignals.summaryLines,
  });
}

export function buildDayMasterRelationBrief(_rawInput: RawInputValue, packet: RelationReadingPacket) {
  return DayMasterRelationBriefSchema.parse({
    version: "bazi-stepwise-brief-v2",
    openingDoctrineThai: "อ่านตาม Step 1 ถึง 6 เท่านั้น: สมดุล -> หลักวัน -> พลังมาตรฐาน -> ผลลัพธ์/โชคลาภ -> บริบทสี่เสา -> สัญญาณขั้นสูง โดยใช้ศัพท์สำนักก่อนและห้ามให้ prose แซง fact",
    chartAnchor: {
      dayMasterStem: packet.chartAnchor.dayMasterStem,
      dayMasterElementLabelThai: packet.chartAnchor.dayMasterElementLabelThai,
      dayMasterStrengthLabelThai: packet.chartAnchor.dayMasterStrengthLabelThai,
      dayMasterStrengthScore: packet.chartAnchor.dayMasterStrengthScore,
      dayBranchLabelThai: packet.chartAnchor.dayBranchLabelThai,
    },
    steps: packet.stepInsights.map((step) => ({
      stepNumber: step.stepNumber,
      titleThai: step.titleThai,
      briefThai: step.summaryThai,
      evidenceRefs: step.evidenceIds,
      evidenceLines: step.evidenceLines,
    })),
  });
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

export function buildDayMasterRelationPocSystemInstruction() {
  return [
    "You are a senior Thai Bazi master writing a six-step reading from a deterministic brief.",
    "Write every visible field in Thai.",
    "You must never invent or recalculate facts beyond the brief.",
    "Respect this exact six-step order only: step 1 balance/core, step 2 day pillar identity, step 3 standard energies/actions, step 4 result and wealth, step 5 context mapping, step 6 advanced analytics.",
    "Each step_reading must contain one Thai heading, one teacher_reading, one life_meaning line, one caution line, and evidence_refs that exist in the brief.",
    "Use school wording first, then plain Thai explanation second.",
    "Keep visible headings Thai-only. Never use English words, transliteration, snake_case, or section codes.",
    "If evidence is thin, say less instead of inventing.",
    "Do not mention JSON, schema, payload, model, AI, enum, debug language, or generic assistant framing.",
    "Do not use polite particles such as ครับ or ค่ะ.",
    "Return JSON only.",
  ].join(" ");
}

export function buildDayMasterRelationPocUserPrompt(rawInput: RawInputValue, brief: DayMasterRelationBrief) {
  return [
    "Create one Thai Bazi reading from the deterministic brief below.",
    "Keep the opening and closing concise, but make each of the 6 steps read like a real sinsae teaching through the chart.",
    "Do not break the Step 1-6 order.",
    "Do not leak English scene identifiers, snake_case labels, or generic assistant wording onto the visible surface.",
    "Do not invent health, timing, marriage, or money claims unless the brief directly supports them.",
    "evidence_refs must reuse only the ids already present in the brief.",
    "Return exactly the JSON shape requested by the system instruction.",
    "",
    "Raw input:",
    JSON.stringify(rawInput, null, 2),
    "",
    "Stepwise reading brief:",
    JSON.stringify(brief, null, 2),
  ].join("\n");
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

function assertResponseEvidenceRefs(response: RelationReadingResponse, brief: DayMasterRelationBrief) {
  const allowedEvidenceRefs = new Set(brief.steps.flatMap((step) => step.evidenceRefs));

  response.step_readings.forEach((step) => {
    step.evidence_refs.forEach((reference) => {
      if (!allowedEvidenceRefs.has(reference)) {
        throw new Error(`Unknown evidence ref returned by Gemini: ${reference}`);
      }
    });
  });
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
  const brief = buildDayMasterRelationBrief(options.rawInput, packet);
  const prompt = buildDayMasterRelationPocUserPrompt(options.rawInput, brief);
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

  const parsedResponse = RelationReadingResponseSchema.parse(JSON.parse(responseText) as unknown);
  assertResponseEvidenceRefs(parsedResponse, brief);

  return {
    model,
    packet,
    brief,
    response: parsedResponse,
  };
}
