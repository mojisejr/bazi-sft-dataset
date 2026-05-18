import { z } from "zod";

import {
  GENERALIZED_ELEMENT_INTERACTION_TYPES,
  GENERALIZED_INTERACTION_DAY_MASTER_EFFECTS,
  GENERALIZED_INTERACTION_ENTITY_TYPES,
  GENERALIZED_INTERACTION_FAMILY_KEYS,
  GENERALIZED_INTERACTION_OUTCOME_STATUSES,
  GENERALIZED_INTERACTION_PRECEDENCE_LEVELS,
  GENERALIZED_INTERACTION_QUALIFIER_KEYS,
  GENERALIZED_INTERACTION_QUALIFIER_LANES,
} from "@/lib/bazi/symbolic-engine.constants";

export const ANNOTATION_DIMENSION_NAMES = [
  "chart_foundation",
  "balance_element",
  "ten_gods_reaction",
  "twelve_qi_cycle",
  "pillar_relations",
  "health_overview",
  "career_potential",
  "wealth_and_investment",
  "love_and_family",
  "personality_psychology",
  "major_luck_cycles",
  "annual_star_energy",
  "red_flags",
  "actionable_advice",
  "core_prediction",
] as const;

export const ACTIVE_RLHF_DIMENSION_NAMES = ANNOTATION_DIMENSION_NAMES;

export const REQUIRED_ANNOTATION_DIMENSION_NAMES = ANNOTATION_DIMENSION_NAMES;

export const REQUIRED_ANNOTATION_DIMENSION_COUNT =
  REQUIRED_ANNOTATION_DIMENSION_NAMES.length;

export const ACTIVE_RLHF_DIMENSION_COUNT = ACTIVE_RLHF_DIMENSION_NAMES.length;

export const AnnotationDimensionNameSchema = z.enum(
  ANNOTATION_DIMENSION_NAMES,
);

export const PillarValueSchema = z.object({
  stem: z.string().trim().min(1),
  branch: z.string().trim().min(1),
  hiddenStems: z.array(z.string().trim().min(1)).optional(),
  tenGod: z.string().trim().min(1).optional(),
  stemTranslation: z.string().trim().min(1).optional(),
  branchTranslation: z.string().trim().min(1).optional(),
  sittingStage: z.string().trim().min(1).optional(),
  lookingStage: z.string().trim().min(1).optional(),
  upperStagePrimary: z.string().trim().min(1).optional(),
  upperStageContext: z.string().trim().min(1).optional(),
  upperStageDisplay: z.string().trim().min(1).optional(),
  lowerStagePrimary: z.string().trim().min(1).optional(),
  lowerStageContext: z.string().trim().min(1).optional(),
  lowerStageDisplay: z.string().trim().min(1).optional(),
});

export const DaYunPhaseSchema = z.object({
  startAge: z.number().int().nonnegative(),
  endAge: z.number().int().nonnegative(),
  symbol: z.string().trim().min(1),
  source: z.enum(["stem", "branch"]),
  twelveQiDisplay: z.string().trim().min(1).optional(),
  isCurrent: z.boolean().optional(),
});

export const DaYunPillarSchema = z.object({
  startAge: z.number().int().nonnegative(),
  endAge: z.number().int().nonnegative(),
  stem: z.string().trim().min(1),
  branch: z.string().trim().min(1),
  isCurrent: z.boolean().optional(),
  currentPhase: z.enum(["upper", "lower"]).optional(),
  upperStageDisplay: z.string().trim().min(1).optional(),
  lowerStageDisplay: z.string().trim().min(1).optional(),
  upperPhase: DaYunPhaseSchema.optional(),
  lowerPhase: DaYunPhaseSchema.optional(),
});

export const ShenShaSchema = z.object({
  starName: z.string().trim().min(1),
  relatedPillar: z.string().trim().min(1),
  meaning: z.string().trim().min(1),
});

