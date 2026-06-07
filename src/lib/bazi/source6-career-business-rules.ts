import { z } from "zod";

import {
  localizeTwelveQiLabel,
  resolveCanonicalTwelveQiStage,
  resolveTenGodForStem,
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

const SOURCE6_STRENGTH_BAND_IDS = ["very-weak", "weak", "balanced", "strong", "very-strong"] as const;
const SOURCE6_ROLE_IDS = ["resource", "parallel", "output", "wealth", "power"] as const;
const SOURCE6_STAGE_SIGNAL_IDS = ["supportive", "mixed", "resistant"] as const;
const SOURCE6_CAREER_STATUS_IDS = [
  "authority-rising",
  "authority-established",
  "authority-transitional",
  "authority-pressured",
  "official-star-not-manifest",
] as const;
const SOURCE6_GROWTH_GROUP_IDS = ["good", "neutral", "bad"] as const;
const SOURCE6_LOCATION_LANES = ["domestic", "international", "balanced"] as const;
const SOURCE6_BUSINESS_NATURE_IDS = ["wealth-aligned", "service-led", "cashflow-fragile"] as const;
const SOURCE6_INVESTMENT_HINT_IDS = ["favorable", "selective", "cautious"] as const;
const SOURCE6_CUSTOMER_PROFILE_IDS = ["established-network", "adaptive-market", "volatile-demand"] as const;
const SOURCE6_TWELVE_QI_ORDER = ["长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养"] as const;
const SOURCE6_WEIGHTING = {
  daYun: 0.6,
  liuNian: 0.4,
} as const;

const Source6StrengthBandIdSchema = z.enum(SOURCE6_STRENGTH_BAND_IDS);
const Source6RoleSchema = z.enum(SOURCE6_ROLE_IDS);
const Source6StageSignalSchema = z.enum(SOURCE6_STAGE_SIGNAL_IDS);
const Source6CareerStatusSchema = z.enum(SOURCE6_CAREER_STATUS_IDS);
const Source6GrowthGroupSchema = z.enum(SOURCE6_GROWTH_GROUP_IDS);
const Source6LocationLaneSchema = z.enum(SOURCE6_LOCATION_LANES);
const Source6BusinessNatureSchema = z.enum(SOURCE6_BUSINESS_NATURE_IDS);
const Source6InvestmentHintSchema = z.enum(SOURCE6_INVESTMENT_HINT_IDS);
const Source6CustomerProfileSchema = z.enum(SOURCE6_CUSTOMER_PROFILE_IDS);
const Source6ElementSchema = z.enum(["wood", "fire", "earth", "metal", "water"]);

const Source6StageInfoSchema = z.object({
  source: z.literal("pillar-display.resolveCanonicalTwelveQiStage"),
  stem: z.string().trim().min(1),
  branch: z.string().trim().min(1),
  branchLabel: z.string().trim().min(1),
  stageOrder: z.number().int().min(1).max(SOURCE6_TWELVE_QI_ORDER.length),
  stageNameChinese: z.enum(SOURCE6_TWELVE_QI_ORDER),
  stageNameThai: z.string().trim().min(1),
  signal: Source6StageSignalSchema,
});

const Source6RoleElementPairSchema = z.object({
  role: Source6RoleSchema,
  element: Source6ElementSchema,
  elementLabel: z.string().trim().min(1),
});

const Source6PillarMatchSchema = z.object({
  pillarKey: z.enum(["year", "month", "day", "hour"]),
  pillarCode: z.string().trim().min(2),
  symbol: z.string().trim().min(1),
});

const Source6HiddenStemMatchSchema = z.object({
  pillarKey: z.enum(["year", "month", "day", "hour"]),
  pillarCode: z.string().trim().min(2),
  branch: z.string().trim().min(1),
  hiddenStem: z.string().trim().min(1),
});

const Source6CareerElementRoutingResultSchema = z.object({
  kind: z.literal("career-element-routing"),
  strengthBandId: Source6StrengthBandIdSchema,
  strengthState: z.string().trim().min(1),
  semanticId: z.string().trim().min(1),
  primaryLane: Source6RoleElementPairSchema,
  supportingLanes: z.array(Source6RoleElementPairSchema).min(1),
});

const Source6OfficialStarLookupResultSchema = z.object({
  kind: z.literal("official-star-lookup"),
  officialElement: Source6ElementSchema,
  officialElementLabel: z.string().trim().min(1),
  officialStems: z.array(z.string().trim().min(1)).length(2),
  officialTenGods: z.array(z.enum(["正官", "七杀"])).length(2),
  directMatches: z.object({
    stems: z.array(Source6PillarMatchSchema),
    branches: z.array(Source6PillarMatchSchema),
  }),
  hiddenStemMatches: z.array(Source6HiddenStemMatchSchema),
  presenceMode: z.enum(["direct-present", "hidden-only", "absent"]),
});

const Source6CareerStatusResultSchema = z.object({
  kind: z.literal("career-status-by-official-star-phase"),
  selectedLane: z.enum([
    "direct-official-branch",
    "hidden-official-branch",
    "reference-stem-fallback",
    "official-star-absent",
  ]),
  stages: z.array(Source6StageInfoSchema),
  statusKey: Source6CareerStatusSchema,
});

const Source6WeightedPerspectiveSchema = z.object({
  anchor: z.enum(["day-master", "month-base"]),
  daYunStage: Source6StageInfoSchema,
  liuNianStage: Source6StageInfoSchema,
  weightedScore: z.number(),
  signal: Source6StageSignalSchema,
});

const Source6JobTransitionTimingResultSchema = z.object({
  kind: z.literal("job-transition-weighting"),
  weighting: z.object({
    daYun: z.literal(SOURCE6_WEIGHTING.daYun),
    liuNian: z.literal(SOURCE6_WEIGHTING.liuNian),
  }),
  dayMasterPerspective: Source6WeightedPerspectiveSchema,
  monthBasePerspective: Source6WeightedPerspectiveSchema,
  combinedSignal: Source6StageSignalSchema,
  nextDaYunSignals: z.array(z.object({
    pillarCode: z.string().trim().min(2),
    signal: Source6StageSignalSchema,
  })).max(3),
});

const Source6CareerGrowthGroupResultSchema = z.object({
  kind: z.literal("career-growth-group"),
  growthGroup: Source6GrowthGroupSchema,
  combinedSignal: Source6StageSignalSchema,
  dayMasterSignal: Source6StageSignalSchema,
  monthBaseSignal: Source6StageSignalSchema,
});

const Source6WorkLocationPreferenceResultSchema = z.object({
  kind: z.literal("work-location-preference"),
  outputLane: Source6RoleElementPairSchema,
  domesticSignal: Source6StageSignalSchema,
  internationalSignal: Source6StageSignalSchema,
  preferredLane: Source6LocationLaneSchema,
  domesticStage: Source6StageInfoSchema,
  internationalStage: Source6StageInfoSchema,
  inversionApplied: z.object({
    domestic: z.boolean(),
    international: z.boolean(),
  }),
});

const Source6BusinessNatureAndInvestmentResultSchema = z.object({
  kind: z.literal("business-nature-and-investment"),
  wealthLane: Source6RoleElementPairSchema,
  outputLane: Source6RoleElementPairSchema,
  monthBaseWealthStage: Source6StageInfoSchema,
  monthBaseOutputStage: Source6StageInfoSchema,
  businessNature: Source6BusinessNatureSchema,
  investmentHint: Source6InvestmentHintSchema,
});

const Source6CustomerProfileResultSchema = z.object({
  kind: z.literal("customer-profile"),
  yearPillarStage: Source6StageInfoSchema,
  conflictAdjustedSignal: Source6StageSignalSchema,
  profileKey: Source6CustomerProfileSchema,
});

export const Source6CareerBusinessStepResultSchema = z.discriminatedUnion("kind", [
  Source6CareerElementRoutingResultSchema,
  Source6OfficialStarLookupResultSchema,
  Source6CareerStatusResultSchema,
  Source6JobTransitionTimingResultSchema,
  Source6CareerGrowthGroupResultSchema,
  Source6WorkLocationPreferenceResultSchema,
  Source6BusinessNatureAndInvestmentResultSchema,
  Source6CustomerProfileResultSchema,
]);

export type Source6CareerBusinessStepResult = z.infer<typeof Source6CareerBusinessStepResultSchema>;
export type Source6OfficialStarLookupResult = z.infer<typeof Source6OfficialStarLookupResultSchema>;

export type Source6CareerBusinessStepComputation = {
  packetFamilies: Array<z.infer<typeof BaziSharedPacketFamilySchema>>;
  result: Source6CareerBusinessStepResult;
};

type Source6Element = z.infer<typeof Source6ElementSchema>;
type Source6Role = z.infer<typeof Source6RoleSchema>;
type Source6StageSignal = z.infer<typeof Source6StageSignalSchema>;
type Source6StageInfo = z.infer<typeof Source6StageInfoSchema>;

const FAVORABLE_STAGES = new Set(["长生", "冠带", "临官", "帝旺", "养"]);
const NEUTRAL_STAGES = new Set(["沐浴", "胎"]);

const CAREER_LANE_POLICY: Record<z.infer<typeof Source6StrengthBandIdSchema>, {
  primaryRole: Source6Role;
  supportingRoles: Source6Role[];
}> = {
  "very-weak": {
    primaryRole: "resource",
    supportingRoles: ["parallel"],
  },
  weak: {
    primaryRole: "parallel",
    supportingRoles: ["resource"],
  },
  balanced: {
    primaryRole: "output",
    supportingRoles: ["wealth"],
  },
  strong: {
    primaryRole: "wealth",
    supportingRoles: ["output"],
  },
  "very-strong": {
    primaryRole: "wealth",
    supportingRoles: ["power"],
  },
};

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
    throw new Error(`Source 6 rules are missing required packet family: ${family}`);
  }

  return packet;
}

