import { z } from "zod";

import { SOURCE6_CAREER_BUSINESS_STEP_IDS } from "@/lib/bazi/source6-career-business-doctrine";

export const SOURCE6_SURFACE_REUSE_VERDICTS = [
  "not-used",
  "context-only",
  "insufficient-as-primary-owner",
] as const;

export const SOURCE6_KNOWLEDGE_OWNER_KINDS = [
  "source1-packet",
  "typed-doctrine",
  "topic-registry-context",
  "dictionary-context",
  "hybrid-retrieval-context",
] as const;

const Source6CareerBusinessStepIdSchema = z.enum(SOURCE6_CAREER_BUSINESS_STEP_IDS);
const Source6SurfaceReuseVerdictSchema = z.enum(SOURCE6_SURFACE_REUSE_VERDICTS);
const Source6KnowledgeOwnerKindSchema = z.enum(SOURCE6_KNOWLEDGE_OWNER_KINDS);

const Source6DeliverySurfaceContractSchema = z.object({
  topicId: z.literal("suitable_career"),
  annotationDimension: z.literal("career_potential"),
  dictionarySpec: z.literal("careerPotentialDictionary"),
  retrievalRegistryDimension: z.literal("career_potential"),
  contractVerdict: z.literal("source-reference-and-delivery-context-only"),
  allowedContextSteps: z.array(Source6CareerBusinessStepIdSchema).min(1),
  rejectedAssumptions: z.array(z.string().trim().min(1)).min(1),
  note: z.string().trim().min(1),
});