export const RawInputSchema = z.object({
  birthDate: z.string().trim().min(1),
  birthTime: z.string().trim().min(1),
  gender: z.string().trim().min(1),
  province: z.string().trim().min(1),
  calendarSystem: z.enum(["solar", "lunar"]).optional(),
  timezone: z.string().trim().min(1).optional(),
});

export const AgeSnapshotSchema = z.object({
  referenceDate: z.string().trim().min(1),
  thaiAge: z.number().int().nonnegative(),
  chineseAge: z.number().int().positive(),
});

export const ElementMetaphorSchema = z.object({
  element: z.string().trim().min(1),
  metaphor: z.string().trim().min(1),
});

const DEFAULT_ELEMENT_COUNTS = {
  wood: 0,
  fire: 0,
  earth: 0,
  metal: 0,
  water: 0,
} as const;

export const SupportedElementSchema = z.enum([
  "wood",
  "fire",
  "earth",
  "metal",
  "water",
]);

export const ElementCountsSchema = z.object({
  wood: z.number().int().nonnegative(),
  fire: z.number().int().nonnegative(),
  earth: z.number().int().nonnegative(),
  metal: z.number().int().nonnegative(),
  water: z.number().int().nonnegative(),
});

export const ElementSeasonalSupportSchema = z.enum([
  "seasonal-peak",
  "seasonal-support",
  "seasonal-drained",
]);

export const ElementStrengthLevelSchema = z.enum([
  "missing",
  "weak",
  "balanced",
  "strong",
]);

export const ElementStrengthSchema = z.object({
  element: SupportedElementSchema,
  rooted: z.boolean().default(false),
  seasonalSupport: ElementSeasonalSupportSchema,
  strength: ElementStrengthLevelSchema,
});

export const ContextRuleNoteKeySchema = z.enum([
  "NARRATIVE_SUPPORTS_BUT_NOT_OVERRIDE",
  "PERSONA_TWELVE_QI_TONE",
  "SOLAR_TERM_BOUNDARY_NEAR",
  "ACTIVE_COMBINATION_PRECEDENCE",
  "CLASH_NEUTRALIZED_BY_COMBINATION",
  "ACTIVE_CLASH_OUTRANKS_PUNISHMENT",
  "ACTIVE_PUNISHMENT_REMAINS",
  "HARM_SUPPLEMENTARY_UNDER_HIGHER_PRECEDENCE",
  "HARM_ACTIVE_SECONDARY",
  "DESTRUCTION_SUPPLEMENTARY_UNDER_HIGHER_PRECEDENCE",
  "DESTRUCTION_ACTIVE_SECONDARY",
  "MONTH_BRANCH_CLASH_REDUCES_SEASONAL_SUPPORT",
]);

export const ContextRuleNoteSchema = z.object({
  key: ContextRuleNoteKeySchema,
  params: z.record(z.string(), z.string()).default({}),
});

export const ElementAnalysisSchema = z.object({
  visibleCounts: ElementCountsSchema.default(DEFAULT_ELEMENT_COUNTS),
  hiddenCounts: ElementCountsSchema.default(DEFAULT_ELEMENT_COUNTS),
  totalCounts: ElementCountsSchema.default(DEFAULT_ELEMENT_COUNTS),
  missingElements: z.array(SupportedElementSchema).default([]),
  dominantElements: z.array(SupportedElementSchema).default([]),
  elementStrengths: z.array(ElementStrengthSchema).default([]),
});

export const SeasonalInteractionSchema = z.object({
  dayMasterStem: z.string().trim().min(1),
  dayMasterElement: SupportedElementSchema,
  monthBranch: z.string().trim().min(1),
  season: z.enum(["spring", "summer", "autumn", "winter"]),
  phase: z.enum(["early", "peak", "late"]),
  seasonLabel: z.string().trim().min(1),
  metaphor: z.string().trim().min(1),
});