function getElementFromStem(stem: string): Source6Element {
  const element = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];

  if (!element) {
    throw new Error(`Unsupported Source 6 stem element lookup: ${stem}`);
  }

  return element;
}

function getElementFromBranch(branch: string): Source6Element {
  const element = BRANCH_TO_ELEMENT[branch as keyof typeof BRANCH_TO_ELEMENT];

  if (!element) {
    throw new Error(`Unsupported Source 6 branch element lookup: ${branch}`);
  }

  return element;
}

function invertMapLookup(
  map: Record<Source6Element, Source6Element>,
  target: Source6Element,
): Source6Element {
  const entry = Object.entries(map).find(([, value]) => value === target);

  if (!entry) {
    throw new Error(`Unsupported Source 6 inverse map lookup: ${target}`);
  }

  return entry[0] as Source6Element;
}

function getTargetElementForRole(dayMasterElement: Source6Element, role: Source6Role) {
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

function getRepresentativeStemForElement(element: Source6Element) {
  const stem = Object.entries(STEM_TO_ELEMENT).find(([, value]) => value === element)?.[0];

  if (!stem) {
    throw new Error(`Unsupported Source 6 representative stem lookup: ${element}`);
  }

  return stem;
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

function buildStageInfo(stem: string, branch: string): Source6StageInfo {
  const stageNameChinese = resolveCanonicalTwelveQiStage(stem, branch);

  if (!stageNameChinese) {
    throw new Error(`Missing canonical Source 6 stage for ${stem}/${branch}`);
  }

  const stageOrder = SOURCE6_TWELVE_QI_ORDER.indexOf(
    stageNameChinese as (typeof SOURCE6_TWELVE_QI_ORDER)[number],
  ) + 1;

  if (stageOrder <= 0) {
    throw new Error(`Unsupported Source 6 stage for ${stem}/${branch}: ${stageNameChinese}`);
  }

  const signal = FAVORABLE_STAGES.has(stageNameChinese)
    ? "supportive"
    : NEUTRAL_STAGES.has(stageNameChinese)
      ? "mixed"
      : "resistant";

  return Source6StageInfoSchema.parse({
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

function scoreSignal(signal: Source6StageSignal) {
  if (signal === "supportive") {
    return 1;
  }

  if (signal === "resistant") {
    return -1;
  }

  return 0;
}

function classifySignal(score: number): Source6StageSignal {
  if (score >= 0.25) {
    return "supportive";
  }

  if (score <= -0.25) {
    return "resistant";
  }

  return "mixed";
}

function invertSignal(signal: Source6StageSignal): Source6StageSignal {
  if (signal === "supportive") {
    return "resistant";
  }

  if (signal === "resistant") {
    return "supportive";
  }

  return signal;
}

function buildRoleElementPair(dayMasterElement: Source6Element, role: Source6Role) {
  const element = getTargetElementForRole(dayMasterElement, role);

  return Source6RoleElementPairSchema.parse({
    role,
    element,
    elementLabel: ELEMENT_LABELS_TH[element],
  });
}

function buildOfficialStarLookup(contract: BaziCallerContract): Source6OfficialStarLookupResult {
  const dayMaster = contract.sharedPacketSpine.chartIdentity.dayMaster;
  const officialStems = Object.keys(STEM_TO_ELEMENT).filter((stem) => {
    const tenGod = resolveTenGodForStem(dayMaster, stem);

    return tenGod === "正官" || tenGod === "七杀";
  });
  const officialElement = getElementFromStem(officialStems[0] ?? "");
  const pillars = getChartPillars(contract);
  const directStemMatches = pillars.flatMap(({ pillarKey, pillar }) => (
    officialStems.includes(pillar.stem)
      ? [{ pillarKey, pillarCode: buildPillarCode(pillar.stem, pillar.branch), symbol: pillar.stem }]
      : []
  ));
  const directBranchMatches = pillars.flatMap(({ pillarKey, pillar }) => (
    getElementFromBranch(pillar.branch) === officialElement
      ? [{ pillarKey, pillarCode: buildPillarCode(pillar.stem, pillar.branch), symbol: pillar.branch }]
      : []
  ));
  const hiddenStemMatches = pillars.flatMap(({ pillarKey, pillar }) => {
    const hiddenStems = BRANCH_HIDDEN_STEMS[pillar.branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? [];

    return hiddenStems.flatMap((hiddenStem) => (
      officialStems.includes(hiddenStem)
        ? [{
          pillarKey,
          pillarCode: buildPillarCode(pillar.stem, pillar.branch),
          branch: pillar.branch,
          hiddenStem,
        }]
        : []
    ));
  });
  const presenceMode = directStemMatches.length > 0 || directBranchMatches.length > 0
    ? "direct-present"
    : hiddenStemMatches.length > 0
      ? "hidden-only"
      : "absent";

  return Source6OfficialStarLookupResultSchema.parse({
    kind: "official-star-lookup",
    officialElement,
    officialElementLabel: ELEMENT_LABELS_TH[officialElement],
    officialStems,
    officialTenGods: officialStems.map((stem) => resolveTenGodForStem(dayMaster, stem)),
    directMatches: {
      stems: directStemMatches,
      branches: directBranchMatches,
    },
    hiddenStemMatches,
    presenceMode,
  });
}

function buildWeightedPerspective(
  anchor: "day-master" | "month-base",
  stem: string,
  daYunBranch: string,
  liuNianBranch: string,
) {
  const daYunStage = buildStageInfo(stem, daYunBranch);
  const liuNianStage = buildStageInfo(stem, liuNianBranch);
  const weightedScore = (scoreSignal(daYunStage.signal) * SOURCE6_WEIGHTING.daYun)
    + (scoreSignal(liuNianStage.signal) * SOURCE6_WEIGHTING.liuNian);

  return Source6WeightedPerspectiveSchema.parse({
    anchor,
    daYunStage,
    liuNianStage,
    weightedScore,
    signal: classifySignal(weightedScore),
  });
}

function touchesBranch(values: readonly string[], branch: string) {
  return values.some((value) => value.includes(branch));
}

function hasConflictPressureOnBranch(packets: readonly BaziSharedPacket[], branch: string) {
  const conflictPacket = findPacket(packets, "conflict-context");
  const resolution = conflictPacket.sections.resolution.value;

  return touchesBranch(resolution.activeClashes, branch)
    || touchesBranch(resolution.activePunishments, branch)
    || touchesBranch(resolution.activeHarms, branch)
    || touchesBranch(resolution.activeDestructions, branch)
    || touchesBranch(resolution.intraPillarDestructions, branch);
}

function buildTransitionTimingResult(
  contract: BaziCallerContract,
  packets: readonly BaziSharedPacket[],
) {
  const timingPacket = findPacket(packets, "timing");
  const currentDaYun = timingPacket.sections.currentWindow.value.currentDaYun;
  const liuNian = timingPacket.sections.currentWindow.value.liuNian;

  if (!currentDaYun || !liuNian) {
    throw new Error("Source 6 job-transition weighting requires both current Da Yun and Liu Nian.");
  }

  const dayMaster = contract.sharedPacketSpine.chartIdentity.dayMaster;
  const monthStem = contract.sharedPacketSpine.chartIdentity.fourPillars.month.stem;
  const dayMasterPerspective = buildWeightedPerspective(
    "day-master",
    dayMaster,
    currentDaYun.branch,
    liuNian.branch,
  );
  const monthBasePerspective = buildWeightedPerspective(
    "month-base",
    monthStem,
    currentDaYun.branch,
    liuNian.branch,
  );
  const combinedSignal = classifySignal(
    (dayMasterPerspective.weightedScore + monthBasePerspective.weightedScore) / 2,
  );
  const nextDaYunSignals = timingPacket.sections.nextWindows.value.map((window) => ({
    pillarCode: `${window.stem}${window.branch}`,
    signal: buildStageInfo(dayMaster, window.branch).signal,
  }));

  return Source6JobTransitionTimingResultSchema.parse({
    kind: "job-transition-weighting",
    weighting: SOURCE6_WEIGHTING,
    dayMasterPerspective,
    monthBasePerspective,
    combinedSignal,
    nextDaYunSignals,
  });
}

export function buildSource6CareerBusinessStepResult(
  stepId: string,
  packets: readonly BaziSharedPacket[],
  contract: BaziCallerContract,
): Source6CareerBusinessStepComputation {
  const dayMaster = contract.sharedPacketSpine.chartIdentity.dayMaster;
  const dayMasterElement = getElementFromStem(dayMaster);

  if (stepId === "step-1-career-element-routing") {
    const strengthPacket = findPacket(packets, "strength");
    const profile = strengthPacket.sections.profile.value;
    const policy = CAREER_LANE_POLICY[profile.bandId as z.infer<typeof Source6StrengthBandIdSchema>];

    return {
      packetFamilies: ["strength", "role-of-element"],
      result: Source6CareerElementRoutingResultSchema.parse({
        kind: "career-element-routing",
        strengthBandId: profile.bandId,
        strengthState: profile.lookupState,
        semanticId: profile.semanticId,
        primaryLane: buildRoleElementPair(dayMasterElement, policy.primaryRole),
        supportingLanes: policy.supportingRoles.map((role) => buildRoleElementPair(dayMasterElement, role)),
      }),
    };
  }

  const officialStarLookup = buildOfficialStarLookup(contract);

  if (stepId === "step-2-official-star-lookup") {
    findPacket(packets, "role-of-element");

    return {
      packetFamilies: ["role-of-element"],
      result: officialStarLookup,
    };
  }

  if (stepId === "step-3-career-status-by-official-star-phase") {
    const selectedBranches = officialStarLookup.directMatches.branches.length > 0
      ? unique(officialStarLookup.directMatches.branches.map((match) => match.symbol))
      : officialStarLookup.hiddenStemMatches.length > 0
        ? unique(officialStarLookup.hiddenStemMatches.map((match) => match.branch))
        : unique(officialStarLookup.officialStems.map((stem) => getRepresentativeStemForElement(getElementFromStem(stem))));
    const useReferenceStemFallback = officialStarLookup.directMatches.branches.length === 0
      && officialStarLookup.hiddenStemMatches.length === 0
      && officialStarLookup.presenceMode !== "absent";
    const stages = officialStarLookup.presenceMode === "absent"
      ? []
      : selectedBranches.map((branchOrStem) => buildStageInfo(
        dayMaster,
        useReferenceStemFallback
          ? resolveCanonicalTwelveQiStage(branchOrStem, contract.sharedPacketSpine.chartIdentity.fourPillars.month.branch)
            ? contract.sharedPacketSpine.chartIdentity.fourPillars.month.branch
            : contract.sharedPacketSpine.chartIdentity.fourPillars.day.branch
          : branchOrStem,
      ));
    const statusKey = stages.some((stage) => stage.stageNameChinese === "临官" || stage.stageNameChinese === "帝旺")
      ? "authority-established"
      : stages.some((stage) => stage.signal === "supportive")
        ? "authority-rising"
        : stages.some((stage) => stage.signal === "mixed")
          ? "authority-transitional"
          : stages.length === 0
            ? "official-star-not-manifest"
            : "authority-pressured";

    return {
      packetFamilies: [],
      result: Source6CareerStatusResultSchema.parse({
        kind: "career-status-by-official-star-phase",
        selectedLane: officialStarLookup.directMatches.branches.length > 0
          ? "direct-official-branch"
          : officialStarLookup.hiddenStemMatches.length > 0
            ? "hidden-official-branch"
            : officialStarLookup.presenceMode === "absent"
              ? "official-star-absent"
              : "reference-stem-fallback",
        stages,
        statusKey,
      }),
    };
  }

  const transitionTiming = buildTransitionTimingResult(contract, packets);

  if (stepId === "step-4-job-transition-weighted-timing") {
    return {
      packetFamilies: ["timing"],
      result: transitionTiming,
    };
  }

  if (stepId === "step-5-career-growth-grouping") {
    const growthGroup = transitionTiming.combinedSignal === "supportive"
      && (transitionTiming.dayMasterPerspective.signal === "supportive"
        || transitionTiming.monthBasePerspective.signal === "supportive")
      ? "good"
      : transitionTiming.combinedSignal === "resistant"
        || (transitionTiming.dayMasterPerspective.signal === "resistant"
          && transitionTiming.monthBasePerspective.signal === "resistant")
        ? "bad"
        : "neutral";

    return {
      packetFamilies: ["timing"],
      result: Source6CareerGrowthGroupResultSchema.parse({
        kind: "career-growth-group",
        growthGroup,
        combinedSignal: transitionTiming.combinedSignal,
        dayMasterSignal: transitionTiming.dayMasterPerspective.signal,
        monthBaseSignal: transitionTiming.monthBasePerspective.signal,
      }),
    };
  }

  if (stepId === "step-6-work-location-domestic-vs-international") {
    const yearBranch = contract.sharedPacketSpine.chartIdentity.fourPillars.year.branch;
    const monthBranch = contract.sharedPacketSpine.chartIdentity.fourPillars.month.branch;
    const outputLane = buildRoleElementPair(dayMasterElement, "output");
    const outputStem = getRepresentativeStemForElement(outputLane.element);
    const domesticStage = buildStageInfo(outputStem, monthBranch);
    const internationalStage = buildStageInfo(outputStem, yearBranch);
    const domesticInversion = hasConflictPressureOnBranch(packets, monthBranch);
    const internationalInversion = hasConflictPressureOnBranch(packets, yearBranch);
    const domesticSignal = domesticInversion ? invertSignal(domesticStage.signal) : domesticStage.signal;
    const internationalSignal = internationalInversion ? invertSignal(internationalStage.signal) : internationalStage.signal;
    const preferredLane = scoreSignal(domesticSignal) === scoreSignal(internationalSignal)
      ? "balanced"
      : scoreSignal(domesticSignal) > scoreSignal(internationalSignal)
        ? "domestic"
        : "international";

    return {
      packetFamilies: ["role-of-element", "conflict-context"],
      result: Source6WorkLocationPreferenceResultSchema.parse({
        kind: "work-location-preference",
        outputLane,
        domesticSignal,
        internationalSignal,
        preferredLane,
        domesticStage,
        internationalStage,
        inversionApplied: {
          domestic: domesticInversion,
          international: internationalInversion,
        },
      }),
    };
  }

  if (stepId === "step-7-business-nature-and-investment") {
    const wealthLane = buildRoleElementPair(dayMasterElement, "wealth");
    const outputLane = buildRoleElementPair(dayMasterElement, "output");
    const monthBranch = contract.sharedPacketSpine.chartIdentity.fourPillars.month.branch;
    const monthBaseWealthStage = buildStageInfo(getRepresentativeStemForElement(wealthLane.element), monthBranch);
    const monthBaseOutputStage = buildStageInfo(getRepresentativeStemForElement(outputLane.element), monthBranch);
    const businessNature = monthBaseWealthStage.signal === "supportive"
      ? "wealth-aligned"
      : monthBaseWealthStage.signal === "mixed"
        ? "service-led"
        : "cashflow-fragile";
    const investmentHint = monthBaseOutputStage.signal === "supportive"
      ? "favorable"
      : monthBaseOutputStage.signal === "mixed"
        ? "selective"
        : "cautious";

    return {
      packetFamilies: ["strength", "role-of-element"],
      result: Source6BusinessNatureAndInvestmentResultSchema.parse({
        kind: "business-nature-and-investment",
        wealthLane,
        outputLane,
        monthBaseWealthStage,
        monthBaseOutputStage,
        businessNature,
        investmentHint,
      }),
    };
  }

  const yearPillar = contract.sharedPacketSpine.chartIdentity.fourPillars.year;
  const yearPillarStage = buildStageInfo(yearPillar.stem, yearPillar.branch);
  const conflictAdjustedSignal = hasConflictPressureOnBranch(packets, yearPillar.branch)
    ? invertSignal(yearPillarStage.signal)
    : yearPillarStage.signal;
  const profileKey = conflictAdjustedSignal === "supportive"
    ? "established-network"
    : conflictAdjustedSignal === "mixed"
      ? "adaptive-market"
      : "volatile-demand";

  return {
    packetFamilies: ["conflict-context"],
    result: Source6CustomerProfileResultSchema.parse({
      kind: "customer-profile",
      yearPillarStage,
      conflictAdjustedSignal,
      profileKey,
    }),
  };
}