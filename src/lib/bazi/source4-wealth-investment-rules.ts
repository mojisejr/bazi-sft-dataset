import { z } from "zod";

import {
  localizeTwelveQiLabel,
  resolveCanonicalTwelveQiStage,
} from "@/lib/bazi/pillar-display";
import type { BaziCallerContract } from "@/lib/bazi/symbolic-engine.caller-contract";
import {
  BaziSharedPacketFamilySchema,
  type BaziSharedPacket,
} from "@/lib/bazi/symbolic-engine.shared-packets";
import {
  BRANCH_HIDDEN_STEMS,
  BRANCH_LABELS_TH,
  BRANCH_TO_ELEMENT,
  CONTROLS,
  ELEMENT_LABELS_TH,
  GENERATES,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";

const SOURCE4_STRENGTH_BAND_IDS = ["very-weak", "weak", "balanced", "strong", "very-strong"] as const;
const SOURCE4_ELEMENT_IDS = ["wood", "fire", "earth", "metal", "water"] as const;
const SOURCE4_CAPACITY_BAND_IDS = ["constrained", "limited", "stable", "productive", "competitive"] as const;
const SOURCE4_STORAGE_STATUS_IDS = [
  "vault-not-manifest",
  "stored-and-guarded",
  "vault-opened-for-use",
  "leakage-prone",
] as const;
const SOURCE4_LEAKAGE_SEVERITY_IDS = ["low", "watch", "elevated", "high"] as const;
const SOURCE4_SOURCE_MODE_IDS = ["vault-anchored", "cashflow-primary"] as const;
const SOURCE4_OUTPUT_PRESENCE_MODE_IDS = ["visible-present", "hidden-fallback", "absent"] as const;
const SOURCE4_BEHAVIOR_PROFILE_IDS = [
  "growth-led",
  "indulgent",
  "knowledge-led",
  "authority-led",
  "aggressive",
  "slow-cycle",
  "high-burn",
  "capital-preserving",
  "asset-accumulating",
  "loss-prone",
  "incremental",
  "service-passive",
] as const;
const SOURCE4_SUPPORT_SIGNAL_IDS = ["supported", "mixed", "unsupported"] as const;
const SOURCE4_GUIDANCE_MODE_IDS = ["reinforce-capacity", "maintain-balance", "enhance-efficiency"] as const;
const SOURCE4_TIMING_NEED_IDS = ["reinforce-capacity", "maintain-circulation", "release-into-wealth"] as const;
const SOURCE4_TIMING_WINDOW_IDS = ["favorable-window", "selective-window", "capital-preservation-window"] as const;
const SOURCE4_RISK_BOUNDARY_IDS = ["bounded-opportunity", "selective-risk", "capital-preservation"] as const;
const SOURCE4_TIMING_WEIGHTING = {
  daYun: 0.6,
  liuNian: 0.4,
} as const;
const SOURCE4_TWELVE_QI_ORDER = ["长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养"] as const;

const Source4StrengthBandIdSchema = z.enum(SOURCE4_STRENGTH_BAND_IDS);
const Source4ElementSchema = z.enum(SOURCE4_ELEMENT_IDS);
const Source4CapacityBandSchema = z.enum(SOURCE4_CAPACITY_BAND_IDS);
const Source4StorageStatusSchema = z.enum(SOURCE4_STORAGE_STATUS_IDS);
const Source4LeakageSeveritySchema = z.enum(SOURCE4_LEAKAGE_SEVERITY_IDS);
const Source4SourceModeSchema = z.enum(SOURCE4_SOURCE_MODE_IDS);
const Source4OutputPresenceModeSchema = z.enum(SOURCE4_OUTPUT_PRESENCE_MODE_IDS);
const Source4BehaviorProfileSchema = z.enum(SOURCE4_BEHAVIOR_PROFILE_IDS);
const Source4SupportSignalSchema = z.enum(SOURCE4_SUPPORT_SIGNAL_IDS);
const Source4GuidanceModeSchema = z.enum(SOURCE4_GUIDANCE_MODE_IDS);
const Source4TimingNeedSchema = z.enum(SOURCE4_TIMING_NEED_IDS);
const Source4TimingWindowSchema = z.enum(SOURCE4_TIMING_WINDOW_IDS);
const Source4RiskBoundarySchema = z.enum(SOURCE4_RISK_BOUNDARY_IDS);

const Source4RoleElementPairSchema = z.object({
  role: z.enum(["resource", "parallel", "output", "wealth"]),
  element: Source4ElementSchema,
  elementLabel: z.string().trim().min(1),
});

const Source4PillarMatchSchema = z.object({
  pillarKey: z.enum(["year", "month", "day", "hour"]),
  pillarCode: z.string().trim().min(2),
  symbol: z.string().trim().min(1),
});

const Source4HiddenStemMatchSchema = z.object({
  pillarKey: z.enum(["year", "month", "day", "hour"]),
  pillarCode: z.string().trim().min(2),
  branch: z.string().trim().min(1),
  hiddenStem: z.string().trim().min(1),
});

const Source4StageInfoSchema = z.object({
  source: z.literal("pillar-display.resolveCanonicalTwelveQiStage"),
  stem: z.string().trim().min(1),
  branch: z.string().trim().min(1),
  branchLabel: z.string().trim().min(1),
  stageOrder: z.number().int().min(1).max(SOURCE4_TWELVE_QI_ORDER.length),
  stageNameChinese: z.enum(SOURCE4_TWELVE_QI_ORDER),
  stageNameThai: z.string().trim().min(1),
  signal: z.enum(["supportive", "mixed", "resistant"]),
});

const Source4WealthCapacityResultSchema = z.object({
  kind: z.literal("wealth-capacity-routing"),
  strengthBandId: Source4StrengthBandIdSchema,
  strengthState: z.string().trim().min(1),
  semanticId: z.string().trim().min(1),
  capacityBand: Source4CapacityBandSchema,
  capacityLabel: z.string().trim().min(1),
});

const Source4StorageVaultSchema = z.object({
  branch: z.string().trim().min(1),
  branchLabel: z.string().trim().min(1),
  presenceMode: z.enum(["direct-present", "absent"]),
  directMatches: z.array(Source4PillarMatchSchema),
});

const Source4DestroyerPolicySchema = z.object({
  directDestroyerStem: z.string().trim().min(1),
  partialDestroyerStems: z.array(z.string().trim().min(1)).min(1),
});

const Source4SpecialInteractionSchema = z.object({
  branch: z.string().trim().min(1),
  signal: z.enum(["supportive", "destabilizing"]),
  note: z.string().trim().min(1),
});

const Source4WealthLookupResultSchema = z.object({
  kind: z.literal("wealth-element-storage-destroyer-lookup"),
  wealthLane: Source4RoleElementPairSchema,
  storageVault: Source4StorageVaultSchema,
  destroyerPolicy: Source4DestroyerPolicySchema,
  destroyerMatches: z.object({
    directVisible: z.array(Source4PillarMatchSchema),
    directHidden: z.array(Source4HiddenStemMatchSchema),
    partialVisible: z.array(Source4PillarMatchSchema),
    partialHidden: z.array(Source4HiddenStemMatchSchema),
  }),
  specialInteractionSignals: z.array(Source4SpecialInteractionSchema),
});

const Source4MoneySourceLaneSchema = z.object({
  pillarKey: z.enum(["year", "month", "day", "hour"]),
  pillarCode: z.string().trim().min(2),
  sourceId: z.enum([
    "legacy-and-customer-base",
    "family-and-work-base",
    "self-and-close-circle",
    "team-and-late-life-base",
  ]),
  label: z.string().trim().min(1),
});

const Source4MoneySourceAndLeakageResultSchema = z.object({
  kind: z.literal("money-source-storage-and-leakage"),
  sourceMode: Source4SourceModeSchema,
  sourceLanes: z.array(Source4MoneySourceLaneSchema),
  fallbackSourceLabel: z.string().trim().min(1),
  storageStatus: Source4StorageStatusSchema,
  leakageSeverity: Source4LeakageSeveritySchema,
  partnerMoneyDefaultApplied: z.literal(false),
  timingPressure: z.object({
    directDestroyerActive: z.boolean(),
    vaultClashActive: z.boolean(),
    activeWindowPillars: z.array(z.string().trim().min(2)),
  }),
  notes: z.array(z.string().trim().min(1)).min(1),
});

const Source4SpendingInvestmentBehaviorResultSchema = z.object({
  kind: z.literal("spending-and-investment-behavior"),
  outputLane: Source4RoleElementPairSchema,
  outputPresenceMode: Source4OutputPresenceModeSchema,
  visibleOutputCount: z.number().int().nonnegative(),
  hiddenOutputCount: z.number().int().nonnegative(),
  outputStage: Source4StageInfoSchema,
  behaviorProfileId: Source4BehaviorProfileSchema,
  spendingStyle: z.string().trim().min(1),
  investmentStyle: z.string().trim().min(1),
  supportSignal: Source4SupportSignalSchema,
  source6ContextRequired: z.literal(false),
});

const Source4RecommendedElementSchema = z.object({
  element: Source4ElementSchema,
  elementLabel: z.string().trim().min(1),
  businessThemes: z.array(z.string().trim().min(1)).min(1),
});

const Source4WealthSolutionResultSchema = z.object({
  kind: z.literal("wealth-solution-lane"),
  guidanceMode: Source4GuidanceModeSchema,
  recommendedElements: z.array(Source4RecommendedElementSchema).min(1),
  guardrail: z.literal("no-source7-remedy"),
});

const Source4WindowNeedSchema = z.object({
  family: Source4TimingNeedSchema,
  preferredElements: z.array(Source4ElementSchema).min(1),
  note: z.string().trim().min(1),
});

const Source4WindowEvaluationSchema = z.object({
  pillarCode: z.string().trim().min(2),
  elementSignals: z.array(Source4ElementSchema).min(1),
  matchesNeed: z.boolean(),
  wealthStage: Source4StageInfoSchema,
});

const Source4WealthTimingRiskWindowResultSchema = z.object({
  kind: z.literal("wealth-timing-and-risk-window"),
  windowNeed: Source4WindowNeedSchema,
  weighting: z.object({
    daYun: z.literal(SOURCE4_TIMING_WEIGHTING.daYun),
    liuNian: z.literal(SOURCE4_TIMING_WEIGHTING.liuNian),
  }),
  daYunWindow: Source4WindowEvaluationSchema,
  liuNianWindow: Source4WindowEvaluationSchema,
  weightedScore: z.number(),
  timingWindow: Source4TimingWindowSchema,
  riskBoundary: Source4RiskBoundarySchema,
  leakageAdjustmentApplied: z.boolean(),
  forbiddenClaims: z.array(z.string().trim().min(1)).min(2),
});

export const Source4WealthInvestmentStepResultSchema = z.discriminatedUnion("kind", [
  Source4WealthCapacityResultSchema,
  Source4WealthLookupResultSchema,
  Source4MoneySourceAndLeakageResultSchema,
  Source4SpendingInvestmentBehaviorResultSchema,
  Source4WealthSolutionResultSchema,
  Source4WealthTimingRiskWindowResultSchema,
]);

export type Source4WealthInvestmentStepResult = z.infer<typeof Source4WealthInvestmentStepResultSchema>;
export type Source4WealthLookupResult = z.infer<typeof Source4WealthLookupResultSchema>;
export type Source4MoneySourceAndLeakageResult = z.infer<typeof Source4MoneySourceAndLeakageResultSchema>;

export type Source4WealthInvestmentStepComputation = {
  packetFamilies: Array<z.infer<typeof BaziSharedPacketFamilySchema>>;
  result: Source4WealthInvestmentStepResult;
};

type Source4Element = z.infer<typeof Source4ElementSchema>;
type Source4StageInfo = z.infer<typeof Source4StageInfoSchema>;

const FAVORABLE_OUTPUT_STAGES = new Set(["长生", "冠带", "临官", "帝旺", "墓", "养"]);
const FAVORABLE_TIMING_STAGES = new Set(["长生", "临官", "帝旺"]);
const NEUTRAL_STAGES = new Set(["沐浴", "胎"]);

const WEALTH_CAPACITY_POLICY: Record<z.infer<typeof Source4StrengthBandIdSchema>, {
  capacityBand: z.infer<typeof Source4CapacityBandSchema>;
  label: string;
}> = {
  "very-weak": {
    capacityBand: "constrained",
    label: "Needs support first before pushing for money expansion.",
  },
  weak: {
    capacityBand: "limited",
    label: "Can earn for stability, but capacity must be reinforced before larger risk.",
  },
  balanced: {
    capacityBand: "stable",
    label: "Can earn and hold money with a balanced operating base.",
  },
  strong: {
    capacityBand: "productive",
    label: "Can turn output into money, but still needs storage discipline.",
  },
  "very-strong": {
    capacityBand: "competitive",
    label: "Can chase money aggressively, but competition and leakage pressure rise fast.",
  },
};

const WEALTH_SOURCE_BY_PILLAR = {
  year: {
    sourceId: "legacy-and-customer-base",
    label: "Legacy assets or established customer base.",
  },
  month: {
    sourceId: "family-and-work-base",
    label: "Family backing, work lane, or operating business base.",
  },
  day: {
    sourceId: "self-and-close-circle",
    label: "Self-directed cashflow or close-circle asset lane.",
  },
  hour: {
    sourceId: "team-and-late-life-base",
    label: "Team, younger generation, or late-life asset lane.",
  },
} as const;

const WEALTH_SOLUTION_POLICY: Record<Source4Element, {
  strong: Source4Element[];
  weak: Source4Element[];
}> = {
  wood: {
    strong: ["fire"],
    weak: ["water", "wood"],
  },
  fire: {
    strong: ["earth", "metal"],
    weak: ["wood", "fire"],
  },
  earth: {
    strong: ["metal", "water"],
    weak: ["fire", "earth"],
  },
  metal: {
    strong: ["water", "wood"],
    weak: ["earth", "metal"],
  },
  water: {
    strong: ["wood", "fire"],
    weak: ["metal", "water"],
  },
};

const ELEMENT_BUSINESS_THEMES: Record<Source4Element, string[]> = {
  earth: ["property", "materials", "trust and stability", "agriculture"],
  metal: ["technology", "machinery", "vehicles", "precision goods"],
  water: ["finance", "transport", "food and beverage", "service"],
  wood: ["education", "textiles", "herbs", "publishing"],
  fire: ["energy", "media", "beauty", "cooked food"],
};

const OUTPUT_STAGE_BEHAVIOR_POLICY: Record<(typeof SOURCE4_TWELVE_QI_ORDER)[number], {
  behaviorProfileId: z.infer<typeof Source4BehaviorProfileSchema>;
  spendingStyle: string;
  investmentStyle: string;
}> = {
  长生: {
    behaviorProfileId: "growth-led",
    spendingStyle: "Spends for growth, capability, and forward movement.",
    investmentStyle: "Leans toward new ventures and growth-stage bets.",
  },
  沐浴: {
    behaviorProfileId: "indulgent",
    spendingStyle: "Can spend on image, pleasure, or aesthetic temptation.",
    investmentStyle: "Attracted to trend-led or vanity-driven bets.",
  },
  冠带: {
    behaviorProfileId: "knowledge-led",
    spendingStyle: "Prefers spending on expertise, tools, and learning.",
    investmentStyle: "Favors information-rich or specialist plays.",
  },
  临官: {
    behaviorProfileId: "authority-led",
    spendingStyle: "Spends to reinforce authority, position, and structure.",
    investmentStyle: "Leans toward institutional or reputation-backed assets.",
  },
  帝旺: {
    behaviorProfileId: "aggressive",
    spendingStyle: "Can spend boldly to signal power or scale quickly.",
    investmentStyle: "More willing to negotiate hard or speculate assertively.",
  },
  衰: {
    behaviorProfileId: "slow-cycle",
    spendingStyle: "Spends carefully around slow, old, or delayed cycles.",
    investmentStyle: "Leans toward slower-return or legacy assets.",
  },
  病: {
    behaviorProfileId: "high-burn",
    spendingStyle: "Risk of scattered expenses or high-maintenance spending.",
    investmentStyle: "Can overcommit to fast-moving or capital-heavy bets.",
  },
  死: {
    behaviorProfileId: "capital-preserving",
    spendingStyle: "Can become tight-fisted or freeze spending under risk.",
    investmentStyle: "Avoids risk or fears sunk-cost outcomes.",
  },
  墓: {
    behaviorProfileId: "asset-accumulating",
    spendingStyle: "Comfortable storing value in durable or accumulative assets.",
    investmentStyle: "Favors property, land, or building from existing capital.",
  },
  绝: {
    behaviorProfileId: "loss-prone",
    spendingStyle: "Prone to wasteful or painful expense leaks.",
    investmentStyle: "High damage risk if capital is pushed too early.",
  },
  胎: {
    behaviorProfileId: "incremental",
    spendingStyle: "Prefers small, frequent, or gradual spending.",
    investmentStyle: "Builds slowly through long-horizon accumulation.",
  },
  养: {
    behaviorProfileId: "service-passive",
    spendingStyle: "Spends on care, support, or small maintenance loops.",
    investmentStyle: "Can drift into passive or service-oriented investment lanes.",
  },
};

const WEALTH_LOOKUP_POLICY = {
  甲: {
    vaultBranch: "辰",
    directDestroyerStem: "戊",
    partialDestroyerStems: ["乙", "癸"],
    supportiveBranches: ["子"],
    destabilizingBranches: ["辰", "未", "丑", "戌"],
  },
  乙: {
    vaultBranch: "辰",
    directDestroyerStem: "戊",
    partialDestroyerStems: ["乙", "癸"],
    supportiveBranches: ["子"],
    destabilizingBranches: ["辰", "未", "丑", "戌"],
  },
  丙: {
    vaultBranch: "丑",
    directDestroyerStem: "癸",
    partialDestroyerStems: ["辛", "己"],
    supportiveBranches: ["酉"],
    destabilizingBranches: ["辰", "未", "戌"],
  },
  丁: {
    vaultBranch: "丑",
    directDestroyerStem: "癸",
    partialDestroyerStems: ["辛", "己"],
    supportiveBranches: ["酉"],
    destabilizingBranches: ["辰", "未", "戌"],
  },
  戊: {
    vaultBranch: "辰",
    directDestroyerStem: "戊",
    partialDestroyerStems: ["乙", "癸"],
    supportiveBranches: ["申", "子"],
    destabilizingBranches: ["辰", "未", "丑", "戌"],
  },
  己: {
    vaultBranch: "辰",
    directDestroyerStem: "戊",
    partialDestroyerStems: ["乙", "癸"],
    supportiveBranches: ["申", "子"],
    destabilizingBranches: ["辰", "未", "丑", "戌"],
  },
  庚: {
    vaultBranch: "未",
    directDestroyerStem: "己",
    partialDestroyerStems: ["乙", "丁"],
    supportiveBranches: ["卯"],
    destabilizingBranches: ["午"],
  },
  辛: {
    vaultBranch: "未",
    directDestroyerStem: "己",
    partialDestroyerStems: ["乙", "丁"],
    supportiveBranches: [],
    destabilizingBranches: ["卯", "午"],
  },
  壬: {
    vaultBranch: "戌",
    directDestroyerStem: "戊",
    partialDestroyerStems: ["辛", "丁"],
    supportiveBranches: ["午", "卯"],
    destabilizingBranches: [],
  },
  癸: {
    vaultBranch: "戌",
    directDestroyerStem: "戊",
    partialDestroyerStems: ["辛", "丁"],
    supportiveBranches: ["卯"],
    destabilizingBranches: ["午"],
  },
} as const;

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function findPacket<F extends BaziSharedPacket["family"]>(
  packets: readonly BaziSharedPacket[],
  family: F,
): Extract<BaziSharedPacket, { family: F }> {
  const packet = packets.find(
    (candidate): candidate is Extract<BaziSharedPacket, { family: F }> => candidate.family === family,
  );

  if (!packet) {
    throw new Error(`Source 4 rules are missing required packet family: ${family}`);
  }

  return packet;
}

function getElementFromStem(stem: string): Source4Element {
  const element = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];

  if (!element) {
    throw new Error(`Unsupported Source 4 stem element lookup: ${stem}`);
  }

  return element;
}