export const CalculationTraceSchema = z.object({
  engine: z.enum(["lunar-js", "orthodox-override"]),
  ruleName: z.string().trim().min(1),
  steps: z.array(z.string().trim().min(1)).default([]),
  stepKeys: z.array(z.string().trim().min(1)).default([]),
  rawVariables: z.record(z.string(), z.unknown()).optional(),
});

export function createExplainableValueSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    trace: CalculationTraceSchema.optional(),
  });
}

export const ExplainablePillarValueSchema = createExplainableValueSchema(PillarValueSchema);
export const ExplainableNumberSchema = createExplainableValueSchema(z.number().finite());

export const SixtyJiaziCorePersonaSchema = z.object({
  code: z.string().trim().min(1),
  narrative: z.string().trim().min(1),
  heavenNarrative: z.string().trim().min(1).optional(),
  earthNarrative: z.string().trim().min(1).optional(),
  elementTone: z.string().trim().min(1).optional(),
  twelveQiLabel: z.string().trim().min(1).optional(),
  semanticNotes: z.array(z.string().trim().min(1)).default([]),
  precedenceNotes: z.array(z.string().trim().min(1)).default([]),
  precedenceNoteSignals: z.array(ContextRuleNoteSchema).default([]),
});

export const DayMasterStrengthProfileSchema = z.object({
  dayMaster: z.string().trim().min(1),
  strengthState: z.string().trim().min(1),
  sourceState: z.string().trim().min(1).optional(),
  lookupState: z.string().trim().min(1).optional(),
  displayBand: z.string().trim().min(1).optional(),
  displayLabel: z.string().trim().min(1).optional(),
  narrative: z.string().trim().min(1),
  narrativeReason: z.string().trim().min(1).optional(),
  qiLabel: z.string().trim().min(1).optional(),
  scoreText: z.string().trim().min(1).optional(),
});

export const CompatibilityMatrixEntrySchema = z.object({
  code: z.string().trim().min(1),
  label: z.string().trim().min(1),
  scoreText: z.string().trim().min(1).optional(),
  narrative: z.string().trim().min(1).optional(),
  counterpartCode: z.string().trim().min(1).optional(),
  counterpartBranch: z.string().trim().min(1),
});

export const CompatibilityMatrixProfileSchema = z.object({
  domain: z.enum(["love", "work"]),
  pairKey: z.string().trim().min(1),
  entries: z.array(CompatibilityMatrixEntrySchema).default([]),
});

export const BaseChartReadingBadgeFamilySchema = z.enum([
  "route",
  "role",
  "interaction",
  "marker",
]);

export const BaseChartReadingPrioritySchema = z.enum([
  "primary",
  "secondary",
  "neutralized",
]);

export const BaseChartReadingStatusSchema = z.enum([
  "active",
  "supplementary",
  "neutralized",
]);

export const BaseChartSemanticKindSchema = z.enum([
  "role-stem",
  "role-branch",
  "stem-combination",
  "stem-clash",
  "branch-liu-he",
  "branch-san-he",
  "branch-ban-san-he",
  "branch-combination",
  "branch-clash",
  "branch-harm",
  "branch-destruction",
  "branch-punishment-pair",
  "branch-punishment-trio",
  "branch-punishment-self",
  "intra-pillar-destruction",
  "element-generate",
  "element-control",
  "marker-nobleman",
  "marker-wenchang",
  "marker-generic",
]);

export const BaseChartHierarchyLevelSchema = z.enum([
  "foundation",
  "day-master",
  "interaction",
  "overlay",
]);

export const BaseChartParticipantTypeSchema = z.enum([
  "stem",
  "branch",
  "pillar",
  "marker",
]);

export const BaseChartDetailItemSchema = z.object({
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
});

export const BaseChartParticipantSchema = z.object({
  pillarKey: z.string().trim().min(1).optional(),
  pillarLabel: z.string().trim().min(1).optional(),
  type: BaseChartParticipantTypeSchema,
  symbol: z.string().trim().min(1),
  translation: z.string().trim().min(1).optional(),
});

