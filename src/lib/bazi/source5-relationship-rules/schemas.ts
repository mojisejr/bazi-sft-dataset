import { z } from "zod";

import { SOURCE5_RELATIONSHIP_STEP_IDS } from "@/lib/bazi/source5-relationship-doctrine";
import { FIVE_ELEMENT_ORDER } from "@/lib/bazi/symbolic-engine.constants";
import type { BaziCallerContract } from "@/lib/bazi/symbolic-engine.caller-contract";
import type { BaziSharedPacket } from "@/lib/bazi/symbolic-engine.shared-packets";

export const Source5ElementSchema = z.enum(FIVE_ELEMENT_ORDER);
export const Source5RelationshipRoleSchema = z.enum(["output", "resource", "wealth", "power", "parallel"]);
export const Source5QualityBandSchema = z.enum(["favorable", "mixed", "challenging"]);

export const Source5StepSymbolMatchSchema = z.object({
  pillarKey: z.enum(["year", "month", "day", "hour"]),
  symbol: z.string().trim().min(1),
  pillarCode: z.string().trim().min(2),
});

export const Source5HiddenStemMatchSchema = z.object({
  pillarKey: z.enum(["year", "month", "day", "hour"]),
  branch: z.string().trim().min(1),
  hiddenStem: z.string().trim().min(1),
  pillarCode: z.string().trim().min(2),
});

export const Source5CheingsaeStageSchema = z.object({
  source: z.literal("pillar-display.resolveCanonicalTwelveQiStage"),
  branch: z.string().trim().min(1),
  branchLabel: z.string().trim().min(1),
  stageOrder: z.number().int().min(1).max(12),
  stageNameChinese: z.string().trim().min(1),
  stageNameThai: z.string().trim().min(1),
  meaning: z.string().trim().min(1),
  qualityBand: z.enum(["favorable", "challenging"]),
});

export const Source5RelationshipPotentialResultSchema = z.object({
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

export const Source5ReactionResultSchema = z.object({
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

export const Source5SpouseLookupResultSchema = z.object({
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

export const Source5RelationshipCheingsaeResultSchema = z.object({
  kind: z.literal("relationship-12-cheingsae"),
  source: z.literal("pillar-display.resolveCanonicalTwelveQiStage"),
  selectedLane: z.enum(["direct-spouse-branch", "hidden-spouse-branch", "spouse-base-fallback"]),
  spouseBaseStage: Source5CheingsaeStageSchema,
  spouseElementStages: z.array(Source5CheingsaeStageSchema).min(1),
  selectedStages: z.array(Source5CheingsaeStageSchema).min(1),
  qualityBand: Source5QualityBandSchema,
});

export const Source5ConflictConsequenceSchema = z.object({
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

export const Source5ConflictImpactResultSchema = z.object({
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

export const Source5TimingRoleTargetSchema = z.object({
  role: Source5RelationshipRoleSchema,
  targetElement: Source5ElementSchema,
  targetElementLabel: z.string().trim().min(1),
});

export const Source5TimingWindowAssessmentSchema = z.object({
  pillarCode: z.string().trim().min(2),
  startAge: z.number().int().nonnegative(),
  endAge: z.number().int().nonnegative(),
  stemElement: Source5ElementSchema,
  branchElement: Source5ElementSchema,
  matchedRoles: z.array(Source5RelationshipRoleSchema),
  cheingsae: Source5CheingsaeStageSchema,
  timingSignal: z.enum(["prime-window", "supportive-window", "background-window"]),
});

export const Source5MarriageTimingResultSchema = z.object({
  kind: z.literal("marriage-timing"),
  targetRoles: z.array(Source5TimingRoleTargetSchema).min(1),
  strengthState: z.string().trim().min(1),
  thaiAge: z.number().int().nonnegative(),
  currentWindow: Source5TimingWindowAssessmentSchema.nullable(),
  projectedWindows: z.array(Source5TimingWindowAssessmentSchema),
});

export const Source5SpecialSignalSchema = z.object({
  signalKey: z.string().trim().min(1),
  label: z.string().trim().min(1),
  evidence: z.string().trim().min(1),
});

export const Source5SpouseProfileResultSchema = z.object({
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

export const Source5SpecialRulesResultSchema = z.object({
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
export type Source5RelationshipStepComputation<
  TResult extends Source5RelationshipStepResult = Source5RelationshipStepResult,
> = {
  packetFamilies: BaziSharedPacket["family"][];
  result: TResult;
};

export type Source5RelationshipPotentialResult = z.infer<typeof Source5RelationshipPotentialResultSchema>;
export type Source5ReactionResult = z.infer<typeof Source5ReactionResultSchema>;
export type Source5Element = z.infer<typeof Source5ElementSchema>;
export type Source5RelationshipRole = z.infer<typeof Source5RelationshipRoleSchema>;
export type Source5SpouseLookupResult = z.infer<typeof Source5SpouseLookupResultSchema>;
export type Source5RelationshipCheingsaeResult = z.infer<typeof Source5RelationshipCheingsaeResultSchema>;
export type Source5CheingsaeStage = z.infer<typeof Source5CheingsaeStageSchema>;
export type Source5ConflictConsequence = z.infer<typeof Source5ConflictConsequenceSchema>;
export type Source5ConflictImpactResult = z.infer<typeof Source5ConflictImpactResultSchema>;
export type Source5TimingRoleTarget = z.infer<typeof Source5TimingRoleTargetSchema>;
export type Source5MarriageTimingResult = z.infer<typeof Source5MarriageTimingResultSchema>;
export type Source5SpecialSignal = z.infer<typeof Source5SpecialSignalSchema>;
export type Source5SpecialRulesResult = z.infer<typeof Source5SpecialRulesResultSchema>;
export type Source5PillarKey = keyof BaziCallerContract["sharedPacketSpine"]["chartIdentity"]["fourPillars"];
export type Source5Pillar = BaziCallerContract["sharedPacketSpine"]["chartIdentity"]["fourPillars"][Source5PillarKey];
export type Source5StepId = (typeof SOURCE5_RELATIONSHIP_STEP_IDS)[number];