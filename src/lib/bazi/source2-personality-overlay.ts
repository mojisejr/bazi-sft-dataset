import { z } from "zod";

import {
  BaziCallerContractSchema,
  type BaziCallerContract,
} from "@/lib/bazi/symbolic-engine.caller-contract";
import {
  BaziSharedPacketSchema,
  type BaziSharedPacket,
} from "@/lib/bazi/symbolic-engine.shared-packets";
import {
  ContextRuleNoteSchema,
  DayMasterStrengthProfileSchema,
} from "@/lib/bazi/schema-types";
import {
  Source2AdviceInputSchema,
  buildSource2DayPillarAdviceInput,
  buildSource2RoutingNarrativeInput,
  buildSource2TwelveQiAdviceInput,
  type Source2AdviceInput,
} from "@/lib/bazi/source2-knowledge-ownership";
import { buildSixtyJiaziSemanticNotes } from "@/lib/bazi/symbolic-engine.persona";
import type {
  BaziKnowledgeRepository,
  DayMasterStrengthProfileRecord,
  SixtyJiaziPersonaRecord,
} from "@/lib/bazi/symbolic-engine.types";
import { buildSource1StrengthContract } from "@/lib/bazi/source1-operating-system-contract";

const SOURCE2_SUPPORTING_PACKET_FAMILIES = [
  "role-of-element",
  "twelve-qi-texture",
  "conflict-context",
  "timing",
] as const;

const Source2OverlayStatusSchema = z.enum(["ready", "ready-with-gaps"]);

export const SOURCE2_DOWNSTREAM_READINESS = {
  nextOverlay: "source-5",
  status: "ready-for-handoff",
  mayRelyOn: {
    routing: "Use Source 2 routing as the primary personality axis without reopening Source 1 strength ownership.",
    refinement: "Use Source 2 day-pillar refinement as temperament color only when it supports the routing axis.",
    evidence: "Use Source 2 twelve-qi evidence and supporting packets as context modifiers, not replacement identity.",
  },
  source2LocalOnly: [
    "overlay status classification",
    "routeFrom provenance markers",
    "presentation wording from prompt and report consumers",
  ],
  guardrails: [
    "Do not recompute Source 1 anchors or day-master strength.",
    "Do not let refinement or evidence override Source 2 routing.",
    "Treat supporting packets as downstream context only.",
  ],
} as const;

const Source2RefinementSurfaceSchema = z.object({
  code: z.string().trim().min(1),
  narrative: z.string().trim().min(1).nullable(),
  heavenNarrative: z.string().trim().min(1).nullable(),
  earthNarrative: z.string().trim().min(1).nullable(),
  elementTone: z.string().trim().min(1).nullable(),
  twelveQiLabel: z.string().trim().min(1).nullable(),
  semanticNotes: z.array(z.string().trim().min(1)).default([]),
  precedenceNotes: z.array(z.string().trim().min(1)).default([]),
  precedenceNoteSignals: z.array(ContextRuleNoteSchema).default([]),
});

export const Source2PersonalityOverlaySchema = z.object({
  sourceId: z.literal("source-2"),
  status: Source2OverlayStatusSchema,
  routing: z.object({
    routeFrom: z.literal("dayMasterStrengthProfile"),
    dayMaster: z.string().trim().min(1),
    strengthProfile: DayMasterStrengthProfileSchema,
    narrative: Source2AdviceInputSchema,
  }),
  refinement: z.object({
    routeFrom: z.literal("sixtyJiaziCorePersona"),
    dayPillarCode: z.string().trim().min(1),
    corePersona: Source2RefinementSurfaceSchema,
    dayPillarAdvice: Source2AdviceInputSchema,
  }),
  evidence: z.object({
    twelveQi: z.object({
      dayBranchStage: z.string().trim().min(1),
      monthBranchStage: z.string().trim().min(1),
      toneLabel: z.string().trim().min(1).nullable(),
      advice: Source2AdviceInputSchema,
      precedenceNoteSignals: z.array(ContextRuleNoteSchema).default([]),
    }),
    supportingPackets: z.array(BaziSharedPacketSchema).default([]),
  }),
});

export type Source2PersonalityOverlay = z.infer<typeof Source2PersonalityOverlaySchema>;
export type Source2PersonalityOverlayRepository = Pick<
  BaziKnowledgeRepository,
  "findDayMasterStrengthProfile" | "findSixtyJiaziPersona"
>;

function getSource2SupportingPackets(contract: BaziCallerContract): BaziSharedPacket[] {
  const source2Step = contract.overlayReadiness.steps.find((step) => step.sourceId === "source-2");

  if (!source2Step || source2Step.handoffStatus !== "ready") {
    throw new Error("Bazi caller contract is not ready for the Source 2 overlay.");
  }

  const enabledFamilies = new Set(source2Step.requiredPacketFamilies);

  return contract.sharedPacketSpine.packets.filter((packet) => (
    SOURCE2_SUPPORTING_PACKET_FAMILIES.includes(
      packet.family as (typeof SOURCE2_SUPPORTING_PACKET_FAMILIES)[number],
    )
    && enabledFamilies.has(packet.family)
  ));
}

