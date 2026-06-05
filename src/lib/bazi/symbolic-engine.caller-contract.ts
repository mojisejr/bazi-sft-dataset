import { z } from "zod";

import {
  BAZI_SHARED_PACKET_FAMILIES,
  BaziSharedPacketFamilySchema,
  BaziSharedPacketSpineSchema,
  buildBaziSharedPacketSpine,
} from "@/lib/bazi/symbolic-engine.shared-packets";
import { calculateBaziFactState } from "@/lib/bazi/symbolic-engine.os-core";
import {
  CalculatedStateSchema,
  RawInputSchema,
  type CalculatedStateValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import {
  SOURCE1_CONTRACT_FIELD_IDS,
  SOURCE1_GOLDEN_REFERENCE_CASE,
} from "@/lib/bazi/source1-operating-system-contract";
import { type BaziAtomicCanonicalBucket } from "@/lib/bazi/atomic-question-matrix";

export const BAZI_SOURCE_OVERLAY_SEQUENCE = [
  "source-2",
  "source-5",
  "source-6",
  "source-4",
  "source-3",
  "source-7",
] as const;

export type BaziSourceOverlayId = (typeof BAZI_SOURCE_OVERLAY_SEQUENCE)[number];

export const BaziSourceOverlayIdSchema = z.enum(BAZI_SOURCE_OVERLAY_SEQUENCE);

const Source1ContractFieldIdSchema = z.enum(SOURCE1_CONTRACT_FIELD_IDS);

const BaziSourceOverlayStepSchema = z.object({
  sourceId: BaziSourceOverlayIdSchema,
  handoffStatus: z.literal("ready"),
  requiredPacketFamilies: z.array(BaziSharedPacketFamilySchema)
    .min(1)
    .max(BAZI_SHARED_PACKET_FAMILIES.length),
  requiredSourceFieldIds: z.array(Source1ContractFieldIdSchema)
    .min(1)
    .max(SOURCE1_CONTRACT_FIELD_IDS.length),
  waitsForOverlayOutputs: z.array(z.enum([
    "useful-god-judgment",
    "master-key-judgment",
  ])).max(2),
});

export const BaziSourceOverlayReadinessContractSchema = z.object({
  sourceContract: z.literal("source1"),
  status: z.literal("ready-for-downstream-overlays"),
  preservedGoldenCase: z.object({
    label: z.string().trim().min(1),
    dayMaster: z.string().trim().min(1),
    fourPillars: z.object({
      year: z.object({ stem: z.string().trim().min(1), branch: z.string().trim().min(1) }),
      month: z.object({ stem: z.string().trim().min(1), branch: z.string().trim().min(1) }),
      day: z.object({ stem: z.string().trim().min(1), branch: z.string().trim().min(1) }),
      hour: z.object({ stem: z.string().trim().min(1), branch: z.string().trim().min(1) }),
    }),
  }),
  preservedSource1FieldIds: z.array(Source1ContractFieldIdSchema)
    .length(SOURCE1_CONTRACT_FIELD_IDS.length),
  overlaySequence: z.tuple([
    z.literal("source-2"),
    z.literal("source-5"),
    z.literal("source-6"),
    z.literal("source-4"),
    z.literal("source-3"),
    z.literal("source-7"),
  ]),
  steps: z.array(BaziSourceOverlayStepSchema).length(BAZI_SOURCE_OVERLAY_SEQUENCE.length),
});

export const BaziCallerContractSchema = z.object({
  rawInput: RawInputSchema,
  calculatedState: CalculatedStateSchema,
  sharedPacketSpine: BaziSharedPacketSpineSchema,
  overlayReadiness: BaziSourceOverlayReadinessContractSchema,
});

export type BaziCallerContract = z.infer<typeof BaziCallerContractSchema>;
export type BaziSourceOverlayReadinessContract = z.infer<
  typeof BaziSourceOverlayReadinessContractSchema
>;

const SOURCE_OVERLAY_HANDOFF_STEPS = [
  {
    sourceId: "source-2",
    handoffStatus: "ready",
    requiredPacketFamilies: [
      "strength",
      "role-of-element",
      "twelve-qi-texture",
      "conflict-context",
      "timing",
      "useful-god-master-key-readiness",
    ],
    requiredSourceFieldIds: [
      "weighted-strength",
      "role-of-element",
      "twelve-qi-texture",
      "conflict-context",
      "timing",
      "useful-god-master-key-readiness",
    ],
    waitsForOverlayOutputs: [],
  },
  {
    sourceId: "source-5",
    handoffStatus: "ready",
    requiredPacketFamilies: [
      "strength",
      "role-of-element",
      "conflict-context",
      "timing",
    ],
    requiredSourceFieldIds: [
      "weighted-strength",
      "role-of-element",
      "conflict-context",
      "timing",
    ],
    waitsForOverlayOutputs: [],
  },
  {
    sourceId: "source-6",
    handoffStatus: "ready",
    requiredPacketFamilies: [
      "strength",
      "role-of-element",
      "conflict-context",
      "timing",
    ],
    requiredSourceFieldIds: [
      "weighted-strength",
      "role-of-element",
      "conflict-context",
      "timing",
    ],
    waitsForOverlayOutputs: [],
  },
  {
    sourceId: "source-4",
    handoffStatus: "ready",
    requiredPacketFamilies: [
      "strength",
      "role-of-element",
      "timing",
    ],
    requiredSourceFieldIds: [
      "weighted-strength",
      "role-of-element",
      "timing",
    ],
    waitsForOverlayOutputs: [],
  },
  {
    sourceId: "source-3",
    handoffStatus: "ready",
    requiredPacketFamilies: [
      "strength",
      "role-of-element",
      "twelve-qi-texture",
      "conflict-context",
    ],
    requiredSourceFieldIds: [
      "weighted-strength",
      "role-of-element",
      "twelve-qi-texture",
      "conflict-context",
    ],
    waitsForOverlayOutputs: [],
  },
  {
    sourceId: "source-7",
    handoffStatus: "ready",
    requiredPacketFamilies: [
      "strength",
      "role-of-element",
      "timing",
      "useful-god-master-key-readiness",
    ],
    requiredSourceFieldIds: [
      "weighted-strength",
      "role-of-element",
      "timing",
      "useful-god-master-key-readiness",
    ],
    waitsForOverlayOutputs: ["useful-god-judgment", "master-key-judgment"],
  },
] as const;

const CANONICAL_BUCKET_REQUIRED_PACKET_FAMILIES: Record<
  BaziAtomicCanonicalBucket,
  readonly (typeof BAZI_SHARED_PACKET_FAMILIES)[number][]
> = {
  wealth: ["strength", "role-of-element", "timing"],
  relationship: ["strength", "role-of-element", "conflict-context", "timing"],
  work: ["strength", "role-of-element", "conflict-context", "timing"],
  health: ["strength", "role-of-element", "twelve-qi-texture", "timing"],
  foundation: [
    "strength",
    "role-of-element",
    "twelve-qi-texture",
    "conflict-context",
    "timing",
  ],
  study: ["strength", "role-of-element", "timing"],
};

export function buildBaziSourceOverlayReadinessContract(): BaziSourceOverlayReadinessContract {
  return BaziSourceOverlayReadinessContractSchema.parse({
    sourceContract: "source1",
    status: "ready-for-downstream-overlays",
    preservedGoldenCase: {
      label: SOURCE1_GOLDEN_REFERENCE_CASE.label,
      dayMaster: SOURCE1_GOLDEN_REFERENCE_CASE.structuralAnchors.dayMaster,
      fourPillars: SOURCE1_GOLDEN_REFERENCE_CASE.structuralAnchors.fourPillars,
    },
    preservedSource1FieldIds: [...SOURCE1_CONTRACT_FIELD_IDS],
    overlaySequence: [...BAZI_SOURCE_OVERLAY_SEQUENCE],
    steps: SOURCE_OVERLAY_HANDOFF_STEPS.map((step) => ({
      ...step,
      requiredPacketFamilies: [...step.requiredPacketFamilies],
      requiredSourceFieldIds: [...step.requiredSourceFieldIds],
      waitsForOverlayOutputs: [...step.waitsForOverlayOutputs],
    })),
  });
}

export function buildBaziCallerContractFromRawInput(
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
): BaziCallerContract {
  const factState = calculateBaziFactState(rawInput);

  return BaziCallerContractSchema.parse({
    rawInput,
    calculatedState,
    sharedPacketSpine: buildBaziSharedPacketSpine(factState, {
      families: [...BAZI_SHARED_PACKET_FAMILIES],
      timingLookaheadCount: 2,
    }),
    overlayReadiness: buildBaziSourceOverlayReadinessContract(),
  });
}

export function isBaziCallerContract(value: unknown): value is BaziCallerContract {
  return BaziCallerContractSchema.safeParse(value).success;
}

export function assertBaziCallerContractSupportsCanonicalBucket(
  contract: BaziCallerContract,
  canonicalBucket: BaziAtomicCanonicalBucket,
) {
  if (contract.overlayReadiness.status !== "ready-for-downstream-overlays") {
    throw new Error("Bazi caller contract is not locked for downstream overlays.");
  }

  const availableFamilies = new Set(contract.sharedPacketSpine.packets.map((packet) => packet.family));
  const missingFamilies = CANONICAL_BUCKET_REQUIRED_PACKET_FAMILIES[canonicalBucket]
    .filter((family) => !availableFamilies.has(family));

  if (missingFamilies.length > 0) {
    throw new Error(
      `Bazi caller contract is missing shared packet families for ${canonicalBucket}: ${missingFamilies.join(", ")}`,
    );
  }
}