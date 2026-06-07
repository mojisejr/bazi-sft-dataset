import { z } from "zod";

import {
  BaziCallerContractSchema,
  type BaziCallerContract,
} from "@/lib/bazi/symbolic-engine.caller-contract";
import {
  BaziSharedPacketFamilySchema,
  BaziSharedPacketSchema,
  type BaziSharedPacket,
} from "@/lib/bazi/symbolic-engine.shared-packets";
import {
  buildSource4KnowledgeOwnership,
  getSource4KnowledgeOwnershipForStep,
  SOURCE4_SURFACE_REUSE_VERDICTS,
} from "@/lib/bazi/source4-knowledge-ownership";
import {
  buildSource4WealthInvestmentDoctrine,
  SOURCE4_TERMINOLOGY_IDS,
  SOURCE4_WEALTH_INVESTMENT_STEP_IDS,
} from "@/lib/bazi/source4-wealth-investment-doctrine";
import {
  buildSource4WealthInvestmentStepResult,
  Source4WealthInvestmentStepResultSchema,
} from "@/lib/bazi/source4-wealth-investment-rules";
import { SOURCE1_CONTRACT_FIELD_IDS } from "@/lib/bazi/source1-operating-system-contract";

const Source1ContractFieldIdSchema = z.enum(SOURCE1_CONTRACT_FIELD_IDS);
const Source4WealthInvestmentStepIdSchema = z.enum(SOURCE4_WEALTH_INVESTMENT_STEP_IDS);
const Source4TerminologyIdSchema = z.enum(SOURCE4_TERMINOLOGY_IDS);
const Source4SurfaceReuseVerdictSchema = z.enum(SOURCE4_SURFACE_REUSE_VERDICTS);

const Source4OverlayStatusSchema = z.enum(["all-steps-green"]);
const Source4StepStatusSchema = z.enum(["green"]);

