import { z } from "zod";

import { SOURCE5_RELATIONSHIP_STEP_IDS } from "@/lib/bazi/source5-relationship-doctrine";
import type { MatrixDomain } from "@/lib/bazi/symbolic-engine.types";

export const SOURCE5_REPOSITORY_REUSE_VERDICTS = [
  "not-used",
  "context-only",
  "insufficient-as-primary-owner",
] as const;

export const SOURCE5_KNOWLEDGE_OWNER_KINDS = [
  "source1-packet",
  "typed-doctrine",
  "new-canonical-table",
  "phase3-runtime-owner",
] as const;

const Source5RelationshipStepIdSchema = z.enum(SOURCE5_RELATIONSHIP_STEP_IDS);
const Source5RepositoryReuseVerdictSchema = z.enum(SOURCE5_REPOSITORY_REUSE_VERDICTS);
const Source5KnowledgeOwnerKindSchema = z.enum(SOURCE5_KNOWLEDGE_OWNER_KINDS);

const Source5RepositoryContractSchema = z.object({
  repositoryMethod: z.literal("findDomainMatrixRows"),
  schemaTable: z.literal("bazi_domain_matrices"),
  matrixDomain: z.custom<MatrixDomain>((value) => value === "love"),
  contractVerdict: z.literal("generic-love-matrix-only"),
  allowedContextSteps: z.array(Source5RelationshipStepIdSchema).min(1),
  rejectedAssumptions: z.array(z.string().trim().min(1)).min(1),
  note: z.string().trim().min(1),
});

