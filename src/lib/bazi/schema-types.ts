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

export const SixtyJiaziCorePersonaSchema = z.object({
  code: z.string().trim().min(1),
  narrative: z.string().trim().min(1),
  precedenceNotes: z.array(z.string().trim().min(1)).default([]),
});

export const CalculatedStateSchema = z.object({
  fourPillars: z.object({
    year: PillarValueSchema,
    month: PillarValueSchema,
    day: PillarValueSchema,
    hour: PillarValueSchema,
  }),
  dayMaster: z.string().trim().min(1),
  strengthScore: z.number().finite(),
  tenGods: z.record(z.string(), z.string()),
  twelveQi: z.record(z.string(), z.string()),
  elementMetaphors: z.array(ElementMetaphorSchema).default([]),
  sixtyJiaziCorePersona: SixtyJiaziCorePersonaSchema.optional(),
});

export const DimensionSchema = z.object({
  dimension_name: AnnotationDimensionNameSchema,
  thought_process: z.string().trim().min(1),
  final_prediction: z.string().trim().min(1),
  supporting_signals: z.array(z.string().trim().min(1)).default([]),
  confidence_note: z.string().trim().min(1).optional(),
});

export const AnnotationDataSchema = z
  .object({
    version: z.literal("1.6"),
    dimensions: z.array(DimensionSchema).length(REQUIRED_ANNOTATION_DIMENSION_COUNT),
    reviewSummary: z.string().trim().min(1).optional(),
  })
  .superRefine((value, context) => {
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
  });

export type PillarValue = z.infer<typeof PillarValueSchema>;
export type RawInputValue = z.infer<typeof RawInputSchema>;
export type CalculatedStateValue = z.infer<typeof CalculatedStateSchema>;
export type DimensionValue = z.infer<typeof DimensionSchema>;
export type AnnotationDataValue = z.infer<typeof AnnotationDataSchema>;
