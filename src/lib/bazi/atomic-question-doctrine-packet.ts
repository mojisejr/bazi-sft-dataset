import { z } from "zod";

import {
  BAZI_ATOMIC_QUESTION_MATRIX_BY_JOB_ID,
  BAZI_ATOMIC_QUESTION_MATRIX_VERSION,
  BaziAtomicCanonicalBucketSchema,
  type BaziAtomicCanonicalBucket,
  type BaziAtomicQuestionJobId,
} from "@/lib/bazi/atomic-question-matrix";
import {
  type AgeSnapshotValue,
  type CalculatedStateValue,
  type DaYunPhaseValue,
  type DaYunPillarValue,
  PillarValueSchema,
} from "@/lib/bazi/schema-types";

export const BaziDoctrinePacketSelectionModeSchema = z.enum([
  "atomic_job",
  "bucket_fallback",
]);

export const BaziDoctrinePacketSectionProvenanceSchema = z.enum([
  "computed_chart_marker",
  "compatibility_profile",
  "supporting_context",
  "timing_context",
]);

const DoctrinePacketPillarSchema = PillarValueSchema.pick({
  stem: true,
  branch: true,
  hiddenStems: true,
  tenGod: true,
  sittingStage: true,
  lookingStage: true,
  upperStageDisplay: true,
  lowerStageDisplay: true,
});

export const BaziDoctrinePacketQuestionContextSchema = z.object({
  canonicalBucket: BaziAtomicCanonicalBucketSchema,
  jobId: z.string().trim().min(1).optional(),
  selectionMode: BaziDoctrinePacketSelectionModeSchema,
  matrixVersion: z.string().trim().min(1).default(BAZI_ATOMIC_QUESTION_MATRIX_VERSION),
});

export const BaziDoctrinePacketSectionSchema = z.object({
  key: z.string().trim().min(1),
  provenance: BaziDoctrinePacketSectionProvenanceSchema,
  value: z.unknown(),
});

export const BaziDoctrinePacketSchema = z.object({
  questionContext: BaziDoctrinePacketQuestionContextSchema,
  chartIdentity: z.object({
    dayMaster: z.string().trim().min(1),
    fourPillars: z.object({
      year: DoctrinePacketPillarSchema,
      month: DoctrinePacketPillarSchema,
      day: DoctrinePacketPillarSchema,
      hour: DoctrinePacketPillarSchema,
    }),
  }),
  anchors: z.array(BaziDoctrinePacketSectionSchema).min(1),
  support: z.array(BaziDoctrinePacketSectionSchema).default([]),
  timing: z.array(BaziDoctrinePacketSectionSchema).default([]),
});

export type BaziDoctrinePacket = z.infer<typeof BaziDoctrinePacketSchema>;
export type BaziDoctrinePacketSelectionMode = z.infer<
  typeof BaziDoctrinePacketSelectionModeSchema
>;
export type BaziDoctrinePacketSectionProvenance = z.infer<
  typeof BaziDoctrinePacketSectionProvenanceSchema
>;
export type BaziDoctrinePacketSection = z.infer<
  typeof BaziDoctrinePacketSectionSchema
>;
export type BaziDoctrinePacketQuestionContext = {
  canonicalBucket: BaziAtomicCanonicalBucket;
  jobId?: BaziAtomicQuestionJobId;
  selectionMode: BaziDoctrinePacketSelectionMode;
  matrixVersion?: string;
};

type BaziDoctrinePacketAnchorKey =
  | "dayMasterStrengthProfile"
  | "sixtyJiaziCorePersona"
  | "spousePalace"
  | "elementAnalysis"
  | "seasonalInteraction"
  | "financeTenGodHighlights"
  | "relationshipTenGodHighlights"
  | "careerTenGodHighlights"
  | "loveCompatibilityProfile"
  | "workCompatibilityProfile";

type BaziDoctrinePacketSupportKey =
  | "roleBadges"
  | "stemInteractionBadges"
  | "branchInteractionBadges"
  | "markerBadges"
  | "readingOrderSteps";

