import { z } from "zod";

import {
  AgeSnapshotSchema,
  CalculationTraceSchema,
  ContextRuleNoteSchema,
  DaYunPillarSchema,
  ElementAnalysisSchema,
  InteractionEntitySchema,
  PillarValueSchema,
  SeasonalInteractionSchema,
} from "@/lib/bazi/schema-types";
import {
  buildSource1StrengthContract,
  SOURCE1_CONTRACT_FIELD_IDS,
} from "@/lib/bazi/source1-operating-system-contract";
import {
  CANONICAL_DAY_MASTER_STRENGTH_STATES,
  STRENGTH_DOCTRINE_SEMANTIC_IDS,
} from "@/lib/bazi/strength-state-vocabulary";
import type { BaziOsCoreFactState } from "@/lib/bazi/symbolic-engine.types";

const MAX_PRECEDENCE_NOTES = 6;
const MAX_CONTEXT_ITEMS = 12;
const DEFAULT_TIMING_LOOKAHEAD = 2;
const MAX_TIMING_LOOKAHEAD = 3;

export const BAZI_SHARED_PACKET_FAMILIES = [
  "strength",
  "role-of-element",
  "twelve-qi-texture",
  "conflict-context",
  "timing",
  "useful-god-master-key-readiness",
] as const;

export type BaziSharedPacketFamily = (typeof BAZI_SHARED_PACKET_FAMILIES)[number];

export const BaziSharedPacketFamilySchema = z.enum(BAZI_SHARED_PACKET_FAMILIES);

export const BaziSharedPacketSectionProvenanceSchema = z.enum([
  "computed_fact_state",
  "source1_contract",
  "compiled_table",
  "overlay_readiness",
]);

export type BaziSharedPacketSectionProvenance = z.infer<
  typeof BaziSharedPacketSectionProvenanceSchema
>;

const Source1ContractFieldIdSchema = z.enum(SOURCE1_CONTRACT_FIELD_IDS);

function createPacketSectionSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    provenance: BaziSharedPacketSectionProvenanceSchema,
    sourceFieldIds: z.array(Source1ContractFieldIdSchema).min(1).max(5),
    value: valueSchema,
  });
}

const SharedPacketIdentityPillarSchema = PillarValueSchema.pick({
  stem: true,
  branch: true,
  hiddenStems: true,
  tenGod: true,
  sittingStage: true,
  lookingStage: true,
  upperStageDisplay: true,
  lowerStageDisplay: true,
});

const SharedPacketChartIdentitySchema = z.object({
  gender: z.string().trim().min(1),
  dayMaster: z.string().trim().min(1),
  fourPillars: z.object({
    year: SharedPacketIdentityPillarSchema,
    month: SharedPacketIdentityPillarSchema,
    day: SharedPacketIdentityPillarSchema,
    hour: SharedPacketIdentityPillarSchema,
  }),
});

const SharedPacketSelectionSchema = z.object({
  families: z.array(BaziSharedPacketFamilySchema)
    .min(1)
    .max(BAZI_SHARED_PACKET_FAMILIES.length),
  timingLookaheadCount: z.number().int().min(0).max(MAX_TIMING_LOOKAHEAD).default(DEFAULT_TIMING_LOOKAHEAD),
}).superRefine((value, context) => {
  if (new Set(value.families).size !== value.families.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "families must not contain duplicates.",
      path: ["families"],
    });
  }
});

const StrengthProfileValueSchema = z.object({
  dayMaster: z.string().trim().min(1),
  score: z.number().finite(),
  bandId: z.string().trim().min(1),
  semanticId: z.enum(STRENGTH_DOCTRINE_SEMANTIC_IDS),
  sourceState: z.string().trim().min(1),
  lookupState: z.enum(CANONICAL_DAY_MASTER_STRENGTH_STATES),
  repositoryLookupState: z.enum(CANONICAL_DAY_MASTER_STRENGTH_STATES),
  displayLabel: z.string().trim().min(1),
});

const RoleOfElementValueSchema = z.object({
  tenGods: z.record(z.string(), z.string()),
  seasonalInteraction: SeasonalInteractionSchema,
});