export const BaseChartModalContentSchema = z.object({
  title: z.string().trim().min(1),
  family: BaseChartReadingBadgeFamilySchema,
  summary: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  readingOrderHint: z.string().trim().min(1),
  details: z.array(BaseChartDetailItemSchema).default([]),
});

export const InteractionTierSchema = z.enum([
  "primary",
  "secondary",
  "tertiary",
]);

export const BaseChartReactionBadgeSchema = z.object({
  id: z.string().trim().min(1),
  family: BaseChartReadingBadgeFamilySchema,
  label: z.string().trim().min(1),
  shortLabel: z.string().trim().min(1).optional(),
  priority: BaseChartReadingPrioritySchema,
  status: BaseChartReadingStatusSchema,
  meaningShort: z.string().trim().min(1),
  schoolLabel: z.string().trim().min(1).optional(),
  doctrineKey: z.string().trim().min(1).optional(),
  semanticKind: BaseChartSemanticKindSchema.optional(),
  hierarchyLevel: BaseChartHierarchyLevelSchema.optional(),
  readingOrder: z.number().int().nonnegative().optional(),
  tier: InteractionTierSchema.optional(),
  sourceRelationId: z.string().trim().min(1).optional(),
  sourceFamilyKey: z.string().trim().min(1).optional(),
  sourceOutcomeStatus: z.string().trim().min(1).optional(),
  participants: z.array(BaseChartParticipantSchema).default([]),
  modal: BaseChartModalContentSchema,
});

export const BaseChartReactionGroupSchema = z.object({
  key: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  family: BaseChartReadingBadgeFamilySchema,
  hierarchyLevel: BaseChartHierarchyLevelSchema.optional(),
  readingOrder: z.number().int().nonnegative().optional(),
  badges: z.array(BaseChartReactionBadgeSchema).default([]),
});

export const BaseChartReadingSchema = z.object({
  roleBadges: z.array(BaseChartReactionBadgeSchema).default([]),
  stemInteractionBadges: z.array(BaseChartReactionBadgeSchema).default([]),
  branchInteractionBadges: z.array(BaseChartReactionBadgeSchema).default([]),
  markerBadges: z.array(BaseChartReactionBadgeSchema).default([]),
  groups: z.array(BaseChartReactionGroupSchema).default([]),
  legendItems: z.array(BaseChartDetailItemSchema).default([]),
  readingOrderSteps: z.array(z.string().trim().min(1)).default([]),
});

export const GeneralizedInteractionEntityTypeSchema = z.enum(
  GENERALIZED_INTERACTION_ENTITY_TYPES,
);

export const GeneralizedInteractionFamilyKeySchema = z.enum(
  GENERALIZED_INTERACTION_FAMILY_KEYS,
);

export const GeneralizedElementInteractionTypeSchema = z.enum(
  GENERALIZED_ELEMENT_INTERACTION_TYPES,
);

export const GeneralizedInteractionOutcomeStatusSchema = z.enum(
  GENERALIZED_INTERACTION_OUTCOME_STATUSES,
);

export const GeneralizedInteractionDayMasterEffectSchema = z.enum(
  GENERALIZED_INTERACTION_DAY_MASTER_EFFECTS,
);

export const GeneralizedInteractionPrecedenceLevelSchema = z.enum(
  GENERALIZED_INTERACTION_PRECEDENCE_LEVELS,
);

export const GeneralizedInteractionQualifierLaneSchema = z.enum(
  GENERALIZED_INTERACTION_QUALIFIER_LANES,
);

export const GeneralizedInteractionQualifierKeySchema = z.enum(
  GENERALIZED_INTERACTION_QUALIFIER_KEYS,
);

export const InteractionEntitySchema = z.object({
  id: z.string().trim().min(1),
  type: GeneralizedInteractionEntityTypeSchema,
  pillarKey: z.string().trim().min(1).optional(),
  symbol: z.string().trim().min(1),
  element: SupportedElementSchema.optional(),
  hidden: z.boolean().optional(),
  label: z.string().trim().min(1).optional(),
});