const Source6OwnerSurfaceSchema = z.object({
  ownerKind: Source6KnowledgeOwnerKindSchema,
  ownerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source6CanonicalOwnerGapSchema = z.object({
  tableName: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source6Phase2RuntimeOwnerSchema = z.object({
  ownerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source6StepKnowledgeOwnershipSchema = z.object({
  stepId: Source6CareerBusinessStepIdSchema,
  manualStep: z.number().int().min(1).max(8),
  label: z.string().trim().min(1),
  currentSurfaceReuse: z.object({
    verdict: Source6SurfaceReuseVerdictSchema,
    reusableOutputs: z.array(z.string().trim().min(1)),
    note: z.string().trim().min(1),
  }),
  primaryOwners: z.array(Source6OwnerSurfaceSchema).min(1),
  requiresNewCanonicalOwners: z.array(Source6CanonicalOwnerGapSchema),
  phase2RuntimeOwner: Source6Phase2RuntimeOwnerSchema,
  ownerSeparation: z.array(z.string().trim().min(1)).min(1),
});

export const Source6KnowledgeOwnershipSchema = z.object({
  sourceId: z.literal("source-6"),
  deliverySurfaceContract: Source6DeliverySurfaceContractSchema,
  steps: z.array(Source6StepKnowledgeOwnershipSchema).length(SOURCE6_CAREER_BUSINESS_STEP_IDS.length),
});

export type Source6KnowledgeOwnership = z.infer<typeof Source6KnowledgeOwnershipSchema>;
export type Source6StepKnowledgeOwnership = z.infer<typeof Source6StepKnowledgeOwnershipSchema>;

export function buildSource6KnowledgeOwnership(): Source6KnowledgeOwnership {
  return Source6KnowledgeOwnershipSchema.parse({
    sourceId: "source-6",
    deliverySurfaceContract: {
      topicId: "suitable_career",
      annotationDimension: "career_potential",
      dictionarySpec: "careerPotentialDictionary",
      retrievalRegistryDimension: "career_potential",
      contractVerdict: "source-reference-and-delivery-context-only",
      allowedContextSteps: [
        "step-1-career-element-routing",
        "step-5-career-growth-grouping",
        "step-7-business-nature-and-investment",
      ],
      rejectedAssumptions: [
        "topic registry owns career element routing",
        "hybrid retrieval owns official-star lookup or career 12 cheingsae status logic",
        "dictionary source paths own transition weighting, location inversion, or customer-profile rules",
      ],
      note: "Current topic, dictionary, and hybrid retrieval surfaces point at Source 6 corpus and can support final delivery, but they are not the deterministic owner of Source 6 runtime reasoning.",
    },
    steps: [
      {
        stepId: "step-1-career-element-routing",
        manualStep: 1,
        label: "Career element routing",
        currentSurfaceReuse: {
          verdict: "context-only",
          reusableOutputs: ["career keywords after the element lane is already fixed"],
          note: "career_potential surfaces can contribute examples of occupations, but they cannot choose the recommended element lane.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 weighted-strength + role-of-element anchors",
            note: "Step 1 starts from Source 1 strength semantics and packet roles.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "source6-career-business-doctrine.step1-career-element-routing",
            note: "Typed doctrine freezes the school mapping before Phase 2 runtime facts exist.",
          },
        ],
        requiresNewCanonicalOwners: [],
        phase2RuntimeOwner: {
          ownerKey: "resolveCareerElementLane",
          note: "Phase 2 should implement the deterministic element router on top of Source 1 anchors.",
        },
        ownerSeparation: [
          "Step 1 must stay separate from topic retrieval prose and from useful-god wording",
        ],
      },
      {
        stepId: "step-2-official-star-lookup",
        manualStep: 2,
        label: "Official-star lookup",
        currentSurfaceReuse: {
          verdict: "insufficient-as-primary-owner",
          reusableOutputs: [],
          note: "No current topic or retrieval surface exposes a typed official-star lookup contract for Source 6.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 day-master + role-of-element anchors",
            note: "Official-star lookup is grounded in Source 1 structural truth before Source 6 maps it into school-specific labels.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE6_OFFICIAL_STAR_LOOKUP_POLICY",
            note: "Typed doctrine must freeze the lookup contract before runtime code or prose uses it.",
          },
        ],
        requiresNewCanonicalOwners: [
          {
            tableName: "bazi_source6_official_star_lookup",
            note: "A dedicated canonical lookup table is needed if official-star rules move out of typed doctrine later.",
          },
        ],
        phase2RuntimeOwner: {
          ownerKey: "resolveOfficialStarLane",
          note: "Phase 2 should implement a typed official-star resolver instead of reusing retrieval text.",
        },
        ownerSeparation: [
          "Step 2 must remain distinct from Step 7 wealth-star business rules",
        ],
      },
      {
        stepId: "step-3-career-status-by-official-star-phase",
        manualStep: 3,
        label: "Career status by official-star phase",
        currentSurfaceReuse: {
          verdict: "insufficient-as-primary-owner",
          reusableOutputs: [],
          note: "Current delivery surfaces do not own the Source 6 phase meanings for work status or job role.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 day-master + four-pillars anchors",
            note: "The chart anchors still belong to Source 1 before Source 6 interprets status.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE6_CAREER_STATUS_PHASE_POLICY",
            note: "Typed doctrine owns the meaning of each Source 6 career phase.",
          },
        ],
        requiresNewCanonicalOwners: [
          {
            tableName: "bazi_source6_career_status_phase_rules",
            note: "A dedicated canonical table is needed if career-status meanings later move out of doctrine constants.",
          },
        ],
        phase2RuntimeOwner: {
          ownerKey: "interpretCareerStatusByOfficialStarPhase",
          note: "Phase 2 should keep status interpretation behind its own evaluator.",
        },
        ownerSeparation: [
          "Step 3 must remain distinct from Source 1 twelve-qi texture",
          "Step 3 must remain distinct from Step 4 transition weighting",
        ],
      },
      {
        stepId: "step-4-job-transition-weighted-timing",
        manualStep: 4,
        label: "Job transition weighted timing",
        currentSurfaceReuse: {
          verdict: "not-used",
          reusableOutputs: [],
          note: "Current career delivery surfaces do not model the 60/40 weighting contract for job transitions.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 timing + day-master + month-base anchors",
            note: "Step 4 depends on timing packet truth and explicit month-base anchoring.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE6_JOB_TRANSITION_WEIGHTING_POLICY",
            note: "The 60/40 weighting belongs to typed doctrine until Phase 2 codifies it.",
          },
        ],
        requiresNewCanonicalOwners: [],
        phase2RuntimeOwner: {
          ownerKey: "interpretJobTransitionTiming",
          note: "Phase 2 should implement a weighted transition scorer with explicit provenance.",
        },
        ownerSeparation: [
          "Step 4 weighting must stay separate from Step 5 growth grouping",
        ],
      },
      {
        stepId: "step-5-career-growth-grouping",
        manualStep: 5,
        label: "Career growth grouping",
        currentSurfaceReuse: {
          verdict: "context-only",
          reusableOutputs: ["growth wording after the good/neutral/bad group is already fixed"],
          note: "career_potential surfaces can narrate growth outcomes, but they cannot choose the growth group.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 timing + month-base anchors",
            note: "Growth grouping remains tied to timing truth and work-base anchors.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE6_CAREER_GROWTH_GROUP_POLICY",
            note: "Typed doctrine classifies which phase groups are good, neutral, or bad.",
          },
        ],
        requiresNewCanonicalOwners: [],
        phase2RuntimeOwner: {
          ownerKey: "classifyCareerGrowthGroup",
          note: "Phase 2 should keep grouped forecast logic separate from prose surfaces.",
        },
        ownerSeparation: [
          "Step 5 must remain distinct from Step 4 weighted transition output",
        ],
      },
      {
        stepId: "step-6-work-location-domestic-vs-international",
        manualStep: 6,
        label: "Work location domestic vs international",
        currentSurfaceReuse: {
          verdict: "not-used",
          reusableOutputs: [],
          note: "Current Source 6 delivery surfaces do not own output-vs-location comparison or inversion logic.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 role-of-element + four-pillars + conflict-context packets",
            note: "Location logic is built entirely from existing Source 1 packets and anchors.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE6_WORK_LOCATION_POLICY",
            note: "Typed doctrine owns the domestic-vs-international comparison and inversion boundary.",
          },
        ],
        requiresNewCanonicalOwners: [],
        phase2RuntimeOwner: {
          ownerKey: "evaluateWorkLocationPreference",
          note: "Phase 2 should map location preference from output lane plus conflict inversion.",
        },
        ownerSeparation: [
          "Step 6 must remain distinct from Step 7 wealth-star business logic",
          "Step 6 must remain distinct from Step 8 year-pillar customer analysis",
        ],
      },
      {
        stepId: "step-7-business-nature-and-investment",
        manualStep: 7,
        label: "Business nature and investment",
        currentSurfaceReuse: {
          verdict: "context-only",
          reusableOutputs: ["industry keywords after wealth-lane result A/B has already been resolved"],
          note: "delivery surfaces can provide examples of businesses or investments, but they do not own the wealth/output coupling logic.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 weighted-strength + role-of-element + month-base anchors",
            note: "Business nature still begins from Source 1 strength and role packets before Source 6 blends meanings.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE6_BUSINESS_NATURE_POLICY",
            note: "Typed doctrine owns the A/B blend for wealth-based business nature and the output-based investment coupling.",
          },
        ],
        requiresNewCanonicalOwners: [
          {
            tableName: "bazi_source6_wealth_business_rules",
            note: "Business-nature meanings may later move into a dedicated wealth-lane rule table.",
          },
          {
            tableName: "bazi_source6_output_investment_rules",
            note: "Investment hints need their own canonical table if the current typed doctrine is normalized.",
          },
        ],
        phase2RuntimeOwner: {
          ownerKey: "interpretBusinessNatureAndInvestment",
          note: "Phase 2 should keep wealth/output coupling explicit and typed.",
        },
        ownerSeparation: [
          "Step 7 must remain distinct from Step 2 official-star lookup",
          "Step 7 must remain distinct from Step 6 output-based location logic even when both reuse role-of-element packets",
        ],
      },
      {
        stepId: "step-8-customer-analysis",
        manualStep: 8,
        label: "Customer analysis",
        currentSurfaceReuse: {
          verdict: "not-used",
          reusableOutputs: [],
          note: "Current topic and retrieval surfaces do not own the year-pillar customer lane of Source 6.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 year-pillar anchors + conflict-context packet",
            note: "Customer analysis depends on the structural year pillar and its interaction context.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE6_CUSTOMER_PROFILE_POLICY",
            note: "Typed doctrine owns the meanings of Source 6 customer groups.",
          },
        ],
        requiresNewCanonicalOwners: [
          {
            tableName: "bazi_source6_customer_phase_rules",
            note: "A dedicated canonical owner is needed if customer-profile meanings move out of typed doctrine later.",
          },
        ],
        phase2RuntimeOwner: {
          ownerKey: "interpretCustomerProfile",
          note: "Phase 2 should implement the year-pillar customer evaluator separately from suitable-career delivery.",
        },
        ownerSeparation: [
          "Step 8 must remain distinct from Step 7 month-base business reasoning",
        ],
      },
    ],
  });
}

export function getSource6KnowledgeOwnershipForStep(
  stepId: typeof SOURCE6_CAREER_BUSINESS_STEP_IDS[number],
): Source6StepKnowledgeOwnership {
  return buildSource6KnowledgeOwnership().steps.find((step) => step.stepId === stepId) ?? (() => {
    throw new Error(`Unknown Source 6 step: ${stepId}`);
  })();
}