const ElementBalanceValueSchema = ElementAnalysisSchema.pick({
  dominantElements: true,
  missingElements: true,
  elementStrengths: true,
});

const TwelveQiTextureValueSchema = z.object({
  raw: z.object({
    yearBranch: z.string().trim().min(1),
    monthBranch: z.string().trim().min(1),
    dayBranch: z.string().trim().min(1),
    hourBranch: z.string().trim().min(1),
    mingGongBranch: z.string().trim().min(1),
    currentDaYunBranch: z.string().trim().min(1).optional(),
    currentLiuNianBranch: z.string().trim().min(1).optional(),
  }),
  display: z.object({
    yearBranch: z.string().trim().min(1),
    monthBranch: z.string().trim().min(1),
    dayBranch: z.string().trim().min(1),
    hourBranch: z.string().trim().min(1),
    mingGongBranch: z.string().trim().min(1),
    currentDaYunBranch: z.string().trim().min(1).optional(),
    currentLiuNianBranch: z.string().trim().min(1).optional(),
  }),
});

const ConflictResolutionValueSchema = z.object({
  activeCombinations: z.array(z.string().trim().min(1)).max(MAX_PRECEDENCE_NOTES),
  neutralizedClashes: z.array(z.string().trim().min(1)).max(MAX_PRECEDENCE_NOTES),
  activeClashes: z.array(z.string().trim().min(1)).max(MAX_PRECEDENCE_NOTES),
  activePunishments: z.array(z.string().trim().min(1)).max(MAX_PRECEDENCE_NOTES),
  activeHarms: z.array(z.string().trim().min(1)).max(MAX_PRECEDENCE_NOTES),
  activeDestructions: z.array(z.string().trim().min(1)).max(MAX_PRECEDENCE_NOTES),
  intraPillarDestructions: z.array(z.string().trim().min(1)).max(4),
  precedenceNotes: z.array(z.string().trim().min(1)).max(MAX_PRECEDENCE_NOTES),
  precedenceSignals: z.array(ContextRuleNoteSchema).max(MAX_PRECEDENCE_NOTES),
});

const InteractionContextItemSchema = z.object({
  relationId: z.string().trim().min(1),
  familyKey: z.string().trim().min(1),
  label: z.string().trim().min(1),
  relationType: z.string().trim().min(1),
  status: z.string().trim().min(1),
  precedence: z.string().trim().min(1).optional(),
  dayMasterEffect: z.string().trim().min(1).optional(),
  blockedByRelationIds: z.array(z.string().trim().min(1)).max(MAX_PRECEDENCE_NOTES),
  pillars: z.array(z.string().trim().min(1)).max(4),
  participants: z.array(InteractionEntitySchema.pick({
    id: true,
    type: true,
    pillarKey: true,
    symbol: true,
    label: true,
  })).min(1).max(4),
});

const TimingCurrentWindowValueSchema = z.object({
  ageSnapshot: AgeSnapshotSchema,
  isForwardDirection: z.boolean(),
  currentDaYun: DaYunPillarSchema.optional(),
  liuNian: SharedPacketIdentityPillarSchema.optional(),
});

const UsefulGodReadinessGatesValueSchema = z.object({
  status: z.literal("ready-for-overlay"),
  readyFieldIds: z.array(Source1ContractFieldIdSchema).length(5),
  pendingOverlayOutputs: z.tuple([
    z.literal("useful-god-judgment"),
    z.literal("master-key-judgment"),
  ]),
});

const UsefulGodReadinessSignalsValueSchema = z.object({
  strengthBandId: z.string().trim().min(1),
  strengthSourceState: z.string().trim().min(1),
  seasonalPhase: z.enum(["early", "peak", "late"]),
  dominantElements: z.array(z.enum(["wood", "fire", "earth", "metal", "water"])).max(5),
  missingElements: z.array(z.enum(["wood", "fire", "earth", "metal", "water"])).max(5),
  activeContextCount: z.number().int().nonnegative(),
  timingAnchors: z.object({
    hasCurrentDaYun: z.boolean(),
    hasLiuNian: z.boolean(),
    monthQi: z.string().trim().min(1),
    currentDaYunQi: z.string().trim().min(1).nullable(),
    currentLiuNianQi: z.string().trim().min(1).nullable(),
  }),
});

