import { z } from "zod";

import { SOURCE4_WEALTH_INVESTMENT_STEP_IDS } from "@/lib/bazi/source4-wealth-investment-doctrine";

export const SOURCE4_SURFACE_REUSE_VERDICTS = [
  "not-used",
  "context-only",
  "insufficient-as-primary-owner",
] as const;

export const SOURCE4_KNOWLEDGE_OWNER_KINDS = [
  "source1-packet",
  "typed-doctrine",
  "topic-registry-context",
  "dictionary-context",
  "hybrid-retrieval-context",
] as const;

export const SOURCE4_CROSS_SOURCE_QUALITY_IDS = ["source-2", "source-5", "source-6"] as const;

const Source4WealthInvestmentStepIdSchema = z.enum(SOURCE4_WEALTH_INVESTMENT_STEP_IDS);
const Source4SurfaceReuseVerdictSchema = z.enum(SOURCE4_SURFACE_REUSE_VERDICTS);
const Source4KnowledgeOwnerKindSchema = z.enum(SOURCE4_KNOWLEDGE_OWNER_KINDS);
const Source4CrossSourceQualityIdSchema = z.enum(SOURCE4_CROSS_SOURCE_QUALITY_IDS);

const Source4DeliverySurfaceContractSchema = z.object({
  topicId: z.literal("wealth_luck"),
  annotationDimension: z.literal("wealth_and_investment"),
  dictionarySpec: z.literal("wealthAndInvestmentDictionary"),
  retrievalRegistryDimension: z.literal("wealth_and_investment"),
  contractVerdict: z.literal("source-reference-and-delivery-context-only"),
  allowedContextSteps: z.array(Source4WealthInvestmentStepIdSchema).min(1),
  rejectedAssumptions: z.array(z.string().trim().min(1)).min(1),
  note: z.string().trim().min(1),
});

