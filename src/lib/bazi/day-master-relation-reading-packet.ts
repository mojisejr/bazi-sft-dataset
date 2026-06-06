import { z } from "zod";

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

export type RelationReadingPacket = z.infer<typeof RelationReadingPacketSchema>;