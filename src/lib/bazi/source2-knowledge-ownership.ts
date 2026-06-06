import { z } from "zod";

export type Source2KnowledgeLane = "routing" | "refinement" | "evidence";

export type Source2KnowledgeOwnerTable =
  | "bazi_day_master_strength_states"
  | "bazi_sixty_jiazi_narratives"
  | "typed-constant";

export type Source2KnowledgeStatus =
  | "authored"
  | "shared-granularity"
  | "classified-gap";

export type Source2KnowledgeGapCode =
  | "missing-routing-narrative"
  | "missing-day-pillar-advice"
  | "no-standalone-twelve-qi-advice"
  | "missing-shared-twelve-qi-advice";

export type Source2KnowledgeOwnership = {
  lane: Source2KnowledgeLane;
  ownerTable: Source2KnowledgeOwnerTable;
  ownerField: string;
  status: Source2KnowledgeStatus;
  note: string;
  sourcePath?: string | null;
  rowLocator?: number | null;
  gapCode?: Source2KnowledgeGapCode;
  fallbackOwnerTable?: Source2KnowledgeOwnerTable;
  fallbackOwnerField?: string;
};

export type Source2AdviceInput = {
  text: string | null;
  ownership: Source2KnowledgeOwnership;
};

export type Source2KnowledgeMetadata = {
  routingNarrative?: Source2KnowledgeOwnership;
  dayPillarAdvice?: Source2KnowledgeOwnership;
  twelveQiAdvice?: Source2KnowledgeOwnership;
};

export const Source2KnowledgeLaneSchema = z.enum([
  "routing",
  "refinement",
  "evidence",
]);

export const Source2KnowledgeOwnerTableSchema = z.enum([
  "bazi_day_master_strength_states",
  "bazi_sixty_jiazi_narratives",
  "typed-constant",
]);

export const Source2KnowledgeStatusSchema = z.enum([
  "authored",
  "shared-granularity",
  "classified-gap",
]);

export const Source2KnowledgeGapCodeSchema = z.enum([
  "missing-routing-narrative",
  "missing-day-pillar-advice",
  "no-standalone-twelve-qi-advice",
  "missing-shared-twelve-qi-advice",
]);

export const Source2KnowledgeOwnershipSchema = z.object({
  lane: Source2KnowledgeLaneSchema,
  ownerTable: Source2KnowledgeOwnerTableSchema,
  ownerField: z.string().trim().min(1),
  status: Source2KnowledgeStatusSchema,
  note: z.string().trim().min(1),
  sourcePath: z.string().trim().min(1).nullable().optional(),
  rowLocator: z.number().int().nonnegative().nullable().optional(),
  gapCode: Source2KnowledgeGapCodeSchema.optional(),
  fallbackOwnerTable: Source2KnowledgeOwnerTableSchema.optional(),
  fallbackOwnerField: z.string().trim().min(1).optional(),
});

export const Source2AdviceInputSchema = z.object({
  text: z.string().trim().min(1).nullable(),
  ownership: Source2KnowledgeOwnershipSchema,
});

export const SOURCE2_TWELVE_QI_ADVICE_POLICY = {
  lane: "evidence",
  ownerTable: "typed-constant",
  ownerField: "SOURCE2_TWELVE_QI_ADVICE_POLICY",
  status: "shared-granularity",
  gapCode: "no-standalone-twelve-qi-advice",
  fallbackOwnerTable: "bazi_sixty_jiazi_narratives",
  fallbackOwnerField: "combined_narrative",
  note: "Source 2 has no standalone authored 12 Qi advice lane; keep twelveQiLabel as evidence and reuse the combined day-pillar narrative only as shared advice when it exists.",
} as const satisfies Source2KnowledgeOwnership;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceOwnership(value: unknown): Source2KnowledgeOwnership | null {
  if (!isRecord(value)) {
    return null;
  }

  const lane = value.lane;
  const ownerTable = value.ownerTable;
  const ownerField = value.ownerField;
  const status = value.status;
  const note = value.note;

  if (
    typeof lane !== "string"
    || typeof ownerTable !== "string"
    || typeof ownerField !== "string"
    || typeof status !== "string"
    || typeof note !== "string"
  ) {
    return null;
  }

  return {
    lane: lane as Source2KnowledgeLane,
    ownerTable: ownerTable as Source2KnowledgeOwnerTable,
    ownerField,
    status: status as Source2KnowledgeStatus,
    note,
    sourcePath: typeof value.sourcePath === "string" ? value.sourcePath : null,
    rowLocator: typeof value.rowLocator === "number" ? value.rowLocator : null,
    gapCode: typeof value.gapCode === "string" ? value.gapCode as Source2KnowledgeGapCode : undefined,
    fallbackOwnerTable: typeof value.fallbackOwnerTable === "string"
      ? value.fallbackOwnerTable as Source2KnowledgeOwnerTable
      : undefined,
    fallbackOwnerField: typeof value.fallbackOwnerField === "string"
      ? value.fallbackOwnerField
      : undefined,
  };
}

function readOwnership(metadata: unknown, key: keyof Source2KnowledgeMetadata) {
  if (!isRecord(metadata)) {
    return null;
  }

  const source2Knowledge = metadata.source2Knowledge;

  if (!isRecord(source2Knowledge)) {
    return null;
  }

  return coerceOwnership(source2Knowledge[key]);
}

