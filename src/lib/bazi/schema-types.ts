import { z } from "zod";

export const REQUIRED_ANNOTATION_DIMENSION_NAMES = [
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

export const REQUIRED_ANNOTATION_DIMENSION_COUNT =
  REQUIRED_ANNOTATION_DIMENSION_NAMES.length;

export const AnnotationDimensionNameSchema = z.enum(
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
);

export const PillarValueSchema = z.object({
  stem: z.string().trim().min(1),
  branch: z.string().trim().min(1),
  hiddenStems: z.array(z.string().trim().min(1)).optional(),
});

export const DaYunPillarSchema = z.object({
  startAge: z.number().int().nonnegative(),
  endAge: z.number().int().nonnegative(),
  stem: z.string().trim().min(1),
  branch: z.string().trim().min(1),
  isCurrent: z.boolean().optional(),
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

export const ElementMetaphorSchema = z.object({
  element: z.string().trim().min(1),
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
  elementTone: z.string().trim().min(1).optional(),
  twelveQiLabel: z.string().trim().min(1).optional(),
  semanticNotes: z.array(z.string().trim().min(1)).default([]),
  precedenceNotes: z.array(z.string().trim().min(1)).default([]),
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
  mingGong: PillarValueSchema.optional(),
  daYun: z.array(DaYunPillarSchema).default([]),
  liuNian: PillarValueSchema.optional(),
  shenSha: z.array(ShenShaSchema).default([]),
  dayMaster: z.string().trim().min(1),
  strengthScore: z.number().finite(),
  tenGods: z.record(z.string(), z.string()),
  twelveQi: z.record(z.string(), z.string()),
  elementMetaphors: z.array(ElementMetaphorSchema).default([]),
  sixtyJiaziCorePersona: SixtyJiaziCorePersonaSchema.optional(),
  compatibilityMatrixProfiles: z.array(CompatibilityMatrixProfileSchema).default([]),
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

function refineAnnotationDimensions(
  value: { dimensions: Array<{ dimension_name: AnnotationDimensionName }> },
  context: z.RefinementCtx,
) {
  const names = value.dimensions.map((dimension) => dimension.dimension_name);
  const uniqueNames = new Set(names);

  if (uniqueNames.size !== REQUIRED_ANNOTATION_DIMENSION_COUNT) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "annotation_data.dimensions must not contain duplicate dimensions.",
      path: ["dimensions"],
    });
  }

  const missingNames = REQUIRED_ANNOTATION_DIMENSION_NAMES.filter(
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
    dimensions: z.array(DraftDimensionSchema).length(REQUIRED_ANNOTATION_DIMENSION_COUNT),
    reviewSummary: z.string().trim().min(1).optional(),
    sinsaeProofNote: z.string().trim().min(1).optional(),
  })
  .superRefine(refineAnnotationDimensions);

export const AnnotationDataSchema = z
  .object({
    version: z.literal("1.6"),
    dimensions: z.array(DimensionSchema).length(REQUIRED_ANNOTATION_DIMENSION_COUNT),
    reviewSummary: z.string().trim().min(1).optional(),
    sinsaeProofNote: z.string().trim().min(1),
  })
  .superRefine(refineAnnotationDimensions);

export const RejectedAnnotationDataSchema = z
  .object({
    version: z.literal("1.6"),
    dimensions: z.array(DraftDimensionSchema).length(REQUIRED_ANNOTATION_DIMENSION_COUNT),
    reviewSummary: z.string().trim().min(1).optional(),
    sinsaeProofNote: z.string().trim().min(1),
  })
  .superRefine(refineAnnotationDimensions);

export type PillarValue = z.infer<typeof PillarValueSchema>;
export type DaYunPillarValue = z.infer<typeof DaYunPillarSchema>;
export type ShenShaValue = z.infer<typeof ShenShaSchema>;
export type AnnotationDimensionName = z.infer<typeof AnnotationDimensionNameSchema>;
export type RawInputValue = z.infer<typeof RawInputSchema>;
export type CalculatedStateValue = z.infer<typeof CalculatedStateSchema>;
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