const Source4OwnerSurfaceSchema = z.object({
  ownerKind: Source4KnowledgeOwnerKindSchema,
  ownerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source4CanonicalOwnerGapSchema = z.object({
  tableName: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source4Phase2RuntimeOwnerSchema = z.object({
  ownerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source4CrossSourceQualityContractSchema = z.object({
  sourceId: Source4CrossSourceQualityIdSchema,
  allowedRole: z.enum(["not-used", "context-only", "delivery-flavor-only"]),
  mustPreserve: z.array(z.string().trim().min(1)).min(1),
  forbiddenDrift: z.array(z.string().trim().min(1)).min(1),
  note: z.string().trim().min(1),
});

const Source4StepKnowledgeOwnershipSchema = z.object({
  stepId: Source4WealthInvestmentStepIdSchema,
  manualStep: z.number().int().min(1).max(6),
  label: z.string().trim().min(1),
  currentSurfaceReuse: z.object({
    verdict: Source4SurfaceReuseVerdictSchema,
    reusableOutputs: z.array(z.string().trim().min(1)),
    note: z.string().trim().min(1),
  }),
  primaryOwners: z.array(Source4OwnerSurfaceSchema).min(1),
  requiresNewCanonicalOwners: z.array(Source4CanonicalOwnerGapSchema),
  phase2RuntimeOwner: Source4Phase2RuntimeOwnerSchema,
  ownerSeparation: z.array(z.string().trim().min(1)).min(1),
});

export const Source4KnowledgeOwnershipSchema = z.object({
  sourceId: z.literal("source-4"),
  deliverySurfaceContract: Source4DeliverySurfaceContractSchema,
  crossSourceQualityContract: z.array(Source4CrossSourceQualityContractSchema).length(SOURCE4_CROSS_SOURCE_QUALITY_IDS.length),
  steps: z.array(Source4StepKnowledgeOwnershipSchema).length(SOURCE4_WEALTH_INVESTMENT_STEP_IDS.length),
});

export type Source4KnowledgeOwnership = z.infer<typeof Source4KnowledgeOwnershipSchema>;
export type Source4StepKnowledgeOwnership = z.infer<typeof Source4StepKnowledgeOwnershipSchema>;

export function buildSource4KnowledgeOwnership(): Source4KnowledgeOwnership {
  return Source4KnowledgeOwnershipSchema.parse({
    sourceId: "source-4",
    deliverySurfaceContract: {
      topicId: "wealth_luck",
      annotationDimension: "wealth_and_investment",
      dictionarySpec: "wealthAndInvestmentDictionary",
      retrievalRegistryDimension: "wealth_and_investment",
      contractVerdict: "source-reference-and-delivery-context-only",
      allowedContextSteps: [
        "step-1-wealth-capacity-routing",
        "step-3-money-source-storage-and-leakage",
        "step-4-spending-and-investment-behavior",
        "step-6-wealth-timing-and-risk-window",
      ],
      rejectedAssumptions: [
        "topic registry owns wealth element, storage, or destroyer lookup",
        "dictionary source paths own money-source, storage, or leakage rules",
        "career or relationship delivery surfaces can become the primary owner of wealth-risk meaning",
      ],
      note: "Current wealth topic, dictionary, and hybrid retrieval surfaces can support final delivery after Source 4 truth is resolved, but they do not own the deterministic money lane during the doctrine and ownership freeze.",
    },
    crossSourceQualityContract: [
      {
        sourceId: "source-2",
        allowedRole: "delivery-flavor-only",
        mustPreserve: [
          "60 Jiazi and persona prose stays downstream of Source 4 capacity, storage, and timing truth",
          "Source 2 cannot rename wealth-capacity bands or wealth timing windows",
        ],
        forbiddenDrift: [
          "personality wording overriding money-risk meaning",
          "routing narrative becoming the owner of wealth interpretation",
        ],
        note: "Source 2 may color the final answer tone later, but it cannot own any Source 4 money decision.",
      },
      {
        sourceId: "source-5",
        allowedRole: "context-only",
        mustPreserve: [
          "relationship output may comment on partner money only after Source 4 resolves the base money lane",
          "Source 5 cannot own wealth storage, leakage, or non-partner income source meaning",
        ],
        forbiddenDrift: [
          "romance narrative swallowing wealth answers",
          "partner dynamics becoming the default explanation for money leakage",
        ],
        note: "Source 5 remains a neighboring lane and only participates when the ask explicitly ties money to relationship dynamics.",
      },
      {
        sourceId: "source-6",
        allowedRole: "context-only",
        mustPreserve: [
          "work and business fit stays separate from wealth accumulation, storage, leakage, and timing",
          "Source 6 may supply operational context only when the money question explicitly involves business execution",
        ],
        forbiddenDrift: [
          "career-business wording overriding output-investment behavior",
          "job-switch timing replacing wealth timing risk windows",
        ],
        note: "Source 6 may remain adjacent to Source 4 for business asks, but it cannot absorb the primary money lane.",
      },
    ],
    steps: [
      {
        stepId: "step-1-wealth-capacity-routing",
        manualStep: 1,
        label: "Wealth capacity routing",
        currentSurfaceReuse: {
          verdict: "context-only",
          reusableOutputs: ["final money-capacity wording after the capacity band is fixed"],
          note: "wealth delivery surfaces can narrate capacity after the deterministic band is chosen, but they cannot choose the band.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 weighted-strength + role-of-element anchors",
            note: "Source 4 still starts from Source 1 strength truth before talking about money.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "source4-wealth-investment-doctrine.step1-wealth-capacity-routing",
            note: "Typed doctrine freezes the money-capacity interpretation boundary before runtime facts exist.",
          },
        ],
        requiresNewCanonicalOwners: [],
        phase2RuntimeOwner: {
          ownerKey: "resolveWealthCapacityBand",
          note: "Phase 2 should implement the deterministic wealth-capacity classifier.",
        },
        ownerSeparation: [
          "Step 1 must remain distinct from Source 2 persona tone and Source 6 work-fit narrative",
        ],
      },
      {
        stepId: "step-2-wealth-element-storage-destroyer-lookup",
        manualStep: 2,
        label: "Wealth element, storage, and destroyer lookup",
        currentSurfaceReuse: {
          verdict: "insufficient-as-primary-owner",
          reusableOutputs: [],
          note: "No current topic or retrieval surface exposes a typed wealth/storage/destroyer lookup contract for Source 4.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 role-of-element anchors",
            note: "Structural wealth labels still begin from Source 1 shared packets.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE4_WEALTH_STORAGE_LOOKUP_POLICY",
            note: "Typed doctrine must freeze the lookup tables before runtime code or prose uses them.",
          },
        ],
        requiresNewCanonicalOwners: [
          {
            tableName: "bazi_source4_wealth_storage_lookup",
            note: "A canonical lookup table is needed if wealth storage and destroyer rules later move out of typed doctrine.",
          },
        ],
        phase2RuntimeOwner: {
          ownerKey: "resolveWealthElementAndStorageLookup",
          note: "Phase 2 should implement a dedicated wealth/storage resolver instead of relying on retrieval text.",
        },
        ownerSeparation: [
          "Step 2 must remain distinct from Step 4 output-investment behavior",
          "Step 2 must remain distinct from Source 6 business-investment wording",
        ],
      },
      {
        stepId: "step-3-money-source-storage-and-leakage",
        manualStep: 3,
        label: "Money source, storage, and leakage",
        currentSurfaceReuse: {
          verdict: "context-only",
          reusableOutputs: ["source-of-money wording after storage and leakage truth is fixed"],
          note: "wealth delivery surfaces can narrate money source after Source 4 has already resolved the storage and leakage lane.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 role-of-element + timing anchors",
            note: "Money source and leakage still stand on Source 1 structural packets before Source 4 interprets them.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE4_WEALTH_SOURCE_AND_LEAKAGE_POLICY",
            note: "Typed doctrine owns how storage pressure becomes money-source and leakage meaning.",
          },
        ],
        requiresNewCanonicalOwners: [
          {
            tableName: "bazi_source4_wealth_source_rules",
            note: "A dedicated canonical table is needed if money-source mappings are normalized later.",
          },
          {
            tableName: "bazi_source4_wealth_leakage_rules",
            note: "Leakage severity needs its own canonical surface if it moves beyond typed doctrine constants.",
          },
        ],
        phase2RuntimeOwner: {
          ownerKey: "interpretWealthStorageAndLeakage",
          note: "Phase 2 should implement a typed interpreter for money source, storage, and leakage.",
        },
        ownerSeparation: [
          "Step 3 must remain distinct from Source 5 partner-money dynamics unless the ask is explicitly joint",
          "Step 3 must remain distinct from Source 6 work-income narrative by default",
        ],
      },
      {
        stepId: "step-4-spending-and-investment-behavior",
        manualStep: 4,
        label: "Spending and investment behavior",
        currentSurfaceReuse: {
          verdict: "context-only",
          reusableOutputs: ["behavior examples after the spending or investment lane is fixed"],
          note: "wealth delivery surfaces may provide examples after Source 4 decides the spending and investment posture.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 role-of-element + timing anchors",
            note: "The behavior lane still begins from structural output and timing truth already preserved in shared packets.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE4_OUTPUT_INVESTMENT_BEHAVIOR_POLICY",
            note: "Typed doctrine owns the interpretation boundary for spending and investment behavior.",
          },
        ],
        requiresNewCanonicalOwners: [
          {
            tableName: "bazi_source4_output_investment_profiles",
            note: "A dedicated profile table is needed if spending and investment behavior are normalized later.",
          },
        ],
        phase2RuntimeOwner: {
          ownerKey: "interpretSpendingAndInvestmentBehavior",
          note: "Phase 2 should keep money behavior separate from work-fit or partner narrative.",
        },
        ownerSeparation: [
          "Step 4 must remain distinct from Source 6 operational business fit even when both mention investment",
          "Step 4 must remain distinct from Step 6 timing risk windows",
        ],
      },
      {
        stepId: "step-5-wealth-solution-lane",
        manualStep: 5,
        label: "Wealth solution lane",
        currentSurfaceReuse: {
          verdict: "not-used",
          reusableOutputs: [],
          note: "Current wealth delivery surfaces do not own the bounded wealth-solution lane during the doctrine-freeze phase.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 weighted-strength + role-of-element anchors",
            note: "Wealth solutions still depend on Source 1 balance truth before Source 4 can advise anything.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE4_WEALTH_SOLUTION_POLICY",
            note: "Typed doctrine constrains Source 4 advice so it does not drift into Source 7 remedy logic.",
          },
        ],
        requiresNewCanonicalOwners: [],
        phase2RuntimeOwner: {
          ownerKey: "resolveWealthSolutionLane",
          note: "Phase 2 should keep wealth-solution guidance explicitly bounded and typed.",
        },
        ownerSeparation: [
          "Step 5 must remain distinct from Source 7 remedy and fortune-enhancement logic",
        ],
      },
      {
        stepId: "step-6-wealth-timing-and-risk-window",
        manualStep: 6,
        label: "Wealth timing and risk window",
        currentSurfaceReuse: {
          verdict: "context-only",
          reusableOutputs: ["timing wording after the wealth window and risk boundary are fixed"],
          note: "wealth delivery surfaces can phrase the money window, but they cannot choose or widen the risk window themselves.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 weighted-strength + role-of-element + timing anchors",
            note: "Timing windows stay anchored in Source 1 shared packets plus wealth capacity truth.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE4_WEALTH_TIMING_WINDOW_POLICY",
            note: "Typed doctrine owns the boundary for timing-safe wealth interpretation.",
          },
        ],
        requiresNewCanonicalOwners: [
          {
            tableName: "bazi_source4_timing_risk_rules",
            note: "A dedicated canonical table is needed if wealth timing and risk rules later move out of typed doctrine.",
          },
        ],
        phase2RuntimeOwner: {
          ownerKey: "interpretWealthTimingWindow",
          note: "Phase 2 should implement a bounded wealth timing interpreter.",
        },
        ownerSeparation: [
          "Step 6 must remain distinct from Source 7 lucky-period promises",
          "Step 6 must remain distinct from Source 6 job-switch timing even when the ask mentions business",
        ],
      },
    ],
  });
}

export function getSource4KnowledgeOwnershipForStep(
  stepId: typeof SOURCE4_WEALTH_INVESTMENT_STEP_IDS[number],
): Source4StepKnowledgeOwnership {
  return buildSource4KnowledgeOwnership().steps.find((step) => step.stepId === stepId) ?? (() => {
    throw new Error(`Unknown Source 4 step: ${stepId}`);
  })();
}