export function buildDayMasterStrengthSource2Metadata(params: {
  sourcePath: string;
  rowOrder: number;
  narrativeSummary: string | null;
}): Source2KnowledgeMetadata {
  return {
    routingNarrative: params.narrativeSummary
      ? {
          lane: "routing",
          ownerTable: "bazi_day_master_strength_states",
          ownerField: "narrative_summary",
          status: "authored",
          note: "Routing narrative is authored in the strength-state corpus and is the deterministic Source 2 owner for Day Master x Strength.",
          sourcePath: params.sourcePath,
          rowLocator: params.rowOrder,
        }
      : {
          lane: "routing",
          ownerTable: "bazi_day_master_strength_states",
          ownerField: "narrative_summary",
          status: "classified-gap",
          note: "The strength-state row exists but has no authored narrative_summary, so Source 2 routing text must fail clearly instead of being inferred in prompt space.",
          sourcePath: params.sourcePath,
          rowLocator: params.rowOrder,
          gapCode: "missing-routing-narrative",
        },
  };
}

export function buildSixtyJiaziSource2Metadata(params: {
  sourcePath: string;
  rowGroup: number;
  combinedNarrative: string | null;
}): Source2KnowledgeMetadata {
  return {
    dayPillarAdvice: params.combinedNarrative
      ? {
          lane: "refinement",
          ownerTable: "bazi_sixty_jiazi_narratives",
          ownerField: "combined_narrative",
          status: "authored",
          note: "The combined 60 Jiazi narrative is the authored Source 2 owner for day-pillar refinement advice.",
          sourcePath: params.sourcePath,
          rowLocator: params.rowGroup,
        }
      : {
          lane: "refinement",
          ownerTable: "bazi_sixty_jiazi_narratives",
          ownerField: "combined_narrative",
          status: "classified-gap",
          note: "The 60 Jiazi row exists but has no authored combined_narrative, so day-pillar advice must remain empty and traceable.",
          sourcePath: params.sourcePath,
          rowLocator: params.rowGroup,
          gapCode: "missing-day-pillar-advice",
        },
    twelveQiAdvice: params.combinedNarrative
      ? {
          ...SOURCE2_TWELVE_QI_ADVICE_POLICY,
          sourcePath: params.sourcePath,
          rowLocator: params.rowGroup,
        }
      : {
          lane: "evidence",
          ownerTable: "typed-constant",
          ownerField: "SOURCE2_TWELVE_QI_ADVICE_POLICY",
          status: "classified-gap",
          note: "There is no standalone Source 2 12 Qi advice row and no shared combined narrative to reuse, so 12 Qi advice stays empty with an explicit evidence-gap classification.",
          sourcePath: params.sourcePath,
          rowLocator: params.rowGroup,
          gapCode: "missing-shared-twelve-qi-advice",
          fallbackOwnerTable: "bazi_sixty_jiazi_narratives",
          fallbackOwnerField: "combined_narrative",
        },
  };
}

export function buildSource2RoutingNarrativeInput(params: {
  sourcePath: string | null | undefined;
  rowOrder: number | null | undefined;
  narrative: string | null;
  metadata?: unknown;
}): Source2AdviceInput {
  const hasNarrative = typeof params.narrative === "string" && params.narrative.trim().length > 0;
  const fallbackOwnership = buildDayMasterStrengthSource2Metadata({
    sourcePath: params.sourcePath ?? "unknown",
    rowOrder: params.rowOrder ?? 0,
    narrativeSummary: params.narrative,
  }).routingNarrative!;
  const ownership = hasNarrative
    ? (readOwnership(params.metadata, "routingNarrative") ?? fallbackOwnership)
    : fallbackOwnership;

  return {
    text: ownership.status === "classified-gap" ? null : params.narrative,
    ownership,
  };
}

export function buildSource2DayPillarAdviceInput(params: {
  sourcePath: string | null | undefined;
  rowGroup: number | null | undefined;
  combinedNarrative: string | null;
  metadata?: unknown;
}): Source2AdviceInput {
  const hasCombinedNarrative = typeof params.combinedNarrative === "string"
    && params.combinedNarrative.trim().length > 0;
  const fallbackOwnership = buildSixtyJiaziSource2Metadata({
    sourcePath: params.sourcePath ?? "unknown",
    rowGroup: params.rowGroup ?? 0,
    combinedNarrative: params.combinedNarrative,
  }).dayPillarAdvice!;
  const ownership = hasCombinedNarrative
    ? (readOwnership(params.metadata, "dayPillarAdvice") ?? fallbackOwnership)
    : fallbackOwnership;

  return {
    text: ownership.status === "classified-gap" ? null : params.combinedNarrative,
    ownership,
  };
}

export function buildSource2TwelveQiAdviceInput(params: {
  sourcePath: string | null | undefined;
  rowGroup: number | null | undefined;
  combinedNarrative: string | null;
  metadata?: unknown;
}): Source2AdviceInput {
  const hasCombinedNarrative = typeof params.combinedNarrative === "string"
    && params.combinedNarrative.trim().length > 0;
  const fallbackOwnership = buildSixtyJiaziSource2Metadata({
    sourcePath: params.sourcePath ?? "unknown",
    rowGroup: params.rowGroup ?? 0,
    combinedNarrative: params.combinedNarrative,
  }).twelveQiAdvice!;
  const ownership = hasCombinedNarrative
    ? (readOwnership(params.metadata, "twelveQiAdvice") ?? fallbackOwnership)
    : fallbackOwnership;

  return {
    text: ownership.status === "classified-gap" ? null : params.combinedNarrative,
    ownership,
  };
}