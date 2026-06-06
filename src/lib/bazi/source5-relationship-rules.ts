import { z } from "zod";

import {
  localizeTwelveQiLabel,
  resolveCanonicalTwelveQiStage,
} from "@/lib/bazi/pillar-display";
import { SOURCE5_RELATIONSHIP_STEP_IDS } from "@/lib/bazi/source5-relationship-doctrine";
import type { BaziCallerContract } from "@/lib/bazi/symbolic-engine.caller-contract";
import {
  BRANCH_LABELS_TH,
  BRANCH_TO_ELEMENT,
  BRANCH_HIDDEN_STEMS,
  CONTROLS,
  ELEMENT_LABELS_TH,
  FIVE_ELEMENT_ORDER,
  GENERATES,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import type { BaziSharedPacket } from "@/lib/bazi/symbolic-engine.shared-packets";

const Source5ElementSchema = z.enum(FIVE_ELEMENT_ORDER);
const Source5RelationshipRoleSchema = z.enum(["output", "resource", "wealth", "power", "parallel"]);
const Source5QualityBandSchema = z.enum(["favorable", "mixed", "challenging"]);

const Source5StepSymbolMatchSchema = z.object({
  pillarKey: z.enum(["year", "month", "day", "hour"]),
  symbol: z.string().trim().min(1),
  pillarCode: z.string().trim().min(2),
});

const Source5HiddenStemMatchSchema = z.object({
  pillarKey: z.enum(["year", "month", "day", "hour"]),
  branch: z.string().trim().min(1),
  hiddenStem: z.string().trim().min(1),
  pillarCode: z.string().trim().min(2),
});

const Source5CheingsaeStageSchema = z.object({
  source: z.literal("pillar-display.resolveCanonicalTwelveQiStage"),
  branch: z.string().trim().min(1),
  branchLabel: z.string().trim().min(1),
  stageOrder: z.number().int().min(1).max(12),
  stageNameChinese: z.string().trim().min(1),
  stageNameThai: z.string().trim().min(1),
  meaning: z.string().trim().min(1),
  qualityBand: z.enum(["favorable", "challenging"]),
});

const Source5RelationshipPotentialResultSchema = z.object({
  kind: z.literal("relationship-potential"),
  potentialKey: z.enum(["very-low", "low", "high"]),
  probabilityRange: z.string().trim().min(1),
  interpretation: z.string().trim().min(1),
  inputs: z.object({
    gender: z.string().trim().min(1),
    strengthBandId: z.string().trim().min(1),
    strengthState: z.string().trim().min(1),
  }),
});

const Source5ReactionResultSchema = z.object({
  kind: z.literal("spouse-base-reaction"),
  reactionLane: Source5RelationshipRoleSchema,
  reactionLabel: z.string().trim().min(1),
  relationshipMeaning: z.string().trim().min(1),
  inputs: z.object({
    dayStem: z.string().trim().min(1),
    spouseBaseBranch: z.string().trim().min(1),
    dayMasterElement: Source5ElementSchema,
    spouseBaseElement: Source5ElementSchema,
  }),
});

const Source5SpouseLookupResultSchema = z.object({
  kind: z.literal("spouse-element-lookup"),
  targetRole: z.enum(["wealth", "power"]),
  spouseElement: Source5ElementSchema,
  spouseElementLabel: z.string().trim().min(1),
  directRules: z.object({
    stemSymbols: z.array(z.string().trim().min(1)).min(1),
    branchSymbols: z.array(z.string().trim().min(1)).min(1),
  }),
  directMatches: z.object({
    stems: z.array(Source5StepSymbolMatchSchema),
    branches: z.array(Source5StepSymbolMatchSchema),
  }),
  hiddenRules: z.object({
    symbols: z.array(z.string().trim().min(1)).min(1),
  }),
  hiddenMatches: z.object({
    visibleStems: z.array(Source5StepSymbolMatchSchema),
    visibleBranches: z.array(Source5StepSymbolMatchSchema),
    hiddenStems: z.array(Source5HiddenStemMatchSchema),
  }),
  presenceMode: z.enum(["direct-present", "hidden-only", "absent"]),
  fallbackToSpouseBaseCheingsae: z.boolean(),
});

const Source5RelationshipCheingsaeResultSchema = z.object({
  kind: z.literal("relationship-12-cheingsae"),
  source: z.literal("pillar-display.resolveCanonicalTwelveQiStage"),
  selectedLane: z.enum(["direct-spouse-branch", "hidden-spouse-branch", "spouse-base-fallback"]),
  spouseBaseStage: Source5CheingsaeStageSchema,
  spouseElementStages: z.array(Source5CheingsaeStageSchema).min(1),
  selectedStages: z.array(Source5CheingsaeStageSchema).min(1),
  qualityBand: Source5QualityBandSchema,
});

const Source5ConflictConsequenceSchema = z.object({
  relationId: z.string().trim().min(1),
  familyKey: z.string().trim().min(1),
  relationType: z.enum(["punishment", "clash", "destruction", "combination", "harm", "other"]),
  precedence: z.string().trim().min(1).nullable(),
  status: z.string().trim().min(1),
  affectedPillars: z.array(z.enum(["year", "month", "day", "hour"])),
  audiences: z.array(z.string().trim().min(1)).min(1),
  consequenceKey: z.string().trim().min(1),
  meaning: z.string().trim().min(1),
});

const Source5ConflictImpactResultSchema = z.object({
  kind: z.literal("relationship-conflict-impact"),
  precedenceNotes: z.array(z.string().trim().min(1)),
  activeRelationCounts: z.object({
    combinations: z.number().int().nonnegative(),
    clashes: z.number().int().nonnegative(),
    punishments: z.number().int().nonnegative(),
    harms: z.number().int().nonnegative(),
    destructions: z.number().int().nonnegative(),
  }),
  relationshipPressure: z.enum(["low", "active", "elevated"]),
  consequences: z.array(Source5ConflictConsequenceSchema),
});

const Source5TimingRoleTargetSchema = z.object({
  role: Source5RelationshipRoleSchema,
  targetElement: Source5ElementSchema,
  targetElementLabel: z.string().trim().min(1),
});

const Source5TimingWindowAssessmentSchema = z.object({
  pillarCode: z.string().trim().min(2),
  startAge: z.number().int().nonnegative(),
  endAge: z.number().int().nonnegative(),
  stemElement: Source5ElementSchema,
  branchElement: Source5ElementSchema,
  matchedRoles: z.array(Source5RelationshipRoleSchema),
  cheingsae: Source5CheingsaeStageSchema,
  timingSignal: z.enum(["prime-window", "supportive-window", "background-window"]),
});

const Source5MarriageTimingResultSchema = z.object({
  kind: z.literal("marriage-timing"),
  targetRoles: z.array(Source5TimingRoleTargetSchema).min(1),
  strengthState: z.string().trim().min(1),
  thaiAge: z.number().int().nonnegative(),
  currentWindow: Source5TimingWindowAssessmentSchema.nullable(),
  projectedWindows: z.array(Source5TimingWindowAssessmentSchema),
});

const Source5SpecialSignalSchema = z.object({
  signalKey: z.string().trim().min(1),
  label: z.string().trim().min(1),
  evidence: z.string().trim().min(1),
});

const Source5SpouseProfileResultSchema = z.object({
  appearance: z.object({
    spouseElement: Source5ElementSchema,
    description: z.string().trim().min(1),
    cheingsaeAccent: z.string().trim().min(1),
  }),
  ageDifference: z.object({
    classification: z.enum(["older-or-farther", "younger", "same-generation", "gap-or-prior-marriage"]),
    evidence: z.string().trim().min(1),
  }),
  nationality: z.object({
    classification: z.enum(["different-region-or-foreign", "not-explicit"]),
    evidence: z.string().trim().min(1),
  }),
  status: z.object({
    classification: z.enum(["well-off", "not-explicit"]),
    evidence: z.string().trim().min(1),
  }),
  spouseCountSignal: z.object({
    classification: z.enum(["single-clear-spouse-signal", "multiple-spouse-signals"]),
    evidence: z.string().trim().min(1),
  }),
});

const Source5SpecialRulesResultSchema = z.object({
  kind: z.literal("special-rules-and-spouse-profile"),
  specialSignals: z.array(Source5SpecialSignalSchema),
  spouseProfile: Source5SpouseProfileResultSchema,
});

export const Source5RelationshipStepResultSchema = z.union([
  Source5RelationshipPotentialResultSchema,
  Source5ReactionResultSchema,
  Source5SpouseLookupResultSchema,
  Source5RelationshipCheingsaeResultSchema,
  Source5ConflictImpactResultSchema,
  Source5MarriageTimingResultSchema,
  Source5SpecialRulesResultSchema,
]);

export type Source5RelationshipStepResult = z.infer<typeof Source5RelationshipStepResultSchema>;

type Source5RelationshipStepComputation<TResult extends Source5RelationshipStepResult = Source5RelationshipStepResult> = {
  packetFamilies: BaziSharedPacket["family"][];
  result: TResult;
};

type Source5RelationshipPotentialResult = z.infer<typeof Source5RelationshipPotentialResultSchema>;
type Source5ReactionResult = z.infer<typeof Source5ReactionResultSchema>;
type Source5Element = z.infer<typeof Source5ElementSchema>;
type Source5SpouseLookupResult = z.infer<typeof Source5SpouseLookupResultSchema>;
type Source5RelationshipCheingsaeResult = z.infer<typeof Source5RelationshipCheingsaeResultSchema>;
type Source5ConflictImpactResult = z.infer<typeof Source5ConflictImpactResultSchema>;
type Source5MarriageTimingResult = z.infer<typeof Source5MarriageTimingResultSchema>;
type Source5SpecialRulesResult = z.infer<typeof Source5SpecialRulesResultSchema>;
type Source5PillarKey = keyof BaziCallerContract["sharedPacketSpine"]["chartIdentity"]["fourPillars"];
type Source5Pillar = BaziCallerContract["sharedPacketSpine"]["chartIdentity"]["fourPillars"][Source5PillarKey];
type Source5StepId = (typeof SOURCE5_RELATIONSHIP_STEP_IDS)[number];

const RELATIONSHIP_POTENTIAL_BY_STRENGTH = {
  "อ่อนแอ": {
    veryWeak: {
      potentialKey: "very-low",
      probabilityRange: "0-20%",
      interpretation: "ขาดความมั่นใจ มีคู่ยาก",
    },
    weak: {
      potentialKey: "low",
      probabilityRange: "20-40%",
      interpretation: "ไม่ค่อยมีคนมารัก มีคู่ยาก",
    },
  },
  "แข็งแรง/สมดุล": {
    balanced: {
      potentialKey: "high",
      probabilityRange: "60-70%+",
      interpretation: "มีความรักง่าย หาคู่ได้",
    },
    strong: {
      potentialKey: "high",
      probabilityRange: "60-70%+",
      interpretation: "มีความรักง่าย หาคู่ได้",
    },
  },
  "แข็งแรงมากเกินไป": {
    veryStrong: {
      potentialKey: "very-low",
      probabilityRange: "0-20%",
      interpretation: "หยิ่งในศักดิ์ศรี มีคู่ยาก",
    },
  },
} as const;

const RELATIONSHIP_REACTION_MEANINGS = {
  output: {
    reactionLabel: "ถ่ายเท (Output)",
    relationshipMeaning: "ดิถีมีการแสดงออกสนับสนุนคู่ครอง",
  },
  resource: {
    reactionLabel: "ก่อเกิด (Resource)",
    relationshipMeaning: "คู่ครองเป็นผู้สนับสนุนส่งเสริมดิถี",
  },
  wealth: {
    reactionLabel: "ธาตุลาภ (Wealth)",
    relationshipMeaning: "คู่ครองนำโชคลาภมาให้",
  },
  power: {
    reactionLabel: "พิฆาตธาตุ (Power)",
    relationshipMeaning: "ดิถีมีหน้าที่ต้องดูแลรับผิดชอบคู่ครอง",
  },
  parallel: {
    reactionLabel: "คู่ธาตุ (Parallel)",
    relationshipMeaning: "คู่ครองเป็นดั่งเพื่อน มีความสนิทสนม",
  },
} as const;

const RELATIONSHIP_CHEINGSAE_MEANINGS = {
  1: "มีคู่แล้วเจริญรุ่งเรือง ก้าวหน้า ช่วยกันพัฒนา",
  2: "คู่มีเสน่ห์ หลงใหลกันและกัน หรือเจ้าชู้",
  3: "คู่มีความรู้ ความสามารถ ใช้เหตุผล เข้าอกเข้าใจ",
  4: "คู่มียศศักดิ์ มีตำแหน่ง มีหน้าตาทางสังคม",
  5: "คู่มีศักดิ์ศรี มีอำนาจบารมี บางทีใช้อำนาจเกินขอบเขต",
  6: "คู่ล้าสมัย หัวโบราณ เรียบร้อย หรือขี้บ่น",
  7: "คู่มาจากทางไกลหรือต่างถิ่น ขยันขันแข็ง ทันสมัย",
  8: "ไม่มีคู่ หรือคู่ตายจาก หมดเยื่อใย",
  9: "คู่มีสมบัติ ฐานะดีขึ้นหลังแต่ง ชอบอยู่บ้าน",
  10: "ไม่มีคู่ อยู่ก่อนแต่ง หรือคบแล้วมีความเสียหายเกิดขึ้น",
  11: "คู่น่ารัก น่าเอ็นดู ชอบให้ดูแลประคบประหงม",
  12: "คู่นิสัยเหมือนเด็ก อ่อนกว่าวัย ต้องเลี้ยงดูทะนุถนอม",
} as const;

const FAVORABLE_CHEINGSAE_ORDERS = new Set([1, 3, 4, 5, 9, 11, 12]);
const WEALTHY_SPOUSE_CODES = new Set([
  "甲辰",
  "甲戌",
  "乙未",
  "丙申",
  "丁丑",
  "丁酉",
  "戊子",
  "戊辰",
  "己亥",
  "辛未",
  "壬午",
  "壬戌",
  "癸巳",
]);

const CANONICAL_TWELVE_QI_ORDER = [
  "长生",
  "沐浴",
  "冠带",
  "临官",
  "帝旺",
  "衰",
  "病",
  "死",
  "墓",
  "绝",
  "胎",
  "养",
] as const;

const HIDDEN_SPOUSE_RULES = {
  male: {
    甲: ["丙", "丁", "寅", "酉", "巳", "申"],
    乙: ["丙", "丁", "寅", "酉", "巳", "申"],
    丙: ["丁", "己", "壬", "巳", "子", "戌", "丑"],
    丁: ["丁", "己", "壬", "巳", "子", "戌", "丑"],
    戊: ["辛", "甲", "申", "卯", "辰", "丑"],
    己: ["辛", "甲", "申", "卯", "辰", "丑"],
    庚: ["癸", "丙", "戊", "亥", "午", "未", "辰"],
    辛: ["癸", "丙", "戊", "亥", "午", "未", "辰"],
    壬: ["庚", "戊", "己", "乙", "寅", "酉", "未", "戌"],
    癸: ["庚", "戊", "己", "乙", "寅", "酉", "未", "戌"],
  },
  female: {
    甲: ["壬", "丁", "己", "巳", "子", "丑", "戌"],
    乙: ["壬", "丁", "己", "戌", "巳", "子", "丑"],
    丙: ["辛", "甲", "申", "卯", "丑", "辰"],
    丁: ["辛", "甲", "申", "卯", "丑", "辰"],
    戊: ["丙", "戊", "癸", "亥", "午", "未", "辰"],
    己: ["丙", "戊", "癸", "亥", "午", "未", "辰"],
    庚: ["戊", "己", "乙", "庚", "寅", "酉", "未", "戌"],
    辛: ["戊", "己", "乙", "庚", "寅", "酉", "未", "戌"],
    壬: ["丙", "丁", "寅", "巳", "午", "申"],
    癸: ["丙", "丁", "寅", "巳", "午", "申"],
  },
} as const;

function findPacket<F extends BaziSharedPacket["family"]>(
  packets: readonly BaziSharedPacket[],
  family: F,
): Extract<BaziSharedPacket, { family: F }> {
  const packet = packets.find(
    (candidate): candidate is Extract<BaziSharedPacket, { family: F }> => candidate.family === family,
  );

  if (!packet) {
    throw new Error(`Source 5 rules are missing required packet family: ${family}`);
  }

  return packet;
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function getElementFromStem(stem: string): Source5Element {
  const element = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];

  if (!element) {
    throw new Error(`Unsupported Source 5 stem element lookup: ${stem}`);
  }

  return element;
}

function getElementFromBranch(branch: string): Source5Element {
  const element = BRANCH_TO_ELEMENT[branch as keyof typeof BRANCH_TO_ELEMENT];

  if (!element) {
    throw new Error(`Unsupported Source 5 branch element lookup: ${branch}`);
  }

  return element;
}

function invertMapLookup(
  map: Record<Source5Element, Source5Element>,
  target: Source5Element,
): Source5Element {
  const entry = Object.entries(map).find(([, value]) => value === target);

  if (!entry) {
    throw new Error(`Unsupported Source 5 inverse map lookup: ${target}`);
  }

  return entry[0] as Source5Element;
}

function resolveReactionLane(dayMasterElement: Source5Element, spouseBaseElement: Source5Element) {
  if (dayMasterElement === spouseBaseElement) {
    return "parallel" as const;
  }

  if (GENERATES[dayMasterElement] === spouseBaseElement) {
    return "output" as const;
  }

  if (GENERATES[spouseBaseElement] === dayMasterElement) {
    return "resource" as const;
  }

  if (CONTROLS[dayMasterElement] === spouseBaseElement) {
    return "wealth" as const;
  }

  if (CONTROLS[spouseBaseElement] === dayMasterElement) {
    return "power" as const;
  }

  throw new Error(`Unsupported Source 5 reaction lane: ${dayMasterElement} -> ${spouseBaseElement}`);
}

function getTargetRoleForSpouse(gender: string) {
  return gender === "female" ? "power" as const : "wealth" as const;
}

function getTargetElementForRole(dayMasterElement: Source5Element, role: z.infer<typeof Source5RelationshipRoleSchema>) {
  if (role === "parallel") {
    return dayMasterElement;
  }

  if (role === "output") {
    return GENERATES[dayMasterElement];
  }

  if (role === "wealth") {
    return CONTROLS[dayMasterElement];
  }

  if (role === "resource") {
    return invertMapLookup(GENERATES, dayMasterElement);
  }

  return invertMapLookup(CONTROLS, dayMasterElement);
}

function getStemSymbolsForElement(element: Source5Element) {
  return Object.entries(STEM_TO_ELEMENT)
    .filter(([, value]) => value === element)
    .map(([stem]) => stem);
}

function getBranchSymbolsForElement(element: Source5Element) {
  return Object.entries(BRANCH_TO_ELEMENT)
    .filter(([, value]) => value === element)
    .map(([branch]) => branch);
}

function getChartPillars(contract: BaziCallerContract) {
  return Object.entries(contract.sharedPacketSpine.chartIdentity.fourPillars) as Array<[Source5PillarKey, Source5Pillar]>;
}

function buildPillarCode(pillar: Source5Pillar) {
  return `${pillar.stem}${pillar.branch}`;
}

function buildVisibleMatches(
  pillars: Array<[Source5PillarKey, Source5Pillar]>,
  key: "stem" | "branch",
  symbols: readonly string[],
) {
  return pillars.flatMap(([pillarKey, pillar]) => (
    symbols.includes(pillar[key])
      ? [{ pillarKey, symbol: pillar[key], pillarCode: buildPillarCode(pillar) }]
      : []
  ));
}

function buildHiddenStemMatches(
  pillars: Array<[Source5PillarKey, Source5Pillar]>,
  symbols: readonly string[],
) {
  return pillars.flatMap(([pillarKey, pillar]) => {
    const hiddenStems = BRANCH_HIDDEN_STEMS[pillar.branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? [];

    return hiddenStems.flatMap((hiddenStem) => (
      symbols.includes(hiddenStem)
        ? [{ pillarKey, branch: pillar.branch, hiddenStem, pillarCode: buildPillarCode(pillar) }]
        : []
    ));
  });
}

function lookupCheingsaeStage(dayMaster: string, branch: string) {
  const stageNameChinese = resolveCanonicalTwelveQiStage(dayMaster, branch);

  if (!stageNameChinese) {
    throw new Error(`Missing canonical Source 5 cheingsae row for ${dayMaster}/${branch}`);
  }

  const stageOrder = CANONICAL_TWELVE_QI_ORDER.indexOf(
    stageNameChinese as (typeof CANONICAL_TWELVE_QI_ORDER)[number],
  ) + 1;

  if (stageOrder <= 0) {
    throw new Error(`Unsupported canonical Source 5 cheingsae stage for ${dayMaster}/${branch}: ${stageNameChinese}`);
  }

  return {
    source: "pillar-display.resolveCanonicalTwelveQiStage" as const,
    branch,
    branchLabel: BRANCH_LABELS_TH[branch as keyof typeof BRANCH_LABELS_TH] ?? branch,
    stageOrder,
    stageNameChinese,
    stageNameThai: localizeTwelveQiLabel(stageNameChinese),
    meaning: RELATIONSHIP_CHEINGSAE_MEANINGS[stageOrder as keyof typeof RELATIONSHIP_CHEINGSAE_MEANINGS],
    qualityBand: FAVORABLE_CHEINGSAE_ORDERS.has(stageOrder) ? "favorable" as const : "challenging" as const,
  };
}

function summarizeQualityBand(stages: Array<z.infer<typeof Source5CheingsaeStageSchema>>) {
  const favorableCount = stages.filter((stage) => stage.qualityBand === "favorable").length;

  if (favorableCount === stages.length) {
    return "favorable" as const;
  }

  if (favorableCount === 0) {
    return "challenging" as const;
  }

  return "mixed" as const;
}

function categorizeConflictFamily(familyKey: string) {
  if (familyKey.includes("punishment")) {
    return "punishment" as const;
  }

  if (familyKey.includes("clash")) {
    return "clash" as const;
  }

  if (familyKey.includes("destruction")) {
    return "destruction" as const;
  }

  if (familyKey.includes("harm")) {
    return "harm" as const;
  }

  if (familyKey.includes("he") || familyKey.includes("san-he") || familyKey.includes("san-hui")) {
    return "combination" as const;
  }

  return "other" as const;
}

function getAudienceLabels(relationType: z.infer<typeof Source5ConflictConsequenceSchema>["relationType"], pillarKey: Source5PillarKey) {
  const audienceMap = {
    punishment: {
      year: ["ปู่ย่า/ตายาย", "ลูกค้า/สังคม"],
      month: ["แม่", "ครอบครัว", "ธุรกิจครอบครัว"],
      day: ["ตัวเจ้าชะตา", "ชีวิตคู่"],
      hour: ["ลูกหลาน", "บริวาร"],
    },
    clash: {
      year: ["ปู่ย่า/ตายาย", "ลูกค้า/สังคม"],
      month: ["แม่", "ครอบครัว", "ที่ทำงาน"],
      day: ["ตัวเจ้าชะตา", "ชีวิตคู่"],
      hour: ["ลูกหลาน", "บริวาร"],
    },
    destruction: {
      year: ["ปู่ย่า/ตายาย", "ลูกค้า/สังคม"],
      month: ["พ่อ", "เจ้านาย", "ธุรกิจ"],
      day: ["ตัวเจ้าชะตา", "ชีวิตคู่"],
      hour: ["ลูกหลาน", "บริวาร"],
    },
    combination: {
      year: ["ปู่ย่า/ตายาย", "ลูกค้า"],
      month: ["แม่", "ครอบครัว", "ธุรกิจ"],
      day: ["ตัวเจ้าชะตา", "คู่ครอง"],
      hour: ["ลูกหลาน", "บริวาร"],
    },
    harm: {
      year: ["ญาติผู้ใหญ่", "สังคม"],
      month: ["ครอบครัว", "งาน"],
      day: ["ชีวิตคู่"],
      hour: ["ลูกหลาน", "บริวาร"],
    },
    other: {
      year: ["ญาติผู้ใหญ่", "สังคม"],
      month: ["ครอบครัว", "งาน"],
      day: ["ชีวิตคู่"],
      hour: ["ลูกหลาน", "บริวาร"],
    },
  } as const;

  return audienceMap[relationType][pillarKey];
}

function buildConflictMeaning(
  relationType: z.infer<typeof Source5ConflictConsequenceSchema>["relationType"],
  affectedPillars: Source5PillarKey[],
) {
  if (relationType === "punishment" && affectedPillars.includes("month") && affectedPillars.includes("hour")) {
    return {
      consequenceKey: "punishment-month-hour-no-spouse-risk",
      meaning: "ฐานคู่เฮ้งเดือนและยามพร้อมกัน เป็นสัญญาณว่ามีคู่ยากหรือความสัมพันธ์อยู่ยาก",
    };
  }

  if (relationType === "destruction" && affectedPillars.length === 1 && affectedPillars[0] === "day") {
    return {
      consequenceKey: "day-internal-destruction",
      meaning: "ราศีบนวันผั่วราศีล่างวัน ชีวิตคู่มีรอยร้าว ทะเลาะง่าย หรือมีระยะห่างแรง",
    };
  }

  const leadPillar = affectedPillars[0] ?? "day";

  if (relationType === "combination") {
    return {
      consequenceKey: `combination-${leadPillar}`,
      meaning: "ฐานคู่เกิดภาคีหรือการร่วมมือกับอีกหลักหนึ่ง ความสัมพันธ์จึงผูกกับเครือข่ายคนกลุ่มนั้นชัดเจน",
    };
  }

  if (relationType === "clash") {
    return {
      consequenceKey: `clash-${leadPillar}`,
      meaning: "ฐานคู่เจอแรงปะทะ ทำให้ความสัมพันธ์มีการเปลี่ยนแปลงหรือเสียดสีตามคน/บริบทที่เกี่ยวข้อง",
    };
  }

  if (relationType === "punishment") {
    return {
      consequenceKey: `punishment-${leadPillar}`,
      meaning: "ฐานคู่เจอเฮ้ง เป็นแรงอึดอัดเงียบ ๆ ที่ค่อย ๆ กดความสัมพันธ์ในบริบทนี้",
    };
  }

  if (relationType === "harm") {
    return {
      consequenceKey: `harm-${leadPillar}`,
      meaning: "มีแรงบาดลึกเชิงความรู้สึกหรือความคาดหวังแทรกในความสัมพันธ์",
    };
  }

  return {
    consequenceKey: `destruction-${leadPillar}`,
    meaning: "มีแรงผั่วหรือแรงแตกหักที่ทำให้ความสัมพันธ์เปราะและมีรอยร้าวสะสม",
  };
}

function dedupeWindowAssessments<T extends { pillarCode: string; startAge: number; endAge: number }>(values: T[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = `${value.pillarCode}|${value.startAge}|${value.endAge}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function resolvePotentialResult(
  contract: BaziCallerContract,
  packets: readonly BaziSharedPacket[],
): Source5RelationshipStepComputation<Source5RelationshipPotentialResult> {
  const strengthPacket = findPacket(packets, "strength");
  const strengthState = strengthPacket.sections.profile.value.lookupState;
  const strengthBandId = strengthPacket.sections.profile.value.bandId;
  const tableEntry = strengthState === "อ่อนแอ"
    ? (strengthBandId === "very-weak"
      ? RELATIONSHIP_POTENTIAL_BY_STRENGTH["อ่อนแอ"].veryWeak
      : RELATIONSHIP_POTENTIAL_BY_STRENGTH["อ่อนแอ"].weak)
    : strengthState === "แข็งแรง/สมดุล"
      ? (strengthBandId === "strong"
        ? RELATIONSHIP_POTENTIAL_BY_STRENGTH["แข็งแรง/สมดุล"].strong
        : RELATIONSHIP_POTENTIAL_BY_STRENGTH["แข็งแรง/สมดุล"].balanced)
      : RELATIONSHIP_POTENTIAL_BY_STRENGTH["แข็งแรงมากเกินไป"].veryStrong;

  return {
    packetFamilies: ["strength"],
    result: Source5RelationshipPotentialResultSchema.parse({
      kind: "relationship-potential",
      ...tableEntry,
      inputs: {
        gender: contract.rawInput.gender,
        strengthBandId,
        strengthState,
      },
    }),
  };
}

function resolveDayStemVsSpouseBaseResult(
  contract: BaziCallerContract,
): Source5RelationshipStepComputation<Source5ReactionResult> {
  const dayPillar = contract.sharedPacketSpine.chartIdentity.fourPillars.day;
  const dayMasterElement = getElementFromStem(dayPillar.stem);
  const spouseBaseElement = getElementFromBranch(dayPillar.branch);
  const reactionLane = resolveReactionLane(dayMasterElement, spouseBaseElement);

  return {
    packetFamilies: ["role-of-element"],
    result: Source5ReactionResultSchema.parse({
      kind: "spouse-base-reaction",
      reactionLane,
      ...RELATIONSHIP_REACTION_MEANINGS[reactionLane],
      inputs: {
        dayStem: dayPillar.stem,
        spouseBaseBranch: dayPillar.branch,
        dayMasterElement,
        spouseBaseElement,
      },
    }),
  };
}

function resolveSpouseLookupResult(
  contract: BaziCallerContract,
): Source5RelationshipStepComputation<Source5SpouseLookupResult> {
  const pillars = getChartPillars(contract);
  const dayMaster = contract.sharedPacketSpine.chartIdentity.dayMaster;
  const genderKey = contract.rawInput.gender === "female" ? "female" : "male";
  const dayMasterElement = getElementFromStem(dayMaster);
  const targetRole = getTargetRoleForSpouse(contract.rawInput.gender);
  const spouseElement = getTargetElementForRole(dayMasterElement, targetRole);
  const directStemSymbols = getStemSymbolsForElement(spouseElement);
  const directBranchSymbols = getBranchSymbolsForElement(spouseElement);
  const hiddenRuleSymbols = HIDDEN_SPOUSE_RULES[genderKey][dayMaster as keyof typeof HIDDEN_SPOUSE_RULES[typeof genderKey]];
  const stemRuleSymbols = hiddenRuleSymbols.filter((symbol) => Boolean(STEM_TO_ELEMENT[symbol as keyof typeof STEM_TO_ELEMENT]));
  const branchRuleSymbols = hiddenRuleSymbols.filter((symbol) => Boolean(BRANCH_TO_ELEMENT[symbol as keyof typeof BRANCH_TO_ELEMENT]));
  const directStemMatches = buildVisibleMatches(pillars, "stem", directStemSymbols);
  const directBranchMatches = buildVisibleMatches(pillars, "branch", directBranchSymbols);
  const hiddenVisibleStemMatches = buildVisibleMatches(pillars, "stem", stemRuleSymbols);
  const hiddenVisibleBranchMatches = buildVisibleMatches(pillars, "branch", branchRuleSymbols);
  const hiddenStemMatches = buildHiddenStemMatches(pillars, stemRuleSymbols);
  const hasDirectMatch = directStemMatches.length > 0 || directBranchMatches.length > 0;
  const hasHiddenMatch = hiddenVisibleStemMatches.length > 0 || hiddenVisibleBranchMatches.length > 0 || hiddenStemMatches.length > 0;
  const presenceMode = hasDirectMatch ? "direct-present" : hasHiddenMatch ? "hidden-only" : "absent";

  return {
    packetFamilies: ["strength", "role-of-element"],
    result: Source5SpouseLookupResultSchema.parse({
      kind: "spouse-element-lookup",
      targetRole,
      spouseElement,
      spouseElementLabel: ELEMENT_LABELS_TH[spouseElement],
      directRules: {
        stemSymbols: directStemSymbols,
        branchSymbols: directBranchSymbols,
      },
      directMatches: {
        stems: directStemMatches,
        branches: directBranchMatches,
      },
      hiddenRules: {
        symbols: hiddenRuleSymbols,
      },
      hiddenMatches: {
        visibleStems: hiddenVisibleStemMatches,
        visibleBranches: hiddenVisibleBranchMatches,
        hiddenStems: hiddenStemMatches,
      },
      presenceMode,
      fallbackToSpouseBaseCheingsae: presenceMode === "absent",
    }),
  };
}

function resolveCheingsaeResult(
  contract: BaziCallerContract,
  spouseLookup: Source5SpouseLookupResult,
): Source5RelationshipStepComputation<Source5RelationshipCheingsaeResult> {
  const dayMaster = contract.sharedPacketSpine.chartIdentity.dayMaster;
  const spouseBaseBranch = contract.sharedPacketSpine.chartIdentity.fourPillars.day.branch;
  const spouseBaseStage = lookupCheingsaeStage(dayMaster, spouseBaseBranch);
  const hiddenBranchCandidates = unique(
    spouseLookup.hiddenRules.symbols.filter((symbol) => Boolean(BRANCH_TO_ELEMENT[symbol as keyof typeof BRANCH_TO_ELEMENT])),
  );
  const selectedBranches = spouseLookup.presenceMode === "direct-present"
    ? spouseLookup.directRules.branchSymbols
    : spouseLookup.presenceMode === "hidden-only"
      ? (hiddenBranchCandidates.length > 0 ? hiddenBranchCandidates : [spouseBaseBranch])
      : [spouseBaseBranch];
  const spouseElementStages = unique(spouseLookup.directRules.branchSymbols).map((branch) => lookupCheingsaeStage(dayMaster, branch));
  const selectedStages = unique(selectedBranches).map((branch) => lookupCheingsaeStage(dayMaster, branch));

  return {
    packetFamilies: [],
    result: Source5RelationshipCheingsaeResultSchema.parse({
      kind: "relationship-12-cheingsae",
      source: "pillar-display.resolveCanonicalTwelveQiStage",
      selectedLane: spouseLookup.presenceMode === "direct-present"
        ? "direct-spouse-branch"
        : spouseLookup.presenceMode === "hidden-only"
          ? "hidden-spouse-branch"
          : "spouse-base-fallback",
      spouseBaseStage,
      spouseElementStages,
      selectedStages,
      qualityBand: summarizeQualityBand(selectedStages),
    }),
  };
}

function resolveConflictImpactResult(
  contract: BaziCallerContract,
  packets: readonly BaziSharedPacket[],
): Source5RelationshipStepComputation<Source5ConflictImpactResult> {
  const conflictPacket = findPacket(packets, "conflict-context");
  const consequences = conflictPacket.sections.contextMap.value
    .filter((item) => item.participants.some((participant) => participant.pillarKey === "day"))
    .map((item) => {
      const relationType = categorizeConflictFamily(item.familyKey);
      const affectedPillars = unique(
        item.participants
          .map((participant) => participant.pillarKey)
          .filter((pillarKey): pillarKey is Source5PillarKey => pillarKey === "year" || pillarKey === "month" || pillarKey === "day" || pillarKey === "hour"),
      );
      const audiences = unique(affectedPillars.flatMap((pillarKey) => getAudienceLabels(relationType, pillarKey)));
      const consequence = buildConflictMeaning(relationType, affectedPillars);

      return {
        relationId: item.relationId,
        familyKey: item.familyKey,
        relationType,
        precedence: item.precedence ?? null,
        status: item.status,
        affectedPillars,
        audiences,
        consequenceKey: consequence.consequenceKey,
        meaning: consequence.meaning,
      };
    });
  const activeRelationCounts = {
    combinations: conflictPacket.sections.resolution.value.activeCombinations.length,
    clashes: conflictPacket.sections.resolution.value.activeClashes.length,
    punishments: conflictPacket.sections.resolution.value.activePunishments.length,
    harms: conflictPacket.sections.resolution.value.activeHarms.length,
    destructions: conflictPacket.sections.resolution.value.activeDestructions.length,
  };
  const pressureScore = activeRelationCounts.clashes + activeRelationCounts.punishments + activeRelationCounts.destructions;

  return {
    packetFamilies: ["conflict-context"],
    result: Source5ConflictImpactResultSchema.parse({
      kind: "relationship-conflict-impact",
      precedenceNotes: conflictPacket.sections.resolution.value.precedenceNotes,
      activeRelationCounts,
      relationshipPressure: pressureScore >= 2 ? "elevated" : pressureScore >= 1 ? "active" : "low",
      consequences,
    }),
  };
}

function buildTimingRoleTargets(contract: BaziCallerContract, packets: readonly BaziSharedPacket[]) {
  const strengthPacket = findPacket(packets, "strength");
  const lookupState = strengthPacket.sections.profile.value.lookupState;
  const dayMasterElement = getElementFromStem(contract.sharedPacketSpine.chartIdentity.dayMaster);
  const targetRoles = lookupState === "แข็งแรงมากเกินไป"
    ? ["output"] as const
    : lookupState === "แข็งแรง/สมดุล"
      ? [contract.rawInput.gender === "female" ? "power" : "wealth"] as const
      : ["parallel", "resource"] as const;

  return {
    lookupState,
    targets: targetRoles.map((role) => {
      const targetElement = getTargetElementForRole(dayMasterElement, role);

      return {
        role,
        targetElement,
        targetElementLabel: ELEMENT_LABELS_TH[targetElement],
      };
    }),
  };
}

function assessTimingWindow(
  dayMaster: string,
  pillar: { stem: string; branch: string; startAge: number; endAge: number },
  targetRoles: z.infer<typeof Source5TimingRoleTargetSchema>[],
) {
  const stemElement = getElementFromStem(pillar.stem);
  const branchElement = getElementFromBranch(pillar.branch);
  const matchedRoles = targetRoles
    .filter((target) => target.targetElement === stemElement || target.targetElement === branchElement)
    .map((target) => target.role);
  const cheingsae = lookupCheingsaeStage(dayMaster, pillar.branch);
  const timingSignal = matchedRoles.length > 0 && cheingsae.qualityBand === "favorable"
    ? "prime-window" as const
    : matchedRoles.length > 0 || cheingsae.qualityBand === "favorable"
      ? "supportive-window" as const
      : "background-window" as const;

  return Source5TimingWindowAssessmentSchema.parse({
    pillarCode: `${pillar.stem}${pillar.branch}`,
    startAge: pillar.startAge,
    endAge: pillar.endAge,
    stemElement,
    branchElement,
    matchedRoles,
    cheingsae,
    timingSignal,
  });
}

function resolveMarriageTimingResult(
  contract: BaziCallerContract,
  packets: readonly BaziSharedPacket[],
): Source5RelationshipStepComputation<Source5MarriageTimingResult> {
  const timingPacket = findPacket(packets, "timing");
  const { lookupState, targets } = buildTimingRoleTargets(contract, packets);
  const currentDaYun = timingPacket.sections.currentWindow.value.currentDaYun;
  const projectedWindows = dedupeWindowAssessments(
    timingPacket.sections.nextWindows.value.map((window) => assessTimingWindow(contract.sharedPacketSpine.chartIdentity.dayMaster, window, targets)),
  );

  return {
    packetFamilies: ["timing", "strength", "role-of-element"],
    result: Source5MarriageTimingResultSchema.parse({
      kind: "marriage-timing",
      targetRoles: targets,
      strengthState: lookupState,
      thaiAge: timingPacket.sections.currentWindow.value.ageSnapshot.thaiAge,
      currentWindow: currentDaYun
        ? assessTimingWindow(contract.sharedPacketSpine.chartIdentity.dayMaster, currentDaYun, targets)
        : null,
      projectedWindows,
    }),
  };
}

function resolveAgeDifferenceProfile(
  contract: BaziCallerContract,
  spouseLookup: Source5SpouseLookupResult,
  conflictImpact: Source5ConflictImpactResult,
) {
  if (conflictImpact.consequences.some((consequence) => consequence.consequenceKey === "day-internal-destruction")) {
    return {
      classification: "gap-or-prior-marriage" as const,
      evidence: "พบแรงผั่วในหลักวันเอง จึงมีสัญญาณอายุห่างกันมากหรือคู่มีตำหนิเดิม",
    };
  }

  const directPillarKeys = unique([
    ...spouseLookup.directMatches.stems.map((match) => match.pillarKey),
    ...spouseLookup.directMatches.branches.map((match) => match.pillarKey),
  ]);

  if (directPillarKeys.includes("year")) {
    return {
      classification: "older-or-farther" as const,
      evidence: "สัญญาณคู่ครองขึ้นไปผูกกับหลักปี จึงโน้มไปทางอายุมากกว่าหรือมาจากไกล",
    };
  }

  if (directPillarKeys.includes("hour")) {
    return {
      classification: "younger" as const,
      evidence: "สัญญาณคู่ครองเด่นที่หลักยาม จึงโน้มไปทางอายุน้อยกว่าหรือดูเด็กกว่า",
    };
  }

  if (directPillarKeys.includes("month")) {
    return {
      classification: "same-generation" as const,
      evidence: "สัญญาณคู่ครองเด่นที่หลักเดือน จึงโน้มไปทางวัยไล่เลี่ยกันหรือเจอกันผ่านงาน/การเรียน",
    };
  }

  return {
    classification: "same-generation" as const,
    evidence: "ยังไม่มีกฎพิเศษอื่นตัดหน้าสัญญาณพื้นฐาน จึงอ่านเป็นวัยใกล้เคียงกัน",
  };
}

function resolveNationalityProfile(
  spouseLookup: Source5SpouseLookupResult,
  cheingsae: Source5RelationshipCheingsaeResult,
) {
  const directPillarKeys = unique([
    ...spouseLookup.directMatches.stems.map((match) => match.pillarKey),
    ...spouseLookup.directMatches.branches.map((match) => match.pillarKey),
  ]);

  if (cheingsae.selectedStages.some((stage) => stage.stageOrder === 7) || directPillarKeys.includes("year")) {
    return {
      classification: "different-region-or-foreign" as const,
      evidence: "มีสัญญาณแป่หรือโยงกับหลักปี จึงชี้ไปทางคู่ต่างถิ่น ต่างภูมิหลัง หรือเดินทางไกล",
    };
  }

  return {
    classification: "not-explicit" as const,
    evidence: "ยังไม่มีกฎต่างถิ่นที่เด่นพอ จึงไม่ฟันธงเรื่องเชื้อชาติหรือภูมิหลังไกล",
  };
}

function resolveStatusProfile(contract: BaziCallerContract, spouseLookup: Source5SpouseLookupResult) {
  const directStemSet = new Set(spouseLookup.directRules.stemSymbols);
  const directBranchSet = new Set(spouseLookup.directRules.branchSymbols);
  const wealthySpousePillar = getChartPillars(contract).find(([, pillar]) => (
    WEALTHY_SPOUSE_CODES.has(buildPillarCode(pillar))
    && directStemSet.has(pillar.stem)
    && directBranchSet.has(pillar.branch)
  ));

  if (wealthySpousePillar) {
    return {
      classification: "well-off" as const,
      evidence: `พบเสาคู่ครองแบบ ${buildPillarCode(wealthySpousePillar[1])} อยู่ในชุดนั่งลาภ/ไฉ่โข่ว`,
    };
  }

  return {
    classification: "not-explicit" as const,
    evidence: "ยังไม่พบรหัสคู่ครองนั่งลาภ/ไฉ่โข่วแบบชัดเจนในดวงนี้",
  };
}

function resolveSpouseCountProfile(
  dayMaster: string,
  spouseLookup: Source5SpouseLookupResult,
  cheingsae: Source5RelationshipCheingsaeResult,
) {
  const favorableBranches = spouseLookup.directMatches.branches.filter((match) => (
    FAVORABLE_CHEINGSAE_ORDERS.has(lookupCheingsaeStage(dayMaster, match.symbol).stageOrder)
  ));
  const visibleMarkerCount = unique([
    ...spouseLookup.directMatches.stems.map((match) => `${match.pillarKey}:${match.symbol}`),
    ...spouseLookup.directMatches.branches.map((match) => `${match.pillarKey}:${match.symbol}`),
  ]).length;
  const multipleSignal = visibleMarkerCount >= 2 || favorableBranches.length >= 2 || cheingsae.selectedStages.length >= 2;

  return {
    classification: multipleSignal ? "multiple-spouse-signals" as const : "single-clear-spouse-signal" as const,
    evidence: multipleSignal
      ? "มี marker คู่ครองหรือเชี่ยงแซดีหลายจุด จึงเปิดความเป็นไปได้ของสัญญาณคู่มากกว่าหนึ่ง"
      : "marker คู่ครองหลักยังรวมตัวอยู่ไม่กี่จุด จึงอ่านเป็นสัญญาณคู่หลักชัดหนึ่งเส้น",
  };
}

function resolveAppearanceDescription(spouseElement: Source5Element) {
  if (spouseElement === "wood" || spouseElement === "fire") {
    return "สูงโปร่ง";
  }

  if (spouseElement === "earth") {
    return "เนื้อแน่น ตัวหนา";
  }

  if (spouseElement === "metal") {
    return "อ้วน ตัวใหญ่ มีพุง";
  }

  return "อ้วน เนื้อเหลว มีพุง";
}

function resolveCheingsaeAccent(cheingsae: Source5RelationshipCheingsaeResult) {
  if (cheingsae.selectedStages.some((stage) => stage.stageOrder === 2)) {
    return "เชี่ยงแซหมกยกเพิ่มภาพความมีเสน่ห์และแรงดึงดูด";
  }

  if (cheingsae.selectedStages.some((stage) => stage.stageOrder === 5)) {
    return "เชี่ยงแซตี้อ๋วงเพิ่มภาพศักดิ์ศรีและความมั่นใจสูง";
  }

  if (cheingsae.selectedStages.some((stage) => stage.stageOrder === 11 || stage.stageOrder === 12)) {
    return "เชี่ยงแซทอ/เอี้ยงเพิ่มภาพความน่ารัก หน้าเด็ก หรือชวนให้ดูแล";
  }

  return "บุคลิกภายนอกยึดตามธาตุคู่ครองเป็นหลัก";
}

function resolveSpecialSignals(
  spouseLookup: Source5SpouseLookupResult,
  cheingsae: Source5RelationshipCheingsaeResult,
  conflictImpact: Source5ConflictImpactResult,
) {
  const signals: z.infer<typeof Source5SpecialSignalSchema>[] = [];

  if (spouseLookup.presenceMode === "hidden-only") {
    signals.push({
      signalKey: "hidden-spouse-only",
      label: "สัญญาณความสัมพันธ์ไม่เปิดเผย",
      evidence: "พบแต่ธาตุคู่ครองแฝง จึงตีความเป็นความสัมพันธ์เงียบ แอบคบ หรือยังไม่เปิดตัว",
    });
  }

  if (cheingsae.selectedStages.some((stage) => stage.stageOrder === 2)) {
    signals.push({
      signalKey: "bath-stage-charm",
      label: "เสน่ห์แรงหรือมีแรงเจ้าชู้",
      evidence: "มีเชี่ยงแซหมกยกใน lane คู่ครอง จึงยกสัญญาณเสน่ห์แรงหรือมีแรงดึงดูดเชิงรักซ้อน",
    });
  }

  if (conflictImpact.consequences.filter((consequence) => consequence.relationType === "combination").length >= 2) {
    signals.push({
      signalKey: "multiple-combination-network",
      label: "เครือข่ายคนเข้าหาเยอะ",
      evidence: "ฐานคู่เกิดภาคีหลายจุด จึงอ่านเป็นคู่มีสังคมหรือมีคนเข้าหามาก",
    });
  }

  if (
    cheingsae.selectedStages.some((stage) => stage.stageOrder === 7)
    && conflictImpact.consequences.some((consequence) => consequence.relationType === "combination")
  ) {
    signals.push({
      signalKey: "distance-affair-risk",
      label: "สัญญาณรักไกลหรือคบซ้อนจากการเดินทาง/สังคม",
      evidence: "เชี่ยงแซแป่ทำงานร่วมกับภาคี จึงยกสัญญาณรักไกลหรือความสัมพันธ์หลายเส้นพร้อมกัน",
    });
  }

  return signals;
}

function resolveSpecialRulesResult(
  contract: BaziCallerContract,
  spouseLookup: Source5SpouseLookupResult,
  cheingsae: Source5RelationshipCheingsaeResult,
  conflictImpact: Source5ConflictImpactResult,
): Source5RelationshipStepComputation<Source5SpecialRulesResult> {
  return {
    packetFamilies: ["role-of-element", "conflict-context"],
    result: Source5SpecialRulesResultSchema.parse({
      kind: "special-rules-and-spouse-profile",
      specialSignals: resolveSpecialSignals(spouseLookup, cheingsae, conflictImpact),
      spouseProfile: {
        appearance: {
          spouseElement: spouseLookup.spouseElement,
          description: resolveAppearanceDescription(spouseLookup.spouseElement),
          cheingsaeAccent: resolveCheingsaeAccent(cheingsae),
        },
        ageDifference: resolveAgeDifferenceProfile(contract, spouseLookup, conflictImpact),
        nationality: resolveNationalityProfile(spouseLookup, cheingsae),
        status: resolveStatusProfile(contract, spouseLookup),
        spouseCountSignal: resolveSpouseCountProfile(contract.sharedPacketSpine.chartIdentity.dayMaster, spouseLookup, cheingsae),
      },
    }),
  };
}

export function buildSource5RelationshipStepResult(
  stepId: Source5StepId,
  packets: readonly BaziSharedPacket[],
  contract: BaziCallerContract,
): Source5RelationshipStepComputation {
  if (stepId === "step-1-relationship-potential") {
    return resolvePotentialResult(contract, packets);
  }

  if (stepId === "step-2-day-stem-vs-spouse-base") {
    return resolveDayStemVsSpouseBaseResult(contract);
  }

  const spouseLookup = resolveSpouseLookupResult(contract).result;

  if (stepId === "step-3-spouse-element-lookup") {
    return {
      packetFamilies: ["strength", "role-of-element"],
      result: spouseLookup,
    };
  }

  const cheingsae = resolveCheingsaeResult(contract, spouseLookup).result;

  if (stepId === "step-4-relationship-12-cheingsae") {
    return {
      packetFamilies: [],
      result: cheingsae,
    };
  }

  const conflictImpact = resolveConflictImpactResult(contract, packets).result;

  if (stepId === "step-5-conflict-and-interaction") {
    return {
      packetFamilies: ["conflict-context"],
      result: conflictImpact,
    };
  }

  if (stepId === "step-6-marriage-timing") {
    return resolveMarriageTimingResult(contract, packets);
  }

  return resolveSpecialRulesResult(contract, spouseLookup, cheingsae, conflictImpact);
}