import { z } from "zod";

import { SOURCE3_HEALTH_STEP_IDS } from "@/lib/bazi/source3-health-doctrine";

export const SOURCE3_SURFACE_REUSE_VERDICTS = [
  "not-used",
  "context-only",
  "insufficient-as-primary-owner",
] as const;

export const SOURCE3_KNOWLEDGE_OWNER_KINDS = [
  "source1-packet",
  "typed-doctrine",
  "topic-registry-context",
  "dictionary-context",
  "hybrid-retrieval-context",
] as const;

export const SOURCE3_CROSS_SOURCE_QUALITY_IDS = ["source-2", "source-4", "source-7"] as const;

const Source3HealthStepIdSchema = z.enum(SOURCE3_HEALTH_STEP_IDS);
const Source3SurfaceReuseVerdictSchema = z.enum(SOURCE3_SURFACE_REUSE_VERDICTS);
const Source3KnowledgeOwnerKindSchema = z.enum(SOURCE3_KNOWLEDGE_OWNER_KINDS);
const Source3CrossSourceQualityIdSchema = z.enum(SOURCE3_CROSS_SOURCE_QUALITY_IDS);

const Source3DeliverySurfaceContractSchema = z.object({
  topicId: z.literal("health_risks"),
  annotationDimension: z.literal("health_overview"),
  dictionarySpec: z.literal("healthOverviewDictionary"),
  retrievalRegistryDimension: z.literal("health_overview"),
  contractVerdict: z.literal("source-reference-and-delivery-context-only"),
  allowedContextSteps: z.array(Source3HealthStepIdSchema).min(1),
  rejectedAssumptions: z.array(z.string().trim().min(1)).min(1),
  note: z.string().trim().min(1),
});