const Source5OwnerSurfaceSchema = z.object({
  ownerKind: Source5KnowledgeOwnerKindSchema,
  ownerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source5CanonicalOwnerGapSchema = z.object({
  tableName: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source5Phase3RuntimeOwnerSchema = z.object({
  ownerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source5StepKnowledgeOwnershipSchema = z.object({
  stepId: Source5RelationshipStepIdSchema,
  manualStep: z.number().int().min(1).max(7),
  label: z.string().trim().min(1),
  currentRepositoryReuse: z.object({
    verdict: Source5RepositoryReuseVerdictSchema,
    reusableOutputs: z.array(z.string().trim().min(1)),
    note: z.string().trim().min(1),
  }),
  primaryOwners: z.array(Source5OwnerSurfaceSchema).min(1),
  requiresNewCanonicalOwners: z.array(Source5CanonicalOwnerGapSchema),
  phase3RuntimeOwner: Source5Phase3RuntimeOwnerSchema,
  ownerSeparation: z.array(z.string().trim().min(1)).min(1),
});

export const Source5KnowledgeOwnershipSchema = z.object({
  sourceId: z.literal("source-5"),
  repositoryContract: Source5RepositoryContractSchema,
  steps: z.array(Source5StepKnowledgeOwnershipSchema).length(SOURCE5_RELATIONSHIP_STEP_IDS.length),
});

export type Source5KnowledgeOwnership = z.infer<typeof Source5KnowledgeOwnershipSchema>;
export type Source5StepKnowledgeOwnership = z.infer<typeof Source5StepKnowledgeOwnershipSchema>;

export function buildSource5KnowledgeOwnership(): Source5KnowledgeOwnership {
  return Source5KnowledgeOwnershipSchema.parse({
    sourceId: "source-5",
    repositoryContract: {
      repositoryMethod: "findDomainMatrixRows",
      schemaTable: "bazi_domain_matrices",
      matrixDomain: "love",
      contractVerdict: "generic-love-matrix-only",
      allowedContextSteps: [
        "step-1-relationship-potential",
        "step-5-conflict-and-interaction",
      ],
      rejectedAssumptions: [
        "love matrix owns spouse-element lookup",
        "love matrix owns relationship 12 cheingsae quality",
        "love matrix owns special relationship rules or spouse profile mapping",
      ],
      note: "The current repository/schema contract exposes generic love-domain rows only. It can support context layering for selected steps, but it cannot be treated as the canonical owner for all Source 5 manual logic.",
    },
    steps: [
      {
        stepId: "step-1-relationship-potential",
        manualStep: 1,
        label: "Relationship potential by gender and strength",
        currentRepositoryReuse: {
          verdict: "context-only",
          reusableOutputs: ["supporting love-domain narrative matrix rows"],
          note: "Generic love matrix rows may enrich the final wording after Source 1 gender/strength truth and typed doctrine decide the potential lane.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 gender + weighted-strength anchors",
            note: "Structural truth still starts from Source 1 inputs.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "source5-relationship-doctrine.step1-potential-by-gender-strength",
            note: "Doctrine owns the interpretation boundary for Step 1.",
          },
        ],
        requiresNewCanonicalOwners: [],
        phase3RuntimeOwner: {
          ownerKey: "interpretRelationshipPotential",
          note: "Phase 3 should build the runtime interpreter on top of Source 1 anchors and typed doctrine.",
        },
        ownerSeparation: [
          "matrix rows remain secondary context only",
        ],
      },
      {
        stepId: "step-2-day-stem-vs-spouse-base",
        manualStep: 2,
        label: "Day stem versus spouse base reaction",
        currentRepositoryReuse: {
          verdict: "not-used",
          reusableOutputs: [],
          note: "The current love matrix contract does not expose deterministic semantics for day-stem versus spouse-base reaction rules.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 day pillar + role-of-element anchors",
            note: "Step 2 starts from day stem/day branch structure already owned by Source 1.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "source5 day-stem-vs-spouse-base reaction policy",
            note: "A typed doctrine layer must freeze the relationship reaction rules before runtime coding.",
          },
        ],
        requiresNewCanonicalOwners: [],
        phase3RuntimeOwner: {
          ownerKey: "interpretDayStemVsSpouseBase",
          note: "Phase 3 runtime owner should remain separate from any generic love matrix lookup.",
        },
        ownerSeparation: [
          "Step 2 is a reaction interpreter, not a matrix row lookup",
        ],
      },
      {
        stepId: "step-3-spouse-element-lookup",
        manualStep: 3,
        label: "Spouse element lookup and strength",
        currentRepositoryReuse: {
          verdict: "insufficient-as-primary-owner",
          reusableOutputs: [],
          note: "`bazi_domain_matrices` has no typed spouse-element, hidden spouse element, or spouse-strength fields. `findDomainMatrixRows(\"love\")` is therefore insufficient as the primary owner for Step 3.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 role-of-element + hidden stems anchors",
            note: "Structural spouse lookup still depends on Source 1 role-of-element and hidden-stem truth.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE5_SPOUSE_ELEMENT_RULES",
            note: "Typed doctrine/constants should own the spouse-element and hidden spouse-element rules.",
          },
        ],
        requiresNewCanonicalOwners: [],
        phase3RuntimeOwner: {
          ownerKey: "resolveSpouseElement",
          note: "Phase 3 should implement a dedicated spouse resolver instead of routing through generic love matrix rows.",
        },
        ownerSeparation: [
          "Step 3 must stay separate from Step 4 quality interpretation",
          "Step 3 must stay separate from Step 7 special rules and spouse profile output",
        ],
      },
      {
        stepId: "step-4-relationship-12-cheingsae",
        manualStep: 4,
        label: "Relationship 12 cheingsae quality",
        currentRepositoryReuse: {
          verdict: "insufficient-as-primary-owner",
          reusableOutputs: [],
          note: "The current matrix/repository contract has no typed lane for relationship 12 cheingsae, so it cannot own Step 4 quality logic.",
        },
        primaryOwners: [
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE5_RELATIONSHIP_TWELVE_CHEINGSAE_POLICY",
            note: "Typed doctrine must keep relationship 12 cheingsae separate from Source 1 twelve-qi texture.",
          },
        ],
        requiresNewCanonicalOwners: [
          {
            tableName: "bazi_relationship_twelve_cheingsae_rules",
            note: "A dedicated canonical owner is needed if Step 4 rules are to be sourced from normalized data rather than hard-coded runtime constants.",
          },
        ],
        phase3RuntimeOwner: {
          ownerKey: "interpretRelationshipTwelveCheingsae",
          note: "Phase 3 needs a dedicated quality interpreter for Step 4.",
        },
        ownerSeparation: [
          "Step 4 must remain distinct from Source 1 twelve-qi texture",
          "Step 4 must remain distinct from Step 3 spouse-element resolution",
        ],
      },
      {
        stepId: "step-5-conflict-and-interaction",
        manualStep: 5,
        label: "Conflict and interaction impact on relationship",
        currentRepositoryReuse: {
          verdict: "context-only",
          reusableOutputs: ["supporting love-domain conflict wording"],
          note: "Love-domain matrix rows can supplement final narrative phrasing, but Source 1 conflict-context precedence remains the structural owner.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 conflict-context packet",
            note: "Conflict precedence is already owned by Source 1 shared packets.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "source5 relationship conflict mapping policy",
            note: "Typed doctrine should constrain how structural conflict becomes relationship meaning.",
          },
        ],
        requiresNewCanonicalOwners: [],
        phase3RuntimeOwner: {
          ownerKey: "mapConflictContextForRelationship",
          note: "Phase 3 should map existing conflict packet truth into the Source 5 relationship lane.",
        },
        ownerSeparation: [
          "Step 5 conflict mapping is not the same owner lane as Step 7 special rules",
        ],
      },
      {
        stepId: "step-6-marriage-timing",
        manualStep: 6,
        label: "Marriage timing interpretation",
        currentRepositoryReuse: {
          verdict: "not-used",
          reusableOutputs: [],
          note: "The timing lane is anchored in Source 1 timing packets and does not depend on the current generic love matrix contract.",
        },
        primaryOwners: [
          {
            ownerKind: "source1-packet",
            ownerKey: "source1 timing + role-of-element anchors",
            note: "Timing interpretation begins from existing timing packets and role-of-element facts.",
          },
          {
            ownerKind: "typed-doctrine",
            ownerKey: "source5 marriage timing policy",
            note: "Typed doctrine must lock the Step 6 interpretation lane before runtime implementation.",
          },
        ],
        requiresNewCanonicalOwners: [],
        phase3RuntimeOwner: {
          ownerKey: "interpretMarriageTiming",
          note: "Phase 3 should keep timing interpretation as its own runtime owner.",
        },
        ownerSeparation: [
          "Step 6 timing output must stay separate from Step 3 spouse lookup and Step 7 special rules",
        ],
      },
      {
        stepId: "step-7-special-rules-and-spouse-profile",
        manualStep: 7,
        label: "Special rules and spouse profile",
        currentRepositoryReuse: {
          verdict: "insufficient-as-primary-owner",
          reusableOutputs: [],
          note: "The current generic love matrix contract has no typed surface for affair rules, spouse profile signatures, or other Source 5 special cases, so it cannot own Step 7.",
        },
        primaryOwners: [
          {
            ownerKind: "typed-doctrine",
            ownerKey: "SOURCE5_SPECIAL_RELATIONSHIP_RULE_POLICY",
            note: "Typed doctrine should classify which special rules belong to the green-gate surface.",
          },
        ],
        requiresNewCanonicalOwners: [
          {
            tableName: "bazi_relationship_special_rules",
            note: "Special relationship rules need a canonical owner if they will be data-backed instead of embedded only in runtime constants.",
          },
          {
            tableName: "bazi_spouse_profile_signatures",
            note: "Spouse profile mapping needs its own canonical owner so it does not piggyback on Step 5 conflict wording.",
          },
        ],
        phase3RuntimeOwner: {
          ownerKey: "evaluateSpecialRelationshipRules",
          note: "Phase 3 should keep Step 7 logic behind a dedicated evaluator.",
        },
        ownerSeparation: [
          "Step 7 must remain distinct from Step 5 conflict-context mapping",
          "Step 7 must remain distinct from Step 3 spouse-element lookup",
        ],
      },
    ],
  });
}

export function getSource5KnowledgeOwnershipForStep(stepId: typeof SOURCE5_RELATIONSHIP_STEP_IDS[number]): Source5StepKnowledgeOwnership {
  return buildSource5KnowledgeOwnership().steps.find((step) => step.stepId === stepId) ?? (() => {
    throw new Error(`Unknown Source 5 step: ${stepId}`);
  })();
}