function getElementFromBranch(branch: string): Source4Element {
  const element = BRANCH_TO_ELEMENT[branch as keyof typeof BRANCH_TO_ELEMENT];

  if (!element) {
    throw new Error(`Unsupported Source 4 branch element lookup: ${branch}`);
  }

  return element;
}

function invertMapLookup(
  map: Record<Source4Element, Source4Element>,
  target: Source4Element,
): Source4Element {
  const entry = Object.entries(map).find(([, value]) => value === target);

  if (!entry) {
    throw new Error(`Unsupported Source 4 inverse element lookup: ${target}`);
  }

  return entry[0] as Source4Element;
}

function getTargetElementForRole(dayMasterElement: Source4Element, role: "resource" | "parallel" | "output" | "wealth") {
  if (role === "parallel") {
    return dayMasterElement;
  }

  if (role === "resource") {
    return invertMapLookup(GENERATES, dayMasterElement);
  }

  if (role === "output") {
    return GENERATES[dayMasterElement];
  }

  return CONTROLS[dayMasterElement];
}

function getRepresentativeStemForElement(element: Source4Element) {
  const stem = Object.entries(STEM_TO_ELEMENT).find(([, value]) => value === element)?.[0];

  if (!stem) {
    throw new Error(`Unsupported Source 4 representative stem lookup: ${element}`);
  }

  return stem;
}