type BaziDoctrinePacketTimingKey =
  | "ageSnapshot"
  | "currentDaYun"
  | "activeTimingWindow"
  | "nextTimingWindows"
  | "liuNian";

type BaziDoctrinePacketBuildPlan = {
  anchorKeys: BaziDoctrinePacketAnchorKey[];
  supportKeys: BaziDoctrinePacketSupportKey[];
  timingKeys: BaziDoctrinePacketTimingKey[];
};

type BaziDoctrinePacketSectionCatalog = {
  anchors: Partial<Record<BaziDoctrinePacketAnchorKey, BaziDoctrinePacketSection>>;
  support: Partial<Record<BaziDoctrinePacketSupportKey, BaziDoctrinePacketSection>>;
  timing: Partial<Record<BaziDoctrinePacketTimingKey, BaziDoctrinePacketSection>>;
};

const ALL_TIMING_KEYS: BaziDoctrinePacketTimingKey[] = [
  "ageSnapshot",
  "currentDaYun",
  "activeTimingWindow",
  "nextTimingWindows",
  "liuNian",
];

const FOUNDATION_INTERPRETATION_ANCHORS: BaziDoctrinePacketAnchorKey[] = [
  "dayMasterStrengthProfile",
  "elementAnalysis",
  "seasonalInteraction",
];

const FOUNDATION_INTERPRETATION_SUPPORT: BaziDoctrinePacketSupportKey[] = [
  "roleBadges",
  "stemInteractionBadges",
  "branchInteractionBadges",
  "markerBadges",
];

const BUCKET_FALLBACK_BUILD_PLANS: Record<
  BaziAtomicCanonicalBucket,
  BaziDoctrinePacketBuildPlan
> = {
  wealth: {
    anchorKeys: [
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "financeTenGodHighlights",
    ],
    supportKeys: [],
    timingKeys: ALL_TIMING_KEYS,
  },
  relationship: {
    anchorKeys: [
      "spousePalace",
      "relationshipTenGodHighlights",
      "loveCompatibilityProfile",
    ],
    supportKeys: [],
    timingKeys: ALL_TIMING_KEYS,
  },
  work: {
    anchorKeys: [
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "workCompatibilityProfile",
      "elementAnalysis",
    ],
    supportKeys: [],
    timingKeys: ALL_TIMING_KEYS,
  },
  health: {
    anchorKeys: [
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "seasonalInteraction",
    ],
    supportKeys: [],
    timingKeys: ALL_TIMING_KEYS,
  },
  foundation: {
    anchorKeys: [
      "dayMasterStrengthProfile",
      "sixtyJiaziCorePersona",
      "elementAnalysis",
      "seasonalInteraction",
    ],
    supportKeys: ["readingOrderSteps"],
    timingKeys: ALL_TIMING_KEYS,
  },
  study: {
    anchorKeys: ["dayMasterStrengthProfile", "elementAnalysis"],
    supportKeys: [],
    timingKeys: ALL_TIMING_KEYS,
  },
};

type BaziDoctrinePacketTimingWindowValue = {
  startAge: number;
  endAge: number;
  label: string;
  source: "stem" | "branch";
  symbol: string;
  twelveQiDisplay: string | null;
  isCurrent: boolean;
  daYun: {
    startAge: number;
    endAge: number;
    stem: string;
    branch: string;
    isCurrent: boolean;
    currentPhase: "upper" | "lower" | null;
  };
};

export type BaziDoctrinePacketComposerInput = {
  questionContext: BaziDoctrinePacketQuestionContext;
  payload: CalculatedStateValue;
  anchors?: BaziDoctrinePacketSection[];
  support?: BaziDoctrinePacketSection[];
  timing?: BaziDoctrinePacketSection[];
};

export type BaziBucketFallbackDoctrinePacketComposerInput = {
  canonicalBucket: BaziAtomicCanonicalBucket;
  payload: CalculatedStateValue;
};