function buildRoutingNarrativeInput(record: DayMasterStrengthProfileRecord | null): Source2AdviceInput {
  if (record) {
    return record.routingNarrative;
  }

  return buildSource2RoutingNarrativeInput({
    sourcePath: null,
    rowOrder: null,
    narrative: null,
  });
}

function buildDayPillarAdvice(record: SixtyJiaziPersonaRecord | null): Source2AdviceInput {
  if (record) {
    return record.dayPillarAdvice;
  }

  return buildSource2DayPillarAdviceInput({
    sourcePath: null,
    rowGroup: null,
    combinedNarrative: null,
  });
}

function buildTwelveQiAdvice(record: SixtyJiaziPersonaRecord | null): Source2AdviceInput {
  if (record) {
    return record.twelveQiAdvice;
  }

  return buildSource2TwelveQiAdviceInput({
    sourcePath: null,
    rowGroup: null,
    combinedNarrative: null,
  });
}

function buildRefinementSurface(params: {
  contract: BaziCallerContract;
  persona: SixtyJiaziPersonaRecord | null;
}) {
  const calculatedPersona = params.contract.calculatedState.sixtyJiaziCorePersona;
  const dayPillarCode = `${params.contract.calculatedState.fourPillars.day.stem}${params.contract.calculatedState.fourPillars.day.branch}`;

  return {
    code: calculatedPersona?.code ?? dayPillarCode,
    narrative: params.persona?.combinedNarrative ?? calculatedPersona?.narrative ?? null,
    heavenNarrative: params.persona?.dayMasterNarrative ?? calculatedPersona?.heavenNarrative ?? null,
    earthNarrative: params.persona?.branchNarrative ?? calculatedPersona?.earthNarrative ?? null,
    elementTone: params.persona?.elementTone ?? calculatedPersona?.elementTone ?? null,
    twelveQiLabel: params.persona?.twelveQiLabel ?? calculatedPersona?.twelveQiLabel ?? null,
    semanticNotes: calculatedPersona?.semanticNotes ?? buildSixtyJiaziSemanticNotes(params.persona),
    precedenceNotes: calculatedPersona?.precedenceNotes ?? [],
    precedenceNoteSignals: calculatedPersona?.precedenceNoteSignals ?? [],
  };
}

function resolveOverlayStatus(inputs: Source2AdviceInput[]) {
  return inputs.every((input) => input.ownership.status === "authored")
    ? "ready"
    : "ready-with-gaps";
}

export async function buildSource2PersonalityOverlay(
  contractInput: BaziCallerContract,
  repository: Source2PersonalityOverlayRepository,
): Promise<Source2PersonalityOverlay> {
  const contract = BaziCallerContractSchema.parse(contractInput);
  const strengthProfile = contract.calculatedState.dayMasterStrengthProfile;

  if (!strengthProfile) {
    throw new Error("Bazi caller contract is missing dayMasterStrengthProfile for Source 2 routing.");
  }

  const source1Strength = buildSource1StrengthContract(contract.calculatedState.strengthScore);
  const routingRecord = await repository.findDayMasterStrengthProfile(
    contract.calculatedState.dayMaster,
    strengthProfile.lookupState ?? source1Strength.lookupState,
    contract.calculatedState.strengthScore,
  );
  const personaRecord = await repository.findSixtyJiaziPersona(
    contract.calculatedState.dayMaster,
    contract.calculatedState.fourPillars.day.branch,
  );
  const routingNarrative = buildRoutingNarrativeInput(routingRecord);
  const dayPillarAdvice = buildDayPillarAdvice(personaRecord);
  const twelveQiAdvice = buildTwelveQiAdvice(personaRecord);
  const refinementSurface = buildRefinementSurface({
    contract,
    persona: personaRecord,
  });

  return Source2PersonalityOverlaySchema.parse({
    sourceId: "source-2",
    status: resolveOverlayStatus([
      routingNarrative,
      dayPillarAdvice,
      twelveQiAdvice,
    ]),
    routing: {
      routeFrom: "dayMasterStrengthProfile",
      dayMaster: strengthProfile.dayMaster,
      strengthProfile,
      narrative: routingNarrative,
    },
    refinement: {
      routeFrom: "sixtyJiaziCorePersona",
      dayPillarCode: refinementSurface.code,
      corePersona: refinementSurface,
      dayPillarAdvice,
    },
    evidence: {
      twelveQi: {
        dayBranchStage: contract.calculatedState.twelveQi.dayBranch,
        monthBranchStage: contract.calculatedState.twelveQi.monthBranch,
        toneLabel: refinementSurface.twelveQiLabel,
        advice: twelveQiAdvice,
        precedenceNoteSignals: refinementSurface.precedenceNoteSignals,
      },
      supportingPackets: getSource2SupportingPackets(contract),
    },
  });
}