function buildRoleElementPair(dayMasterElement: Source4Element, role: "resource" | "parallel" | "output" | "wealth") {
  const element = getTargetElementForRole(dayMasterElement, role);

  return Source4RoleElementPairSchema.parse({
    role,
    element,
    elementLabel: ELEMENT_LABELS_TH[element],
  });
}

function getChartPillars(contract: BaziCallerContract) {
  return Object.entries(contract.sharedPacketSpine.chartIdentity.fourPillars).map(([pillarKey, pillar]) => ({
    pillarKey: pillarKey as "year" | "month" | "day" | "hour",
    pillar,
  }));
}

function buildPillarCode(stem: string, branch: string) {
  return `${stem}${branch}`;
}

function buildStageInfo(stem: string, branch: string): Source4StageInfo {
  const stageNameChinese = resolveCanonicalTwelveQiStage(stem, branch);

  if (!stageNameChinese) {
    throw new Error(`Missing canonical Source 4 stage for ${stem}/${branch}`);
  }

  const stageOrder = SOURCE4_TWELVE_QI_ORDER.indexOf(
    stageNameChinese as (typeof SOURCE4_TWELVE_QI_ORDER)[number],
  ) + 1;

  if (stageOrder <= 0) {
    throw new Error(`Unsupported Source 4 stage for ${stem}/${branch}: ${stageNameChinese}`);
  }

  const signal = FAVORABLE_OUTPUT_STAGES.has(stageNameChinese)
    ? "supportive"
    : NEUTRAL_STAGES.has(stageNameChinese)
      ? "mixed"
      : "resistant";

  return Source4StageInfoSchema.parse({
    source: "pillar-display.resolveCanonicalTwelveQiStage",
    stem,
    branch,
    branchLabel: BRANCH_LABELS_TH[branch as keyof typeof BRANCH_LABELS_TH] ?? branch,
    stageOrder,
    stageNameChinese,
    stageNameThai: localizeTwelveQiLabel(stageNameChinese),
    signal,
  });
}