function createEmptyBuildPlan(): BaziDoctrinePacketBuildPlan {
  return {
    anchorKeys: [],
    supportKeys: [],
    timingKeys: [],
  };
}

function cloneBuildPlan(
  plan: BaziDoctrinePacketBuildPlan,
): BaziDoctrinePacketBuildPlan {
  return {
    anchorKeys: [...plan.anchorKeys],
    supportKeys: [...plan.supportKeys],
    timingKeys: [...plan.timingKeys],
  };
}

function createEmptySectionCatalog(): BaziDoctrinePacketSectionCatalog {
  return {
    anchors: {},
    support: {},
    timing: {},
  };
}

function normalizeEvidenceHint(hint: string) {
  return hint.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pushUniqueKey<T extends string>(keys: T[], key: T) {
  if (!keys.includes(key)) {
    keys.push(key);
  }
}

function addAnchorKeys(
  plan: BaziDoctrinePacketBuildPlan,
  keys: BaziDoctrinePacketAnchorKey[],
) {
  keys.forEach((key) => pushUniqueKey(plan.anchorKeys, key));
}

function addSupportKeys(
  plan: BaziDoctrinePacketBuildPlan,
  keys: BaziDoctrinePacketSupportKey[],
) {
  keys.forEach((key) => pushUniqueKey(plan.supportKeys, key));
}

function addTimingKeys(
  plan: BaziDoctrinePacketBuildPlan,
  keys: BaziDoctrinePacketTimingKey[],
) {
  keys.forEach((key) => pushUniqueKey(plan.timingKeys, key));
}

function applyEvidenceHint(
  plan: BaziDoctrinePacketBuildPlan,
  hint: string,
) {
  const normalizedHint = normalizeEvidenceHint(hint);

  if (normalizedHint.includes("daymasterstrengthprofile")) {
    addAnchorKeys(plan, ["dayMasterStrengthProfile"]);
  }

  if (normalizedHint.includes("sixtyjiazicorepersona")) {
    addAnchorKeys(plan, ["sixtyJiaziCorePersona"]);
  }

  if (normalizedHint.includes("spousepalace")) {
    addAnchorKeys(plan, ["spousePalace"]);
  }

  if (normalizedHint.includes("elementanalysis")) {
    addAnchorKeys(plan, ["elementAnalysis"]);
  }

  if (normalizedHint.includes("seasonalinteraction")) {
    addAnchorKeys(plan, ["seasonalInteraction"]);
  }

  if (normalizedHint.includes("financetengodhighlights")) {
    addAnchorKeys(plan, ["financeTenGodHighlights"]);
  }

  if (normalizedHint.includes("relationshiptengodhighlights")) {
    addAnchorKeys(plan, ["relationshipTenGodHighlights"]);
  }

  if (normalizedHint.includes("careertengodhighlights")) {
    addAnchorKeys(plan, ["careerTenGodHighlights"]);
  }

  if (normalizedHint.includes("lovecompatibilityprofile")) {
    addAnchorKeys(plan, ["loveCompatibilityProfile"]);
  }

  if (normalizedHint.includes("workcompatibilityprofile")) {
    addAnchorKeys(plan, ["workCompatibilityProfile"]);
  }

  if (normalizedHint.includes("readingordersteps")) {
    addSupportKeys(plan, ["readingOrderSteps"]);
  }

  if (normalizedHint.includes("rolebadges")) {
    addSupportKeys(plan, ["roleBadges"]);
  }

  if (normalizedHint.includes("steminteractionbadges")) {
    addSupportKeys(plan, ["stemInteractionBadges"]);
  }

  if (normalizedHint.includes("branchinteractionbadges")) {
    addSupportKeys(plan, ["branchInteractionBadges"]);
  }

  if (normalizedHint.includes("markerbadges")) {
    addSupportKeys(plan, ["markerBadges"]);
  }

  if (normalizedHint.includes("foundationanchorsforinterpretation")) {
    addAnchorKeys(plan, FOUNDATION_INTERPRETATION_ANCHORS);
    addSupportKeys(plan, FOUNDATION_INTERPRETATION_SUPPORT);
  }

  if (normalizedHint.includes("selfchartrelationshiptendencyasbackgroundonly")) {
    addAnchorKeys(plan, [
      "spousePalace",
      "relationshipTenGodHighlights",
      "dayMasterStrengthProfile",
    ]);
  }

  if (normalizedHint.includes("workanchorsonlyiftheinvestmentisoperational")) {
    addAnchorKeys(plan, [
      "careerTenGodHighlights",
      "workCompatibilityProfile",
      "elementAnalysis",
    ]);
  }

  if (normalizedHint.includes("agesnapshot")) {
    addTimingKeys(plan, ["ageSnapshot"]);
  }

  if (normalizedHint.includes("currentdayun")) {
    addTimingKeys(plan, ["currentDaYun"]);
  }

  if (normalizedHint.includes("activetimingwindow")) {
    addTimingKeys(plan, ["activeTimingWindow"]);
  }

  if (normalizedHint.includes("nexttimingwindows")) {
    addTimingKeys(plan, ["nextTimingWindows"]);
  }

  if (normalizedHint.includes("liunian")) {
    addTimingKeys(plan, ["liuNian"]);
  }

  if (normalizedHint.includes("timingsections")) {
    addTimingKeys(plan, [
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ]);
  }
}

function resolveAtomicJobBuildPlan(
  jobId: BaziAtomicQuestionJobId,
): BaziDoctrinePacketBuildPlan | null {
  const entry = BAZI_ATOMIC_QUESTION_MATRIX_BY_JOB_ID[jobId];

  if (!entry) {
    return null;
  }

  const plan = createEmptyBuildPlan();

  entry.readingOrder.forEach((hint) => applyEvidenceHint(plan, hint));
  entry.mandatoryEvidence.forEach((hint) => applyEvidenceHint(plan, hint));

  return plan;
}

function resolveDoctrinePacketBuildPlan(
  questionContext: BaziDoctrinePacketQuestionContext,
): BaziDoctrinePacketBuildPlan {
  if (questionContext.selectionMode === "atomic_job" && questionContext.jobId) {
    const atomicJobPlan = resolveAtomicJobBuildPlan(questionContext.jobId);

    if (atomicJobPlan) {
      return atomicJobPlan;
    }
  }

  return cloneBuildPlan(BUCKET_FALLBACK_BUILD_PLANS[questionContext.canonicalBucket]);
}

function toDoctrinePacketPillar(pillar: CalculatedStateValue["fourPillars"]["year"]) {
  return DoctrinePacketPillarSchema.parse({
    stem: pillar.stem,
    branch: pillar.branch,
    hiddenStems: pillar.hiddenStems ?? [],
    tenGod: pillar.tenGod,
  });
}

function buildChartIdentity(payload: CalculatedStateValue) {
  return {
    dayMaster: payload.dayMaster,
    fourPillars: {
      year: toDoctrinePacketPillar(payload.fourPillars.year),
      month: toDoctrinePacketPillar(payload.fourPillars.month),
      day: toDoctrinePacketPillar(payload.fourPillars.day),
      hour: toDoctrinePacketPillar(payload.fourPillars.hour),
    },
  };
}

export function createBaziDoctrinePacketSection(
  key: string,
  value: unknown,
  provenance: BaziDoctrinePacketSectionProvenance = "computed_chart_marker",
): BaziDoctrinePacketSection {
  return { key, provenance, value };
}

export function createBaziBucketFallbackDoctrinePacketQuestionContext(
  canonicalBucket: BaziAtomicCanonicalBucket,
): BaziDoctrinePacketQuestionContext {
  return {
    canonicalBucket,
    selectionMode: "bucket_fallback",
    matrixVersion: BAZI_ATOMIC_QUESTION_MATRIX_VERSION,
  };
}

function buildTenGodHighlightsSection(
  payload: CalculatedStateValue,
  key: string,
  matcher: RegExp,
): BaziDoctrinePacketSection | null {
  const entries = Object.entries(payload.tenGods).filter(([, value]) => matcher.test(value));

  if (entries.length === 0) {
    return null;
  }

  return createBaziDoctrinePacketSection(
    key,
    Object.fromEntries(entries),
  );
}

function findCompatibilityProfile(
  payload: CalculatedStateValue,
  domain: "love" | "work",
) {
  return payload.compatibilityMatrixProfiles.find((profile) => profile.domain === domain);
}

function mergeSectionCatalog(
  target: BaziDoctrinePacketSectionCatalog,
  source: BaziDoctrinePacketSectionCatalog,
) {
  Object.assign(target.anchors, source.anchors);
  Object.assign(target.support, source.support);
  Object.assign(target.timing, source.timing);
}

function buildChartCoreFamilyCatalog(
  payload: CalculatedStateValue,
): BaziDoctrinePacketSectionCatalog {
  const catalog = createEmptySectionCatalog();

  if (payload.dayMasterStrengthProfile) {
    catalog.anchors.dayMasterStrengthProfile = createBaziDoctrinePacketSection(
      "dayMasterStrengthProfile",
      payload.dayMasterStrengthProfile,
    );
  }

  if (payload.sixtyJiaziCorePersona) {
    catalog.anchors.sixtyJiaziCorePersona = createBaziDoctrinePacketSection(
      "sixtyJiaziCorePersona",
      payload.sixtyJiaziCorePersona,
    );
  }

  catalog.anchors.spousePalace = createBaziDoctrinePacketSection(
    "spousePalace",
    payload.fourPillars.day,
  );

  return catalog;
}

function buildRoleEvidenceFamilyCatalog(
  payload: CalculatedStateValue,
): BaziDoctrinePacketSectionCatalog {
  const catalog = createEmptySectionCatalog();
  const financeHighlights = buildTenGodHighlightsSection(
    payload,
    "financeTenGodHighlights",
    /财/u,
  );
  const relationshipHighlights = buildTenGodHighlightsSection(
    payload,
    "relationshipTenGodHighlights",
    /官|殺|杀|财/u,
  );
  const careerHighlights = buildTenGodHighlightsSection(
    payload,
    "careerTenGodHighlights",
    /官|殺|杀|印|食神|伤官/u,
  );

  if (financeHighlights) {
    catalog.anchors.financeTenGodHighlights = financeHighlights;
  }

  if (relationshipHighlights) {
    catalog.anchors.relationshipTenGodHighlights = relationshipHighlights;
  }

  if (careerHighlights) {
    catalog.anchors.careerTenGodHighlights = careerHighlights;
  }

  if (payload.baseChartReading?.roleBadges.length) {
    catalog.support.roleBadges = createBaziDoctrinePacketSection(
      "roleBadges",
      payload.baseChartReading.roleBadges,
    );
  }

  return catalog;
}

function buildInteractionEvidenceFamilyCatalog(
  payload: CalculatedStateValue,
): BaziDoctrinePacketSectionCatalog {
  const catalog = createEmptySectionCatalog();
  const loveCompatibilityProfile = findCompatibilityProfile(payload, "love");
  const workCompatibilityProfile = findCompatibilityProfile(payload, "work");

  catalog.anchors.elementAnalysis = createBaziDoctrinePacketSection(
    "elementAnalysis",
    payload.elementAnalysis,
  );

  if (payload.seasonalInteraction) {
    catalog.anchors.seasonalInteraction = createBaziDoctrinePacketSection(
      "seasonalInteraction",
      payload.seasonalInteraction,
    );
  }

  if (loveCompatibilityProfile) {
    catalog.anchors.loveCompatibilityProfile = createBaziDoctrinePacketSection(
      "loveCompatibilityProfile",
      loveCompatibilityProfile,
      "compatibility_profile",
    );
  }

  if (workCompatibilityProfile) {
    catalog.anchors.workCompatibilityProfile = createBaziDoctrinePacketSection(
      "workCompatibilityProfile",
      workCompatibilityProfile,
      "compatibility_profile",
    );
  }

  if (payload.baseChartReading?.stemInteractionBadges.length) {
    catalog.support.stemInteractionBadges = createBaziDoctrinePacketSection(
      "stemInteractionBadges",
      payload.baseChartReading.stemInteractionBadges,
    );
  }

  if (payload.baseChartReading?.branchInteractionBadges.length) {
    catalog.support.branchInteractionBadges = createBaziDoctrinePacketSection(
      "branchInteractionBadges",
      payload.baseChartReading.branchInteractionBadges,
    );
  }

  return catalog;
}

function buildMarkerEvidenceFamilyCatalog(
  payload: CalculatedStateValue,
): BaziDoctrinePacketSectionCatalog {
  const catalog = createEmptySectionCatalog();

  if (payload.baseChartReading?.markerBadges.length) {
    catalog.support.markerBadges = createBaziDoctrinePacketSection(
      "markerBadges",
      payload.baseChartReading.markerBadges,
    );
  }

  return catalog;
}

function buildReadingOrderFamilyCatalog(
  payload: CalculatedStateValue,
): BaziDoctrinePacketSectionCatalog {
  const catalog = createEmptySectionCatalog();

  if (payload.baseChartReading?.readingOrderSteps.length) {
    catalog.support.readingOrderSteps = createBaziDoctrinePacketSection(
      "readingOrderSteps",
      payload.baseChartReading.readingOrderSteps.slice(0, 4),
      "supporting_context",
    );
  }

  return catalog;
}

function formatAgeWindowLabel(startAge: number, endAge: number) {
  return `${startAge}-${endAge}`;
}

function buildDaYunPhaseValue(
  pillar: DaYunPillarValue,
  phaseKey: "upper" | "lower",
): DaYunPhaseValue {
  if (phaseKey === "upper") {
    return {
      startAge: pillar.upperPhase?.startAge ?? pillar.startAge,
      endAge: pillar.upperPhase?.endAge ?? Math.min(pillar.endAge, pillar.startAge + 4),
      symbol: pillar.upperPhase?.symbol ?? pillar.stem,
      source: pillar.upperPhase?.source ?? "stem",
      twelveQiDisplay: pillar.upperPhase?.twelveQiDisplay ?? pillar.upperStageDisplay,
      isCurrent: pillar.upperPhase?.isCurrent ?? pillar.currentPhase === "upper",
    };
  }

  return {
    startAge: pillar.lowerPhase?.startAge ?? Math.min(pillar.endAge, pillar.startAge + 5),
    endAge: pillar.lowerPhase?.endAge ?? pillar.endAge,
    symbol: pillar.lowerPhase?.symbol ?? pillar.branch,
    source: pillar.lowerPhase?.source ?? "branch",
    twelveQiDisplay: pillar.lowerPhase?.twelveQiDisplay ?? pillar.lowerStageDisplay,
    isCurrent: pillar.lowerPhase?.isCurrent ?? pillar.currentPhase === "lower",
  };
}

function toTimingWindowValue(
  pillar: DaYunPillarValue,
  phaseKey: "upper" | "lower",
): BaziDoctrinePacketTimingWindowValue {
  const phase = buildDaYunPhaseValue(pillar, phaseKey);

  return {
    startAge: phase.startAge,
    endAge: phase.endAge,
    label: formatAgeWindowLabel(phase.startAge, phase.endAge),
    source: phase.source,
    symbol: phase.symbol,
    twelveQiDisplay: phase.twelveQiDisplay ?? null,
    isCurrent: phase.isCurrent ?? false,
    daYun: {
      startAge: pillar.startAge,
      endAge: pillar.endAge,
      stem: pillar.stem,
      branch: pillar.branch,
      isCurrent: pillar.isCurrent ?? false,
      currentPhase: pillar.currentPhase ?? null,
    },
  };
}

function buildTimingWindows(payload: CalculatedStateValue): BaziDoctrinePacketTimingWindowValue[] {
  return payload.daYun.flatMap((pillar) => ([
    toTimingWindowValue(pillar, "upper"),
    toTimingWindowValue(pillar, "lower"),
  ].filter((window) => window.startAge <= window.endAge)));
}

function buildAgeSnapshotSection(ageSnapshot: AgeSnapshotValue): BaziDoctrinePacketSection {
  return createBaziDoctrinePacketSection("ageSnapshot", ageSnapshot, "timing_context");
}

function buildCurrentDaYunSection(currentDaYun: DaYunPillarValue): BaziDoctrinePacketSection {
  const upperPhase = toTimingWindowValue(currentDaYun, "upper");
  const lowerPhase = toTimingWindowValue(currentDaYun, "lower");

  return createBaziDoctrinePacketSection("currentDaYun", {
    startAge: currentDaYun.startAge,
    endAge: currentDaYun.endAge,
    stem: currentDaYun.stem,
    branch: currentDaYun.branch,
    currentPhase: currentDaYun.currentPhase,
    upperStageDisplay: currentDaYun.upperStageDisplay,
    lowerStageDisplay: currentDaYun.lowerStageDisplay,
    influenceGradient: currentDaYun.influenceGradient,
    upperPhase,
    lowerPhase,
  }, "timing_context");
}

function getCurrentDaYun(payload: CalculatedStateValue): DaYunPillarValue | null {
  return payload.daYun.find((pillar) => pillar.isCurrent) ?? payload.daYun.at(-1) ?? null;
}

function getActiveTimingWindow(
  payload: CalculatedStateValue,
  timingWindows: BaziDoctrinePacketTimingWindowValue[],
): BaziDoctrinePacketTimingWindowValue | null {
  const currentWindow = timingWindows.find((window) => window.isCurrent);

  if (currentWindow) {
    return currentWindow;
  }

  const currentDaYun = getCurrentDaYun(payload);

  if (!currentDaYun) {
    return null;
  }

  return toTimingWindowValue(
    currentDaYun,
    currentDaYun.currentPhase === "lower" ? "lower" : "upper",
  );
}

function buildNextTimingWindows(
  payload: CalculatedStateValue,
  timingWindows: BaziDoctrinePacketTimingWindowValue[],
  activeTimingWindow: BaziDoctrinePacketTimingWindowValue | null,
): BaziDoctrinePacketTimingWindowValue[] {
  if (timingWindows.length === 0) {
    return [];
  }

  if (activeTimingWindow) {
    const activeWindowIndex = timingWindows.findIndex((window) => (
      window.daYun.startAge === activeTimingWindow.daYun.startAge
      && window.startAge === activeTimingWindow.startAge
      && window.endAge === activeTimingWindow.endAge
    ));

    if (activeWindowIndex >= 0) {
      return timingWindows.slice(activeWindowIndex + 1, activeWindowIndex + 3);
    }
  }

  const currentDaYun = getCurrentDaYun(payload);

  if (!currentDaYun) {
    return timingWindows.slice(0, 2);
  }

  const firstCurrentWindowIndex = timingWindows.findIndex(
    (window) => window.daYun.startAge === currentDaYun.startAge,
  );

  return timingWindows.slice(
    firstCurrentWindowIndex >= 0 ? firstCurrentWindowIndex : 0,
    (firstCurrentWindowIndex >= 0 ? firstCurrentWindowIndex : 0) + 2,
  );
}

function buildTimingSections(payload: CalculatedStateValue): BaziDoctrinePacketSection[] {
  const sections: BaziDoctrinePacketSection[] = [];
  const currentDaYun = getCurrentDaYun(payload);
  const timingWindows = buildTimingWindows(payload);
  const activeTimingWindow = getActiveTimingWindow(payload, timingWindows);
  const nextTimingWindows = buildNextTimingWindows(payload, timingWindows, activeTimingWindow);

  if (payload.ageSnapshot) {
    sections.push(buildAgeSnapshotSection(payload.ageSnapshot));
  }

  if (currentDaYun) {
    sections.push(buildCurrentDaYunSection(currentDaYun));
  }

  if (activeTimingWindow) {
    sections.push(createBaziDoctrinePacketSection(
      "activeTimingWindow",
      activeTimingWindow,
      "timing_context",
    ));
  }

  if (nextTimingWindows.length > 0) {
    sections.push(createBaziDoctrinePacketSection(
      "nextTimingWindows",
      nextTimingWindows,
      "timing_context",
    ));
  }

  if (payload.liuNian) {
    sections.push(createBaziDoctrinePacketSection(
      "liuNian",
      toDoctrinePacketPillar(payload.liuNian),
      "timing_context",
    ));
  }

  return sections;
}

function buildTimingFamilyCatalog(
  payload: CalculatedStateValue,
): BaziDoctrinePacketSectionCatalog {
  const catalog = createEmptySectionCatalog();

  buildTimingSections(payload).forEach((section) => {
    switch (section.key) {
      case "ageSnapshot":
        catalog.timing.ageSnapshot = section;
        break;
      case "currentDaYun":
        catalog.timing.currentDaYun = section;
        break;
      case "activeTimingWindow":
        catalog.timing.activeTimingWindow = section;
        break;
      case "nextTimingWindows":
        catalog.timing.nextTimingWindows = section;
        break;
      case "liuNian":
        catalog.timing.liuNian = section;
        break;
    }
  });

  return catalog;
}

function buildDoctrinePacketSectionCatalog(
  payload: CalculatedStateValue,
): BaziDoctrinePacketSectionCatalog {
  const catalog = createEmptySectionCatalog();

  mergeSectionCatalog(catalog, buildChartCoreFamilyCatalog(payload));
  mergeSectionCatalog(catalog, buildRoleEvidenceFamilyCatalog(payload));
  mergeSectionCatalog(catalog, buildInteractionEvidenceFamilyCatalog(payload));
  mergeSectionCatalog(catalog, buildMarkerEvidenceFamilyCatalog(payload));
  mergeSectionCatalog(catalog, buildReadingOrderFamilyCatalog(payload));
  mergeSectionCatalog(catalog, buildTimingFamilyCatalog(payload));

  return catalog;
}

function materializeDoctrinePacketSections(
  plan: BaziDoctrinePacketBuildPlan,
  catalog: BaziDoctrinePacketSectionCatalog,
) {
  return {
    anchors: plan.anchorKeys.flatMap((key) => {
      const section = catalog.anchors[key];
      return section ? [section] : [];
    }),
    support: plan.supportKeys.flatMap((key) => {
      const section = catalog.support[key];
      return section ? [section] : [];
    }),
    timing: plan.timingKeys.flatMap((key) => {
      const section = catalog.timing[key];
      return section ? [section] : [];
    }),
  };
}

/**
 * Canonical doctrine packet seam below shell adapters.
 * Public atomic job identity comes from src/lib/bazi/atomic-question-matrix.ts;
 * until the resolver emits a concrete jobId, adapters should enter through the
 * canonical bucket with selectionMode="bucket_fallback".
 */
export function composeBaziDoctrinePacket(
  input: BaziDoctrinePacketComposerInput,
): BaziDoctrinePacket {
  const plan = resolveDoctrinePacketBuildPlan(input.questionContext);
  const catalog = buildDoctrinePacketSectionCatalog(input.payload);
  const plannedSections = materializeDoctrinePacketSections(plan, catalog);

  return BaziDoctrinePacketSchema.parse({
    questionContext: input.questionContext,
    chartIdentity: buildChartIdentity(input.payload),
    anchors: input.anchors ?? plannedSections.anchors,
    support: input.support ?? plannedSections.support,
    timing: input.timing ?? plannedSections.timing,
  });
}

export function composeBaziBucketFallbackDoctrinePacket(
  input: BaziBucketFallbackDoctrinePacketComposerInput,
): BaziDoctrinePacket {
  return composeBaziDoctrinePacket({
    questionContext: createBaziBucketFallbackDoctrinePacketQuestionContext(input.canonicalBucket),
    payload: input.payload,
  });
}