const Source4RuntimeOwnerSchema = z.object({
  module: z.string().trim().min(1),
  ownerKey: z.string().trim().min(1),
  status: z.enum(["existing-owner", "new-owner-required", "gap-classified"]),
  phase2RuntimeOwnerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source4KnowledgeOwnershipProvenanceSchema = z.object({
  surfaceReuseVerdict: Source4SurfaceReuseVerdictSchema,
  primaryOwnerKeys: z.array(z.string().trim().min(1)).min(1),
  requiresNewCanonicalTables: z.array(z.string().trim().min(1)),
  ownerSeparation: z.array(z.string().trim().min(1)).min(1),
});

const Source4StepProvenanceSchema = z.object({
  routeFrom: z.literal("caller-contract"),
  packetFamilies: z.array(BaziSharedPacketFamilySchema),
  sourceFieldIds: z.array(Source1ContractFieldIdSchema).min(1),
  source1OwnerKeys: z.array(z.string().trim().min(1)).min(1),
  doctrineStepId: Source4WealthInvestmentStepIdSchema,
  doctrineOwnerKey: z.string().trim().min(1),
  terminologyIds: z.array(Source4TerminologyIdSchema).min(1),
  knowledgeOwnership: Source4KnowledgeOwnershipProvenanceSchema,
});

const Source4WealthInvestmentOverlayStepSchema = z.object({
  stepId: Source4WealthInvestmentStepIdSchema,
  manualStep: z.number().int().min(1).max(6),
  label: z.string().trim().min(1),
  status: Source4StepStatusSchema,
  runtimeOwner: Source4RuntimeOwnerSchema,
  provenance: Source4StepProvenanceSchema,
  result: Source4WealthInvestmentStepResultSchema,
});

export const Source4WealthInvestmentOverlaySchema = z.object({
  sourceId: z.literal("source-4"),
  status: Source4OverlayStatusSchema,
  packetContract: z.object({
    routeFrom: z.literal("caller-contract"),
    allowedPacketFamilies: z.array(BaziSharedPacketFamilySchema).min(1),
    requiredSourceFieldIds: z.array(Source1ContractFieldIdSchema).min(1),
    packetFamiliesUsed: z.array(BaziSharedPacketFamilySchema).min(1),
    supportingPackets: z.array(BaziSharedPacketSchema).min(1),
  }),
  steps: z.array(Source4WealthInvestmentOverlayStepSchema).length(SOURCE4_WEALTH_INVESTMENT_STEP_IDS.length),
});

export type Source4WealthInvestmentOverlay = z.infer<typeof Source4WealthInvestmentOverlaySchema>;

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function getSource4ReadinessStep(contract: BaziCallerContract) {
  const source4Step = contract.overlayReadiness.steps.find((step) => step.sourceId === "source-4");

  if (!source4Step || source4Step.handoffStatus !== "ready") {
    throw new Error("Bazi caller contract is not ready for the Source 4 overlay.");
  }

  return source4Step;
}

function getSource4SupportingPackets(
  contract: BaziCallerContract,
  allowedPacketFamilies: readonly BaziSharedPacket["family"][],
) {
  const supportingPackets = contract.sharedPacketSpine.packets.filter((packet) => (
    allowedPacketFamilies.includes(packet.family)
  ));
  const missingFamilies = allowedPacketFamilies.filter((family) => (
    !supportingPackets.some((packet) => packet.family === family)
  ));

  if (missingFamilies.length > 0) {
    throw new Error(`Source 4 overlay is missing caller-contract packets: ${missingFamilies.join(", ")}`);
  }

  return supportingPackets;
}

export function buildSource4WealthInvestmentOverlay(contractInput: BaziCallerContract): Source4WealthInvestmentOverlay {
  const contract = BaziCallerContractSchema.parse(contractInput);
  const doctrine = buildSource4WealthInvestmentDoctrine();
  const knowledgeOwnership = buildSource4KnowledgeOwnership();
  const source4Readiness = getSource4ReadinessStep(contract);
  const allowedPacketFamilies = [...source4Readiness.requiredPacketFamilies];
  const supportingPackets = getSource4SupportingPackets(contract, allowedPacketFamilies);

  const steps = doctrine.steps.map((doctrineStep) => {
    const stepOwnership = getSource4KnowledgeOwnershipForStep(doctrineStep.stepId);
    const computedStep = buildSource4WealthInvestmentStepResult(doctrineStep.stepId, supportingPackets, contract);

    return {
      stepId: doctrineStep.stepId,
      manualStep: doctrineStep.manualStep,
      label: doctrineStep.label,
      status: "green",
      runtimeOwner: {
        module: doctrineStep.source4LocalLogic.ownerTarget.module,
        ownerKey: doctrineStep.source4LocalLogic.ownerTarget.ownerKey,
        status: doctrineStep.source4LocalLogic.ownerTarget.status,
        phase2RuntimeOwnerKey: stepOwnership.phase2RuntimeOwner.ownerKey,
        note: stepOwnership.phase2RuntimeOwner.note,
      },
      provenance: {
        routeFrom: "caller-contract",
        packetFamilies: computedStep.packetFamilies,
        sourceFieldIds: unique(doctrineStep.source1Reuse.map((reuse) => reuse.fieldId)),
        source1OwnerKeys: unique(doctrineStep.source1Reuse.map((reuse) => reuse.ownerKey)),
        doctrineStepId: doctrineStep.stepId,
        doctrineOwnerKey: doctrineStep.source4LocalLogic.ownerTarget.ownerKey,
        terminologyIds: doctrineStep.terminologyIds,
        knowledgeOwnership: {
          surfaceReuseVerdict: stepOwnership.currentSurfaceReuse.verdict,
          primaryOwnerKeys: stepOwnership.primaryOwners.map((owner) => owner.ownerKey),
          requiresNewCanonicalTables: stepOwnership.requiresNewCanonicalOwners.map((gap) => gap.tableName),
          ownerSeparation: stepOwnership.ownerSeparation,
        },
      },
      result: computedStep.result,
    };
  });

  return Source4WealthInvestmentOverlaySchema.parse({
    sourceId: knowledgeOwnership.sourceId,
    status: "all-steps-green",
    packetContract: {
      routeFrom: "caller-contract",
      allowedPacketFamilies,
      requiredSourceFieldIds: [...source4Readiness.requiredSourceFieldIds],
      packetFamiliesUsed: unique(steps.flatMap((step) => step.provenance.packetFamilies)),
      supportingPackets,
    },
    steps,
  });
}