export const InteractionRelationSchema = z.object({
  id: z.string().trim().min(1),
  familyKey: GeneralizedInteractionFamilyKeySchema,
  type: z.string().trim().min(1),
  participantEntityIds: z.array(z.string().trim().min(1)).min(1),
  label: z.string().trim().min(1),
  elementInteractionType: GeneralizedElementInteractionTypeSchema.optional(),
  transformElement: SupportedElementSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const InteractionOutcomeSchema = z.object({
  relationId: z.string().trim().min(1),
  status: GeneralizedInteractionOutcomeStatusSchema,
  precedence: GeneralizedInteractionPrecedenceLevelSchema.optional(),
  transformElement: SupportedElementSchema.optional(),
  supportReasons: z.array(z.string().trim().min(1)).default([]),
  dayMasterEffect: GeneralizedInteractionDayMasterEffectSchema.optional(),
  blockedByRelationIds: z.array(z.string().trim().min(1)).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const InteractionQualifierSchema = z.object({
  id: z.string().trim().min(1),
  lane: GeneralizedInteractionQualifierLaneSchema,
  qualifierKey: GeneralizedInteractionQualifierKeySchema,
  entityId: z.string().trim().min(1),
  value: z.string().trim().min(1),
  display: z.string().trim().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const InteractionStateSchema = z.object({
  version: z.literal("v3-phase-1"),
  entities: z.array(InteractionEntitySchema).default([]),
  relations: z.array(InteractionRelationSchema).default([]),
  outcomes: z.array(InteractionOutcomeSchema).default([]),
  qualifiers: z.array(InteractionQualifierSchema).default([]),
});

export const CalculatedStateExplainableSchema = z.object({
  mingGong: ExplainablePillarValueSchema.optional(),
  strengthScore: ExplainableNumberSchema.optional(),
});

export const CalculatedStateSchema = z.object({
  fourPillars: z.object({
    year: PillarValueSchema,
    month: PillarValueSchema,
    day: PillarValueSchema,
    hour: PillarValueSchema,
  }),
  ageSnapshot: AgeSnapshotSchema.optional(),
  mingGong: PillarValueSchema.optional(),
  daYun: z.array(DaYunPillarSchema).default([]),
  liuNian: PillarValueSchema.optional(),
  shenSha: z.array(ShenShaSchema).default([]),
  dayMaster: z.string().trim().min(1),
  strengthScore: z.number().finite(),
  tenGods: z.record(z.string(), z.string()),
  twelveQi: z.record(z.string(), z.string()),
  elementMetaphors: z.array(ElementMetaphorSchema).default([]),
  elementAnalysis: ElementAnalysisSchema.default({
    visibleCounts: DEFAULT_ELEMENT_COUNTS,
    hiddenCounts: DEFAULT_ELEMENT_COUNTS,
    totalCounts: DEFAULT_ELEMENT_COUNTS,
    missingElements: [],
    dominantElements: [],
    elementStrengths: [],
  }),
  seasonalInteraction: SeasonalInteractionSchema.optional(),
  dayMasterStrengthProfile: DayMasterStrengthProfileSchema.optional(),
  sixtyJiaziCorePersona: SixtyJiaziCorePersonaSchema.optional(),
  interactionState: InteractionStateSchema.optional(),
  baseChartReading: BaseChartReadingSchema.optional(),
  compatibilityMatrixProfiles: z.array(CompatibilityMatrixProfileSchema).default([]),
  isForwardDirection: z.boolean().optional(),
  explainable: CalculatedStateExplainableSchema.default({}),
});

export const DimensionSchema = z.object({
  dimension_name: AnnotationDimensionNameSchema,
  thought_process: z.string().trim().min(1),
  final_prediction: z.string().trim().min(1),
  supporting_signals: z.array(z.string().trim().min(1)).default([]),
  confidence_note: z.string().trim().min(1).optional(),
});

export const DraftDimensionSchema = z.object({
  dimension_name: AnnotationDimensionNameSchema,
  thought_process: z.string(),
  final_prediction: z.string(),
  supporting_signals: z.array(z.string().trim().min(1)).default([]),
  confidence_note: z.string().trim().min(1).optional(),
});

export function addAnnotationDimensionIssues(
  value: { dimensions: Array<{ dimension_name: AnnotationDimensionName }> },
  context: z.RefinementCtx,
  requiredDimensionNames: readonly AnnotationDimensionName[] = REQUIRED_ANNOTATION_DIMENSION_NAMES,
) {
  const names = value.dimensions.map((dimension) => dimension.dimension_name);
  const uniqueNames = new Set(names);

  if (uniqueNames.size !== names.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "annotation_data.dimensions must not contain duplicate dimensions.",
      path: ["dimensions"],
    });
  }

  const missingNames = requiredDimensionNames.filter(
    (dimensionName) => !uniqueNames.has(dimensionName),
  );

  if (missingNames.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `annotation_data.dimensions is missing: ${missingNames.join(", ")}`,
      path: ["dimensions"],
    });
  }
}

export const DraftAnnotationDataSchema = z
  .object({
    version: z.literal("1.6"),
    dimensions: z.array(DraftDimensionSchema)
      .min(ACTIVE_RLHF_DIMENSION_COUNT)
      .max(REQUIRED_ANNOTATION_DIMENSION_COUNT),
    reviewSummary: z.string().trim().min(1).optional(),
    sinsaeProofNote: z.string().trim().min(1).optional(),
  })
  .superRefine((value, context) => {
    addAnnotationDimensionIssues(value, context);
  });

export const AnnotationDataSchema = z
  .object({
    version: z.literal("1.6"),
    dimensions: z.array(DimensionSchema)
      .min(ACTIVE_RLHF_DIMENSION_COUNT)
      .max(REQUIRED_ANNOTATION_DIMENSION_COUNT),
    reviewSummary: z.string().trim().min(1).optional(),
    sinsaeProofNote: z.string().trim().min(1),
  })
  .superRefine((value, context) => {
    addAnnotationDimensionIssues(value, context);
  });

export const RejectedAnnotationDataSchema = z
  .object({
    version: z.literal("1.6"),
    dimensions: z.array(DraftDimensionSchema)
      .min(ACTIVE_RLHF_DIMENSION_COUNT)
      .max(REQUIRED_ANNOTATION_DIMENSION_COUNT),
    reviewSummary: z.string().trim().min(1).optional(),
    sinsaeProofNote: z.string().trim().min(1),
  })
  .superRefine((value, context) => {
    addAnnotationDimensionIssues(value, context);
  });

export type PillarValue = z.infer<typeof PillarValueSchema>;
export type DaYunPhaseValue = z.infer<typeof DaYunPhaseSchema>;
export type DaYunPillarValue = z.infer<typeof DaYunPillarSchema>;
export type ShenShaValue = z.infer<typeof ShenShaSchema>;
export type AnnotationDimensionName = z.infer<typeof AnnotationDimensionNameSchema>;
export type RawInputValue = z.infer<typeof RawInputSchema>;
export type AgeSnapshotValue = z.infer<typeof AgeSnapshotSchema>;
export type CalculatedStateValue = z.infer<typeof CalculatedStateSchema>;
export type SupportedElementValue = z.infer<typeof SupportedElementSchema>;
export type DayMasterStrengthProfileValue = z.infer<typeof DayMasterStrengthProfileSchema>;
export type ElementCountsValue = z.infer<typeof ElementCountsSchema>;
export type ElementSeasonalSupportValue = z.infer<typeof ElementSeasonalSupportSchema>;
export type ElementStrengthLevelValue = z.infer<typeof ElementStrengthLevelSchema>;
export type ElementStrengthValue = z.infer<typeof ElementStrengthSchema>;
export type ElementAnalysisValue = z.infer<typeof ElementAnalysisSchema>;
export type SeasonalInteractionValue = z.infer<typeof SeasonalInteractionSchema>;
export type ContextRuleNoteKeyValue = z.infer<typeof ContextRuleNoteKeySchema>;
export type ContextRuleNoteValue = z.infer<typeof ContextRuleNoteSchema>;
export type CalculationTraceValue = z.infer<typeof CalculationTraceSchema>;
export type ExplainableValue<T> = {
  value: T;
  trace?: CalculationTraceValue;
};
export type DraftDimensionValue = z.infer<typeof DraftDimensionSchema>;
export type DimensionValue = z.infer<typeof DimensionSchema>;
export type DraftAnnotationDataValue = z.infer<typeof DraftAnnotationDataSchema>;
export type AnnotationDataValue = z.infer<typeof AnnotationDataSchema>;
export type RejectedAnnotationDataValue = z.infer<typeof RejectedAnnotationDataSchema>;
export type StoredAnnotationDataValue =
  | DraftAnnotationDataValue
  | AnnotationDataValue
  | RejectedAnnotationDataValue;
export type CompatibilityMatrixProfileValue = z.infer<typeof CompatibilityMatrixProfileSchema>;
export type CalculatedStateExplainableValue = z.infer<typeof CalculatedStateExplainableSchema>;
export type BaseChartReadingBadgeFamilyValue = z.infer<typeof BaseChartReadingBadgeFamilySchema>;
export type BaseChartReadingPriorityValue = z.infer<typeof BaseChartReadingPrioritySchema>;
export type BaseChartReadingStatusValue = z.infer<typeof BaseChartReadingStatusSchema>;
export type BaseChartParticipantTypeValue = z.infer<typeof BaseChartParticipantTypeSchema>;
export type BaseChartDetailItemValue = z.infer<typeof BaseChartDetailItemSchema>;
export type BaseChartParticipantValue = z.infer<typeof BaseChartParticipantSchema>;
export type BaseChartModalContentValue = z.infer<typeof BaseChartModalContentSchema>;
export type BaseChartReactionBadgeValue = z.infer<typeof BaseChartReactionBadgeSchema>;
export type InteractionTierValue = z.infer<typeof InteractionTierSchema>;
export type BaseChartReactionGroupValue = z.infer<typeof BaseChartReactionGroupSchema>;
export type BaseChartReadingValue = z.infer<typeof BaseChartReadingSchema>;
export type GeneralizedInteractionEntityTypeValue = z.infer<
  typeof GeneralizedInteractionEntityTypeSchema
>;
export type GeneralizedInteractionFamilyKeyValue = z.infer<
  typeof GeneralizedInteractionFamilyKeySchema
>;
export type GeneralizedElementInteractionTypeValue = z.infer<
  typeof GeneralizedElementInteractionTypeSchema
>;
export type GeneralizedInteractionOutcomeStatusValue = z.infer<
  typeof GeneralizedInteractionOutcomeStatusSchema
>;
export type GeneralizedInteractionDayMasterEffectValue = z.infer<
  typeof GeneralizedInteractionDayMasterEffectSchema
>;
export type GeneralizedInteractionPrecedenceLevelValue = z.infer<
  typeof GeneralizedInteractionPrecedenceLevelSchema
>;
export type GeneralizedInteractionQualifierLaneValue = z.infer<
  typeof GeneralizedInteractionQualifierLaneSchema
>;
export type GeneralizedInteractionQualifierKeyValue = z.infer<
  typeof GeneralizedInteractionQualifierKeySchema
>;
export type InteractionEntityValue = z.infer<typeof InteractionEntitySchema>;
export type InteractionRelationValue = z.infer<typeof InteractionRelationSchema>;
export type InteractionOutcomeValue = z.infer<typeof InteractionOutcomeSchema>;
export type InteractionQualifierValue = z.infer<typeof InteractionQualifierSchema>;
export type InteractionStateValue = z.infer<typeof InteractionStateSchema>;