function findVisibleStemMatches(contract: BaziCallerContract, stems: readonly string[]) {
  return getChartPillars(contract).flatMap(({ pillarKey, pillar }) => (
    stems.includes(pillar.stem)
      ? [{ pillarKey, pillarCode: buildPillarCode(pillar.stem, pillar.branch), symbol: pillar.stem }]
      : []
  ));
}

function findHiddenStemMatches(contract: BaziCallerContract, stems: readonly string[]) {
  return getChartPillars(contract).flatMap(({ pillarKey, pillar }) => {
    const hiddenStems = BRANCH_HIDDEN_STEMS[pillar.branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? [];

    return hiddenStems.flatMap((hiddenStem) => (
      stems.includes(hiddenStem)
        ? [{
          pillarKey,
          pillarCode: buildPillarCode(pillar.stem, pillar.branch),
          branch: pillar.branch,
          hiddenStem,
        }]
        : []
    ));
  });
}

function findBranchMatches(contract: BaziCallerContract, branch: string) {
  return getChartPillars(contract).flatMap(({ pillarKey, pillar }) => (
    pillar.branch === branch
      ? [{ pillarKey, pillarCode: buildPillarCode(pillar.stem, pillar.branch), symbol: pillar.branch }]
      : []
  ));
}

function countVisibleElementMatches(contract: BaziCallerContract, element: Source4Element) {
  return getChartPillars(contract).reduce((count, { pillar }) => {
    const stemMatch = getElementFromStem(pillar.stem) === element ? 1 : 0;
    const branchMatch = getElementFromBranch(pillar.branch) === element ? 1 : 0;

    return count + stemMatch + branchMatch;
  }, 0);
}

function countHiddenElementMatches(contract: BaziCallerContract, element: Source4Element) {
  return getChartPillars(contract).reduce((count, { pillar }) => {
    const hiddenStems = BRANCH_HIDDEN_STEMS[pillar.branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? [];

    return count + hiddenStems.filter((hiddenStem) => getElementFromStem(hiddenStem) === element).length;
  }, 0);
}

function getVaultClashBranch(vaultBranch: string) {
  if (vaultBranch === "辰") {
    return "戌";
  }

  if (vaultBranch === "戌") {
    return "辰";
  }

  if (vaultBranch === "丑") {
    return "未";
  }

  return "丑";
}

function buildWealthCapacityResult(
  contract: BaziCallerContract,
  packets: readonly BaziSharedPacket[],
) {
  const strengthPacket = findPacket(packets, "strength");
  findPacket(packets, "role-of-element");
  const profile = strengthPacket.sections.profile.value;
  const policy = WEALTH_CAPACITY_POLICY[profile.bandId as z.infer<typeof Source4StrengthBandIdSchema>];

  return Source4WealthCapacityResultSchema.parse({
    kind: "wealth-capacity-routing",
    strengthBandId: profile.bandId,
    strengthState: profile.lookupState,
    semanticId: profile.semanticId,
    capacityBand: policy.capacityBand,
    capacityLabel: policy.label,
  });
}

function buildWealthLookupResult(
  contract: BaziCallerContract,
  packets: readonly BaziSharedPacket[],
) {
  findPacket(packets, "role-of-element");
  const dayMaster = contract.sharedPacketSpine.chartIdentity.dayMaster as keyof typeof WEALTH_LOOKUP_POLICY;
  const dayMasterElement = getElementFromStem(dayMaster);
  const lookupPolicy = WEALTH_LOOKUP_POLICY[dayMaster];
  const directMatches = findBranchMatches(contract, lookupPolicy.vaultBranch);
  const directVisible = findVisibleStemMatches(contract, [lookupPolicy.directDestroyerStem]);
  const directHidden = findHiddenStemMatches(contract, [lookupPolicy.directDestroyerStem]);
  const partialVisible = findVisibleStemMatches(contract, lookupPolicy.partialDestroyerStems);
  const partialHidden = findHiddenStemMatches(contract, lookupPolicy.partialDestroyerStems);
  const chartBranches = getChartPillars(contract).map(({ pillar }) => pillar.branch);
  const specialInteractionSignals = [
    ...lookupPolicy.supportiveBranches
      .filter((branch) => chartBranches.includes(branch))
      .map((branch) => ({
        branch,
        signal: "supportive" as const,
        note: "Manual supportive branch appears alongside the wealth vault lane.",
      })),
    ...lookupPolicy.destabilizingBranches
      .filter((branch) => chartBranches.includes(branch))
      .map((branch) => ({
        branch,
        signal: "destabilizing" as const,
        note: "Manual destabilizing branch appears and can weaken wealth storage.",
      })),
  ];

  return Source4WealthLookupResultSchema.parse({
    kind: "wealth-element-storage-destroyer-lookup",
    wealthLane: buildRoleElementPair(dayMasterElement, "wealth"),
    storageVault: {
      branch: lookupPolicy.vaultBranch,
      branchLabel: BRANCH_LABELS_TH[lookupPolicy.vaultBranch as keyof typeof BRANCH_LABELS_TH] ?? lookupPolicy.vaultBranch,
      presenceMode: directMatches.length > 0 ? "direct-present" : "absent",
      directMatches,
    },
    destroyerPolicy: {
      directDestroyerStem: lookupPolicy.directDestroyerStem,
      partialDestroyerStems: lookupPolicy.partialDestroyerStems,
    },
    destroyerMatches: {
      directVisible,
      directHidden,
      partialVisible,
      partialHidden,
    },
    specialInteractionSignals,
  });
}

function buildMoneySourceAndLeakageResult(
  contract: BaziCallerContract,
  packets: readonly BaziSharedPacket[],
  wealthLookup: Source4WealthLookupResult,
) {
  const timingPacket = findPacket(packets, "timing");
  const currentDaYun = timingPacket.sections.currentWindow.value.currentDaYun;
  const liuNian = timingPacket.sections.currentWindow.value.liuNian;
  const clashBranch = getVaultClashBranch(wealthLookup.storageVault.branch);
  const directDestroyerCount = wealthLookup.destroyerMatches.directVisible.length + wealthLookup.destroyerMatches.directHidden.length;
  const partialDestroyerCount = wealthLookup.destroyerMatches.partialVisible.length + wealthLookup.destroyerMatches.partialHidden.length;
  const vaultClashCount = findBranchMatches(contract, clashBranch).length;
  const activeWindowPillars = [currentDaYun, liuNian]
    .filter((window): window is NonNullable<typeof window> => Boolean(window))
    .flatMap((window) => {
      const touchesDestroyer = window.stem === wealthLookup.destroyerPolicy.directDestroyerStem
        || wealthLookup.destroyerPolicy.partialDestroyerStems.includes(window.stem);
      const touchesVaultClash = window.branch === clashBranch;

      return touchesDestroyer || touchesVaultClash
        ? [buildPillarCode(window.stem, window.branch)]
        : [];
    });
  const timingPressureCount = activeWindowPillars.length;
  const leakageSeverity = directDestroyerCount + timingPressureCount >= 2 || (directDestroyerCount > 0 && vaultClashCount > 0)
    ? "high"
    : directDestroyerCount > 0
      ? "elevated"
      : partialDestroyerCount > 0 || vaultClashCount > 0 || timingPressureCount > 0
        ? "watch"
        : "low";
  const sourceLanes = wealthLookup.storageVault.directMatches.map((match) => ({
    pillarKey: match.pillarKey,
    pillarCode: match.pillarCode,
    sourceId: WEALTH_SOURCE_BY_PILLAR[match.pillarKey].sourceId,
    label: WEALTH_SOURCE_BY_PILLAR[match.pillarKey].label,
  }));
  const storageStatus = wealthLookup.storageVault.directMatches.length === 0
    ? "vault-not-manifest"
    : directDestroyerCount > 0 || partialDestroyerCount > 1
      ? "leakage-prone"
      : vaultClashCount > 0
        ? "vault-opened-for-use"
        : "stored-and-guarded";
  const notes = wealthLookup.storageVault.directMatches.length === 0
    ? [
      "Vault branch is not manifest, so Source 4 stays on cashflow and leakage rather than inheritance or partner-money claims.",
    ]
    : [
      "Money source is anchored to manifest storage positions before any relationship or career context is added.",
    ];

  return Source4MoneySourceAndLeakageResultSchema.parse({
    kind: "money-source-storage-and-leakage",
    sourceMode: wealthLookup.storageVault.directMatches.length > 0 ? "vault-anchored" : "cashflow-primary",
    sourceLanes,
    fallbackSourceLabel: wealthLookup.storageVault.directMatches.length > 0
      ? "Storage-backed money lane is manifest in the chart."
      : "Money flow is chart-visible, but stored wealth is not anchored to a manifest vault branch.",
    storageStatus,
    leakageSeverity,
    partnerMoneyDefaultApplied: false,
    timingPressure: {
      directDestroyerActive: directDestroyerCount > 0 || activeWindowPillars.some((pillarCode) => pillarCode.startsWith(wealthLookup.destroyerPolicy.directDestroyerStem)),
      vaultClashActive: vaultClashCount > 0 || activeWindowPillars.some((pillarCode) => pillarCode.endsWith(clashBranch)),
      activeWindowPillars,
    },
    notes,
  });
}

function buildSpendingInvestmentBehaviorResult(
  contract: BaziCallerContract,
  packets: readonly BaziSharedPacket[],
) {
  findPacket(packets, "role-of-element");
  findPacket(packets, "timing");
  const dayMasterElement = getElementFromStem(contract.sharedPacketSpine.chartIdentity.dayMaster);
  const outputLane = buildRoleElementPair(dayMasterElement, "output");
  const visibleOutputCount = countVisibleElementMatches(contract, outputLane.element);
  const hiddenOutputCount = countHiddenElementMatches(contract, outputLane.element);
  const outputPresenceMode = visibleOutputCount > 0
    ? "visible-present"
    : hiddenOutputCount > 0
      ? "hidden-fallback"
      : "absent";
  const outputStage = buildStageInfo(
    getRepresentativeStemForElement(outputLane.element),
    contract.sharedPacketSpine.chartIdentity.fourPillars.month.branch,
  );
  const behavior = OUTPUT_STAGE_BEHAVIOR_POLICY[outputStage.stageNameChinese];
  const supportSignal = visibleOutputCount >= 2 || FAVORABLE_OUTPUT_STAGES.has(outputStage.stageNameChinese)
    ? "supported"
    : outputPresenceMode === "hidden-fallback" || outputStage.signal === "mixed"
      ? "mixed"
      : "unsupported";

  return Source4SpendingInvestmentBehaviorResultSchema.parse({
    kind: "spending-and-investment-behavior",
    outputLane,
    outputPresenceMode,
    visibleOutputCount,
    hiddenOutputCount,
    outputStage,
    behaviorProfileId: behavior.behaviorProfileId,
    spendingStyle: behavior.spendingStyle,
    investmentStyle: behavior.investmentStyle,
    supportSignal,
    source6ContextRequired: false,
  });
}

function buildWealthSolutionResult(
  contract: BaziCallerContract,
  packets: readonly BaziSharedPacket[],
  capacityResult: z.infer<typeof Source4WealthCapacityResultSchema>,
) {
  findPacket(packets, "strength");
  const dayMasterElement = getElementFromStem(contract.sharedPacketSpine.chartIdentity.dayMaster);
  const guidanceMode = capacityResult.strengthBandId === "very-weak" || capacityResult.strengthBandId === "weak"
    ? "reinforce-capacity"
    : capacityResult.strengthBandId === "balanced"
      ? "maintain-balance"
      : "enhance-efficiency";
  const recommendedElements = (
    guidanceMode === "reinforce-capacity"
      ? WEALTH_SOLUTION_POLICY[dayMasterElement].weak
      : WEALTH_SOLUTION_POLICY[dayMasterElement].strong
  ).map((element) => ({
    element,
    elementLabel: ELEMENT_LABELS_TH[element],
    businessThemes: ELEMENT_BUSINESS_THEMES[element],
  }));

  return Source4WealthSolutionResultSchema.parse({
    kind: "wealth-solution-lane",
    guidanceMode,
    recommendedElements,
    guardrail: "no-source7-remedy",
  });
}

function resolveWindowNeed(
  dayMasterElement: Source4Element,
  strengthBandId: z.infer<typeof Source4StrengthBandIdSchema>,
) {
  if (strengthBandId === "very-weak" || strengthBandId === "weak") {
    return Source4WindowNeedSchema.parse({
      family: "reinforce-capacity",
      preferredElements: unique([
        getTargetElementForRole(dayMasterElement, "resource"),
        dayMasterElement,
      ]),
      note: "Weak charts should wait for support or same-element reinforcement before pushing money action.",
    });
  }

  if (strengthBandId === "balanced") {
    return Source4WindowNeedSchema.parse({
      family: "maintain-circulation",
      preferredElements: unique([
        getTargetElementForRole(dayMasterElement, "output"),
        getTargetElementForRole(dayMasterElement, "wealth"),
      ]),
      note: "Balanced charts can monetize through output and wealth lanes, but still need storage discipline.",
    });
  }

  return Source4WindowNeedSchema.parse({
    family: "release-into-wealth",
    preferredElements: unique([
      getTargetElementForRole(dayMasterElement, "output"),
      getTargetElementForRole(dayMasterElement, "wealth"),
    ]),
    note: "Strong charts should wait for output or wealth windows that can release energy into money safely.",
  });
}

function evaluateTimingWindow(
  stem: string,
  branch: string,
  preferredElements: readonly Source4Element[],
  wealthRepresentativeStem: string,
) {
  const elementSignals = unique([getElementFromStem(stem), getElementFromBranch(branch)]);
  const wealthStage = buildStageInfo(wealthRepresentativeStem, branch);
  const matchesNeed = elementSignals.some((element) => preferredElements.includes(element));
  const windowScore = matchesNeed && FAVORABLE_TIMING_STAGES.has(wealthStage.stageNameChinese)
    ? 1
    : matchesNeed && wealthStage.signal === "mixed"
      ? 0.5
      : matchesNeed
        ? 0.25
        : wealthStage.signal === "supportive"
          ? 0
          : wealthStage.signal === "mixed"
            ? -0.25
            : -1;

  return {
    score: windowScore,
    window: Source4WindowEvaluationSchema.parse({
      pillarCode: buildPillarCode(stem, branch),
      elementSignals,
      matchesNeed,
      wealthStage,
    }),
  };
}

function classifyTimingWindow(weightedScore: number) {
  if (weightedScore >= 0.5) {
    return "favorable-window";
  }

  if (weightedScore <= -0.25) {
    return "capital-preservation-window";
  }

  return "selective-window";
}

function buildWealthTimingRiskWindowResult(
  contract: BaziCallerContract,
  packets: readonly BaziSharedPacket[],
  capacityResult: z.infer<typeof Source4WealthCapacityResultSchema>,
  wealthLookup: Source4WealthLookupResult,
  storageAndLeakage: Source4MoneySourceAndLeakageResult,
) {
  const timingPacket = findPacket(packets, "timing");
  const currentDaYun = timingPacket.sections.currentWindow.value.currentDaYun;
  const liuNian = timingPacket.sections.currentWindow.value.liuNian;

  if (!currentDaYun || !liuNian) {
    throw new Error("Source 4 timing window requires both current Da Yun and Liu Nian.");
  }

  const dayMasterElement = getElementFromStem(contract.sharedPacketSpine.chartIdentity.dayMaster);
  const windowNeed = resolveWindowNeed(dayMasterElement, capacityResult.strengthBandId);
  const wealthRepresentativeStem = getRepresentativeStemForElement(wealthLookup.wealthLane.element);
  const daYunEvaluation = evaluateTimingWindow(
    currentDaYun.stem,
    currentDaYun.branch,
    windowNeed.preferredElements,
    wealthRepresentativeStem,
  );
  const liuNianEvaluation = evaluateTimingWindow(
    liuNian.stem,
    liuNian.branch,
    windowNeed.preferredElements,
    wealthRepresentativeStem,
  );
  const weightedScore = (daYunEvaluation.score * SOURCE4_TIMING_WEIGHTING.daYun)
    + (liuNianEvaluation.score * SOURCE4_TIMING_WEIGHTING.liuNian);
  const timingWindow = classifyTimingWindow(weightedScore);
  const leakageAdjustmentApplied = storageAndLeakage.leakageSeverity === "high"
    || storageAndLeakage.leakageSeverity === "elevated"
    || storageAndLeakage.storageStatus === "vault-not-manifest";
  const riskBoundary = storageAndLeakage.leakageSeverity === "high"
    ? "capital-preservation"
    : timingWindow === "capital-preservation-window"
      ? "capital-preservation"
      : leakageAdjustmentApplied || timingWindow === "selective-window"
        ? "selective-risk"
        : "bounded-opportunity";

  return Source4WealthTimingRiskWindowResultSchema.parse({
    kind: "wealth-timing-and-risk-window",
    windowNeed,
    weighting: SOURCE4_TIMING_WEIGHTING,
    daYunWindow: daYunEvaluation.window,
    liuNianWindow: liuNianEvaluation.window,
    weightedScore,
    timingWindow,
    riskBoundary,
    leakageAdjustmentApplied,
    forbiddenClaims: [
      "no-windfall-promise",
      "no-guaranteed-rich-year",
      "no-partner-money-shortcut",
    ],
  });
}

export function buildSource4WealthInvestmentStepResult(
  stepId: string,
  packets: readonly BaziSharedPacket[],
  contract: BaziCallerContract,
): Source4WealthInvestmentStepComputation {
  const capacityResult = buildWealthCapacityResult(contract, packets);

  if (stepId === "step-1-wealth-capacity-routing") {
    return {
      packetFamilies: ["strength", "role-of-element"],
      result: capacityResult,
    };
  }

  const wealthLookup = buildWealthLookupResult(contract, packets);

  if (stepId === "step-2-wealth-element-storage-destroyer-lookup") {
    return {
      packetFamilies: ["role-of-element"],
      result: wealthLookup,
    };
  }

  const storageAndLeakage = buildMoneySourceAndLeakageResult(contract, packets, wealthLookup);

  if (stepId === "step-3-money-source-storage-and-leakage") {
    return {
      packetFamilies: ["role-of-element", "timing"],
      result: storageAndLeakage,
    };
  }

  if (stepId === "step-4-spending-and-investment-behavior") {
    return {
      packetFamilies: ["role-of-element", "timing"],
      result: buildSpendingInvestmentBehaviorResult(contract, packets),
    };
  }

  if (stepId === "step-5-wealth-solution-lane") {
    return {
      packetFamilies: ["strength", "role-of-element"],
      result: buildWealthSolutionResult(contract, packets, capacityResult),
    };
  }

  return {
    packetFamilies: ["strength", "role-of-element", "timing"],
    result: buildWealthTimingRiskWindowResult(contract, packets, capacityResult, wealthLookup, storageAndLeakage),
  };
}