export const BaziStrengthSharedPacketSchema = z.object({
  family: z.literal("strength"),
  sections: z.object({
    profile: createPacketSectionSchema(StrengthProfileValueSchema),
    trace: createPacketSectionSchema(CalculationTraceSchema).optional(),
  }),
});

export const BaziRoleOfElementSharedPacketSchema = z.object({
  family: z.literal("role-of-element"),
  sections: z.object({
    roles: createPacketSectionSchema(RoleOfElementValueSchema),
    elementBalance: createPacketSectionSchema(ElementBalanceValueSchema),
  }),
});

export const BaziTwelveQiTextureSharedPacketSchema = z.object({
  family: z.literal("twelve-qi-texture"),
  sections: z.object({
    texture: createPacketSectionSchema(TwelveQiTextureValueSchema),
  }),
});

export const BaziConflictContextSharedPacketSchema = z.object({
  family: z.literal("conflict-context"),
  sections: z.object({
    resolution: createPacketSectionSchema(ConflictResolutionValueSchema),
    contextMap: createPacketSectionSchema(z.array(InteractionContextItemSchema).max(MAX_CONTEXT_ITEMS)),
  }),
});

export const BaziTimingSharedPacketSchema = z.object({
  family: z.literal("timing"),
  sections: z.object({
    currentWindow: createPacketSectionSchema(TimingCurrentWindowValueSchema),
    nextWindows: createPacketSectionSchema(z.array(DaYunPillarSchema).max(MAX_TIMING_LOOKAHEAD)),
  }),
});

export const BaziUsefulGodMasterKeyReadinessPacketSchema = z.object({
  family: z.literal("useful-god-master-key-readiness"),
  sections: z.object({
    gates: createPacketSectionSchema(UsefulGodReadinessGatesValueSchema),
    signals: createPacketSectionSchema(UsefulGodReadinessSignalsValueSchema),
  }),
});

export const BaziSharedPacketSchema = z.discriminatedUnion("family", [
  BaziStrengthSharedPacketSchema,
  BaziRoleOfElementSharedPacketSchema,
  BaziTwelveQiTextureSharedPacketSchema,
  BaziConflictContextSharedPacketSchema,
  BaziTimingSharedPacketSchema,
  BaziUsefulGodMasterKeyReadinessPacketSchema,
]);

export const BaziSharedPacketSpineSchema = z.object({
  chartIdentity: SharedPacketChartIdentitySchema,
  selection: SharedPacketSelectionSchema,
  packets: z.array(BaziSharedPacketSchema).min(1).superRefine((packets, context) => {
    const families = packets.map((packet) => packet.family);

    if (new Set(families).size !== families.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "shared packets must not repeat a family.",
      });
    }
  }),
});

export type BaziSharedPacketSelection = z.infer<typeof SharedPacketSelectionSchema>;
export type BaziSharedPacketSpine = z.infer<typeof BaziSharedPacketSpineSchema>;
export type BaziSharedPacket = z.infer<typeof BaziSharedPacketSchema>;

function createPacketSection<TValue>(
  provenance: BaziSharedPacketSectionProvenance,
  sourceFieldIds: Array<(typeof SOURCE1_CONTRACT_FIELD_IDS)[number]>,
  value: TValue,
) {
  return {
    provenance,
    sourceFieldIds,
    value,
  };
}

function boundList<T>(values: T[], max: number) {
  return values.slice(0, max);
}