const Source3OwnerSurfaceSchema = z.object({
  ownerKind: Source3KnowledgeOwnerKindSchema,
  ownerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source3CanonicalOwnerGapSchema = z.object({
  tableName: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source3Phase2RuntimeOwnerSchema = z.object({
  ownerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source3CrossSourceQualityContractSchema = z.object({
  sourceId: Source3CrossSourceQualityIdSchema,
  allowedRole: z.enum(["not-used", "context-only", "delivery-flavor-only"]),
  mustPreserve: z.array(z.string().trim().min(1)).min(1),
  forbiddenDrift: z.array(z.string().trim().min(1)).min(1),
  note: z.string().trim().min(1),
});

const Source3StepKnowledgeOwnershipSchema = z.object({
  stepId: Source3HealthStepIdSchema,
  manualStep: z.number().int().min(1).max(4),
  label: z.string().trim().min(1),
  currentSurfaceReuse: z.object({
    verdict: Source3SurfaceReuseVerdictSchema,
    reusableOutputs: z.array(z.string().trim().min(1)),
    note: z.string().trim().min(1),
  }),
  primaryOwners: z.array(Source3OwnerSurfaceSchema).min(1),
  requiresNewCanonicalOwners: z.array(Source3CanonicalOwnerGapSchema),
  phase2RuntimeOwner: Source3Phase2RuntimeOwnerSchema,
  ownerSeparation: z.array(z.string().trim().min(1)).min(1),
});

export const Source3KnowledgeOwnershipSchema = z.object({
  sourceId: z.literal("source-3"),
  deliverySurfaceContract: Source3DeliverySurfaceContractSchema,
  crossSourceQualityContract: z.array(Source3CrossSourceQualityContractSchema).length(
    SOURCE3_CROSS_SOURCE_QUALITY_IDS.length,
  ),
  steps: z.array(Source3StepKnowledgeOwnershipSchema).length(SOURCE3_HEALTH_STEP_IDS.length),
});

export type Source3KnowledgeOwnership = z.infer<typeof Source3KnowledgeOwnershipSchema>;
export type Source3StepKnowledgeOwnership = z.infer<typeof Source3StepKnowledgeOwnershipSchema>;

export function buildSource3KnowledgeOwnership(): Source3KnowledgeOwnership {
  return Source3KnowledgeOwnershipSchema.parse({
    sourceId: "source-3",
    deliverySurfaceContract: {
      topicId: "health_risks",
      annotationDimension: "health_overview",
      dictionarySpec: "healthOverviewDictionary",
      retrievalRegistryDimension: "health_overview",
      contractVerdict: "source-reference-and-delivery-context-only",
      allowedContextSteps: [
        "step-1-weak-element-routing",
        "step-4-bounded-caution-framing",
      ],
      rejectedAssumptions: [
        "topic registry owns weak-element routing or organ-risk selection",
        "dictionary source paths own organ-risk or conflict-injury rules",
        "hybrid retrieval may widen health caution into diagnosis, treatment, or Source 7 remedy guidance",
      ],
      note: "Current health topic, dictionary, and hybrid retrieval surfaces can support final delivery after Source 3 truth is resolved, but they do not own the deterministic health lane during the doctrine and ownership freeze.",
    },
    crossSourceQualityContract: [
      {
        sourceId: "source-2",
        allowedRole: "delivery-flavor-only",
        mustPreserve: [
          "60 Jiazi and persona prose stays downstream of Source 3 structural weakness, organ-risk, and caution truth",
          "Source 2 cannot rename baseline health weakness or recovery caution boundaries",
        ],
        forbiddenDrift: [
          "personality wording overriding structural health caution",
          "routing narrative becoming the owner of weakness or organ-risk meaning",
        ],
        note: "Source 2 may color the final answer tone later, but it cannot own any Source 3 health decision.",
      },
      {
        sourceId: "source-4",
        allowedRole: "context-only",
        mustPreserve: [
          "wealth timing and storage remain separate from health weakness and organ-risk interpretation",
          "Source 4 may supply adjacent context only when the ask explicitly mixes money strain with wellbeing",
        ],
        forbiddenDrift: [
          "wealth leakage or timing logic replacing health caution ownership",
          "money-risk language becoming the default explanation for body strain",
        ],
        note: "Source 4 is an upstream neighbor in the sequence, but it cannot absorb the health caution lane.",
      },
      {
        sourceId: "source-7",
        allowedRole: "not-used",
        mustPreserve: [
          "Source 3 stops at bounded caution, watchfulness, and recovery boundary wording",
          "remedy, merit-making, colors, and fortune-enhancement stay outside the Source 3 owner surface",
        ],
        forbiddenDrift: [
          "remedy language replacing health caution",
          "treatment or merit-making advice becoming the default Source 3 closeout",
        ],
        note: "Source 7 remains downstream and must not be smuggled into Source 3 doctrine or delivery.",
      },
    ],
    steps: [
      {
        stepId: "step-1-weak-element-routing",
        manualStep: 1,
        label: "Weak element routing",
        currentSurfaceReuse: {
          verdict: "context-only",
          reusableOutputs: ["baseline weakness wording after the weak element lane is fixed"],
          note: "health delivery surfaces can narrate baseline weakness after Source 3 chooses the weak element lane, but they cannot choose it.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 weighted-strength + role-of-element + twelve-qi-texture anchors",
            note: "Source 3 still starts from Source 1 structural packets before talking about health weakness.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "source3-health-doctrine.step1-weak-element-routing",
            note: "Typed doctrine freezes the weak-element routing boundary before runtime facts exist.",
          },
        ],
        requiresNewCanonicalOwners: [],
        phase2RuntimeOwner: {
          ownerKey: "resolveHealthWeakElementLane",
          note: "Phase 2 should implement the deterministic weak-element classifier.",
        },
        ownerSeparation: [
          "Step 1 must remain distinct from Source 2 persona tone and Source 4 wealth-timing narrative",
        ],
      },
      {
        stepId: "step-2-organ-risk-mapping",
        manualStep: 2,
        label: "Organ risk mapping",
        currentSurfaceReuse: {
          verdict: "insufficient-as-primary-owner",
          reusableOutputs: [],
          note: "No current topic or retrieval surface exposes a typed Source 3 organ-risk mapping contract.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 role-of-element + twelve-qi-texture anchors",
            note: "Structural organ-risk meaning still begins from Source 1 packet truth before Source 3 maps it.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE3_HEALTH_ORGAN_RISK_POLICY",
            note: "Typed doctrine owns how Source 3 turns weak-element truth into organ-risk caution.",
          },
        ],
        requiresNewCanonicalOwners: [
          {
            tableName: "bazi_source3_element_organ_risk_lookup",
            note: "A canonical lookup table is needed if organ-risk mappings later move out of typed doctrine.",
          },
        ],
        phase2RuntimeOwner: {
          ownerKey: "resolveHealthOrganRiskMap",
          note: "Phase 2 should implement a dedicated organ-risk resolver instead of relying on retrieval text.",
        },
        ownerSeparation: [
          "Step 2 must remain distinct from Step 3 conflict-injury escalation",
          "Step 2 must remain distinct from Source 7 remedy or treatment wording",
        ],
      },
      {
        stepId: "step-3-conflict-injury-markers",
        manualStep: 3,
        label: "Conflict injury markers",
        currentSurfaceReuse: {
          verdict: "insufficient-as-primary-owner",
          reusableOutputs: [],
          note: "Current health surfaces do not expose a typed contract for conflict-triggered strain markers.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 conflict-context + twelve-qi-texture anchors",
            note: "Conflict escalation must stay anchored in Source 1 packet truth before Source 3 interprets it.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE3_HEALTH_CONFLICT_INJURY_POLICY",
            note: "Typed doctrine owns how conflict signals become bounded health strain markers.",
          },
        ],
        requiresNewCanonicalOwners: [
          {
            tableName: "bazi_source3_conflict_injury_rules",
            note: "A dedicated canonical table is needed if conflict health markers are normalized later.",
          },
        ],
        phase2RuntimeOwner: {
          ownerKey: "resolveHealthConflictInjuryMarkers",
          note: "Phase 2 should implement typed conflict markers instead of narrative-only escalation.",
        },
        ownerSeparation: [
          "Step 3 must remain distinct from Step 2 organ-risk selection",
          "Step 3 must remain distinct from clinical certainty or emergency claims",
        ],
      },
      {
        stepId: "step-4-bounded-caution-framing",
        manualStep: 4,
        label: "Bounded caution framing",
        currentSurfaceReuse: {
          verdict: "context-only",
          reusableOutputs: ["final health caution wording after structural weakness and conflict markers are fixed"],
          note: "health delivery surfaces may phrase the final caution after Source 3 has already fixed the structural health meaning.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 weighted-strength + role-of-element + conflict-context anchors",
            note: "The final caution lane still stands on Source 1 structural packets before delivery prose exists.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE3_HEALTH_CAUTION_POLICY",
            note: "Typed doctrine constrains Source 3 wording so it stays caution-only.",
          },
        ],
        requiresNewCanonicalOwners: [],
        phase2RuntimeOwner: {
          ownerKey: "interpretBoundedHealthCaution",
          note: "Phase 2 should implement a bounded health caution interpreter.",
        },
        ownerSeparation: [
          "Step 4 must remain distinct from Source 7 remedy and treatment advice",
          "Step 4 must remain distinct from Source 2 tone shaping even when the answer becomes conversational",
        ],
      },
    ],
  });
}

export function getSource3KnowledgeOwnershipForStep(
  stepId: typeof SOURCE3_HEALTH_STEP_IDS[number],
): Source3StepKnowledgeOwnership {
  return buildSource3KnowledgeOwnership().steps.find((step) => step.stepId === stepId) ?? (() => {
    throw new Error(`Unknown Source 3 step: ${stepId}`);
  })();
}