function buildInteractionContextMap(factState: BaziOsCoreFactState) {
  const entityMap = new Map(
    factState.interactionState.entities.map((entity) => [entity.id, entity]),
  );
  const relationMap = new Map(
    factState.interactionState.relations.map((relation) => [relation.id, relation]),
  );

  return boundList(
    factState.interactionState.outcomes.flatMap((outcome) => {
      const relation = relationMap.get(outcome.relationId);

      if (!relation) {
        return [];
      }

      const participants = relation.participantEntityIds
        .map((entityId) => entityMap.get(entityId))
        .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity))
        .slice(0, 4)
        .map((entity) => ({
          id: entity.id,
          type: entity.type,
          pillarKey: entity.pillarKey,
          symbol: entity.symbol,
          label: entity.label,
        }));

      if (participants.length === 0) {
        return [];
      }

      return [{
        relationId: relation.id,
        familyKey: relation.familyKey,
        label: relation.label,
        relationType: relation.type,
        status: outcome.status,
        precedence: outcome.precedence,
        dayMasterEffect: outcome.dayMasterEffect,
        blockedByRelationIds: boundList(outcome.blockedByRelationIds, MAX_PRECEDENCE_NOTES),
        pillars: [...new Set(
          participants
            .map((participant) => participant.pillarKey)
            .filter((pillarKey): pillarKey is string => Boolean(pillarKey)),
        )],
        participants,
      }];
    }),
    MAX_CONTEXT_ITEMS,
  );
}

function buildStrengthPacket(factState: BaziOsCoreFactState) {
  const strengthContract = buildSource1StrengthContract(factState.strengthScore);

  return {
    family: "strength",
    sections: {
      profile: createPacketSection(
        "source1_contract",
        ["weighted-strength"],
        {
          dayMaster: factState.dayMaster,
          score: factState.strengthScore,
          bandId: strengthContract.bandId,
          semanticId: strengthContract.semanticId,
          sourceState: strengthContract.sourceState,
          lookupState: strengthContract.lookupState,
          repositoryLookupState: strengthContract.repositoryLookupState,
          displayLabel: strengthContract.displayLabel,
        },
      ),
      ...(factState.traceMetadata.strengthScore
        ? {
            trace: createPacketSection(
              "computed_fact_state",
              ["weighted-strength"],
              factState.traceMetadata.strengthScore,
            ),
          }
        : {}),
    },
  } as const;
}

function buildRoleOfElementPacket(factState: BaziOsCoreFactState) {
  return {
    family: "role-of-element",
    sections: {
      roles: createPacketSection(
        "computed_fact_state",
        ["role-of-element"],
        {
          tenGods: factState.roleOfElementFacts.tenGods,
          seasonalInteraction: factState.roleOfElementFacts.seasonalInteraction,
        },
      ),
      elementBalance: createPacketSection(
        "computed_fact_state",
        ["role-of-element"],
        {
          dominantElements: factState.elementAnalysis.dominantElements,
          missingElements: factState.elementAnalysis.missingElements,
          elementStrengths: factState.elementAnalysis.elementStrengths,
        },
      ),
    },
  } as const;
}

function buildTwelveQiTexturePacket(factState: BaziOsCoreFactState) {
  return {
    family: "twelve-qi-texture",
    sections: {
      texture: createPacketSection(
        "computed_fact_state",
        ["twelve-qi-texture"],
        {
          raw: factState.twelveQi.raw,
          display: factState.twelveQi.display,
        },
      ),
    },
  } as const;
}

function buildConflictContextPacket(factState: BaziOsCoreFactState) {
  return {
    family: "conflict-context",
    sections: {
      resolution: createPacketSection(
        "computed_fact_state",
        ["conflict-context"],
        {
          activeCombinations: boundList(factState.interactionResolution.activeCombinations, MAX_PRECEDENCE_NOTES),
          neutralizedClashes: boundList(factState.interactionResolution.neutralizedClashes, MAX_PRECEDENCE_NOTES),
          activeClashes: boundList(factState.interactionResolution.activeClashes, MAX_PRECEDENCE_NOTES),
          activePunishments: boundList(factState.interactionResolution.activePunishments, MAX_PRECEDENCE_NOTES),
          activeHarms: boundList(factState.interactionResolution.activeHarms, MAX_PRECEDENCE_NOTES),
          activeDestructions: boundList(factState.interactionResolution.activeDestructions, MAX_PRECEDENCE_NOTES),
          intraPillarDestructions: boundList(factState.interactionResolution.intraPillarDestructions, 4),
          precedenceNotes: boundList(factState.interactionResolution.precedenceNotes, MAX_PRECEDENCE_NOTES),
          precedenceSignals: boundList(factState.interactionResolution.precedenceSignals, MAX_PRECEDENCE_NOTES),
        },
      ),
      contextMap: createPacketSection(
        "computed_fact_state",
        ["conflict-context", "twelve-qi-texture"],
        buildInteractionContextMap(factState),
      ),
    },
  } as const;
}

function buildTimingPacket(
  factState: BaziOsCoreFactState,
  selection: BaziSharedPacketSelection,
) {
  const currentIndex = factState.daYun.findIndex((entry) => entry.isCurrent);
  const nextStartIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  const nextWindows = factState.daYun.slice(
    nextStartIndex,
    nextStartIndex + selection.timingLookaheadCount,
  );

  return {
    family: "timing",
    sections: {
      currentWindow: createPacketSection(
        "computed_fact_state",
        ["timing"],
        {
          ageSnapshot: factState.ageSnapshot,
          isForwardDirection: factState.isForwardDirection,
          ...(factState.currentDaYun ? { currentDaYun: factState.currentDaYun } : {}),
          ...(factState.liuNian ? { liuNian: factState.liuNian } : {}),
        },
      ),
      nextWindows: createPacketSection(
        "computed_fact_state",
        ["timing"],
        nextWindows,
      ),
    },
  } as const;
}

function buildUsefulGodMasterKeyReadinessPacket(factState: BaziOsCoreFactState) {
  const strengthContract = buildSource1StrengthContract(factState.strengthScore);

  return {
    family: "useful-god-master-key-readiness",
    sections: {
      gates: createPacketSection(
        "source1_contract",
        [
          "weighted-strength",
          "role-of-element",
          "twelve-qi-texture",
          "conflict-context",
          "timing",
        ],
        {
          status: "ready-for-overlay",
          readyFieldIds: [
            "weighted-strength",
            "role-of-element",
            "twelve-qi-texture",
            "conflict-context",
            "timing",
          ],
          pendingOverlayOutputs: ["useful-god-judgment", "master-key-judgment"],
        },
      ),
      signals: createPacketSection(
        "overlay_readiness",
        [
          "weighted-strength",
          "role-of-element",
          "twelve-qi-texture",
          "conflict-context",
          "timing",
        ],
        {
          strengthBandId: strengthContract.bandId,
          strengthSourceState: strengthContract.sourceState,
          seasonalPhase: factState.roleOfElementFacts.seasonalInteraction.phase,
          dominantElements: factState.elementAnalysis.dominantElements,
          missingElements: factState.elementAnalysis.missingElements,
          activeContextCount: factState.interactionState.outcomes.length,
          timingAnchors: {
            hasCurrentDaYun: Boolean(factState.currentDaYun),
            hasLiuNian: Boolean(factState.liuNian),
            monthQi: factState.twelveQi.display.monthBranch,
            currentDaYunQi: factState.twelveQi.display.currentDaYunBranch ?? null,
            currentLiuNianQi: factState.twelveQi.display.currentLiuNianBranch ?? null,
          },
        },
      ),
    },
  } as const;
}

export function buildBaziSharedPacketSpine(
  factState: BaziOsCoreFactState,
  selection: Pick<BaziSharedPacketSelection, "families"> & Partial<Omit<BaziSharedPacketSelection, "families">>,
): BaziSharedPacketSpine {
  const normalizedSelection = SharedPacketSelectionSchema.parse({
    families: [...new Set(selection.families)],
    timingLookaheadCount: selection.timingLookaheadCount ?? DEFAULT_TIMING_LOOKAHEAD,
  });

  const packets = normalizedSelection.families.map((family) => {
    switch (family) {
      case "strength":
        return buildStrengthPacket(factState);
      case "role-of-element":
        return buildRoleOfElementPacket(factState);
      case "twelve-qi-texture":
        return buildTwelveQiTexturePacket(factState);
      case "conflict-context":
        return buildConflictContextPacket(factState);
      case "timing":
        return buildTimingPacket(factState, normalizedSelection);
      case "useful-god-master-key-readiness":
        return buildUsefulGodMasterKeyReadinessPacket(factState);
      default:
        return family satisfies never;
    }
  });

  return BaziSharedPacketSpineSchema.parse({
    chartIdentity: {
      gender: factState.input.gender,
      dayMaster: factState.dayMaster,
      fourPillars: factState.fourPillars,
    },
    selection: normalizedSelection,
    packets,
  });
}