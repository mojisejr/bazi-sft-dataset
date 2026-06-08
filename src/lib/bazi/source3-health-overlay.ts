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
  buildSource3HealthDoctrine,
  SOURCE3_HEALTH_STEP_IDS,
  SOURCE3_HEALTH_TERMINOLOGY_IDS,
} from "@/lib/bazi/source3-health-doctrine";
import {
  buildSource3HealthStepResult,
  Source3HealthStepResultSchema,
} from "@/lib/bazi/source3-health-rules";
import {
  buildSource3KnowledgeOwnership,
  getSource3KnowledgeOwnershipForStep,
  SOURCE3_SURFACE_REUSE_VERDICTS,
} from "@/lib/bazi/source3-knowledge-ownership";
import { SOURCE1_CONTRACT_FIELD_IDS } from "@/lib/bazi/source1-operating-system-contract";

const Source1ContractFieldIdSchema = z.enum(SOURCE1_CONTRACT_FIELD_IDS);
const Source3HealthStepIdSchema = z.enum(SOURCE3_HEALTH_STEP_IDS);
const Source3TerminologyIdSchema = z.enum(SOURCE3_HEALTH_TERMINOLOGY_IDS);
const Source3SurfaceReuseVerdictSchema = z.enum(SOURCE3_SURFACE_REUSE_VERDICTS);

const Source3OverlayStatusSchema = z.enum(["all-steps-green"]);
const Source3StepStatusSchema = z.enum(["green"]);

const Source3RuntimeOwnerSchema = z.object({
  module: z.string().trim().min(1),
  ownerKey: z.string().trim().min(1),
  status: z.enum(["existing-owner", "new-owner-required", "gap-classified"]),
  phase2RuntimeOwnerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source3KnowledgeOwnershipProvenanceSchema = z.object({
  surfaceReuseVerdict: Source3SurfaceReuseVerdictSchema,
  primaryOwnerKeys: z.array(z.string().trim().min(1)).min(1),
  requiresNewCanonicalTables: z.array(z.string().trim().min(1)),
  ownerSeparation: z.array(z.string().trim().min(1)).min(1),
});

const Source3StepProvenanceSchema = z.object({
  routeFrom: z.literal("caller-contract"),
  packetFamilies: z.array(BaziSharedPacketFamilySchema),
  sourceFieldIds: z.array(Source1ContractFieldIdSchema).min(1),
  source1OwnerKeys: z.array(z.string().trim().min(1)).min(1),
  doctrineStepId: Source3HealthStepIdSchema,
  doctrineOwnerKey: z.string().trim().min(1),
  terminologyIds: z.array(Source3TerminologyIdSchema).min(1),
  knowledgeOwnership: Source3KnowledgeOwnershipProvenanceSchema,
});

const Source3HealthOverlayStepSchema = z.object({
  stepId: Source3HealthStepIdSchema,
  manualStep: z.number().int().min(1).max(4),
  label: z.string().trim().min(1),
  status: Source3StepStatusSchema,
  runtimeOwner: Source3RuntimeOwnerSchema,
  provenance: Source3StepProvenanceSchema,
  result: Source3HealthStepResultSchema,
});

export const Source3HealthOverlaySchema = z.object({
  sourceId: z.literal("source-3"),
  status: Source3OverlayStatusSchema,
  packetContract: z.object({
    routeFrom: z.literal("caller-contract"),
    allowedPacketFamilies: z.array(BaziSharedPacketFamilySchema).min(1),
    requiredSourceFieldIds: z.array(Source1ContractFieldIdSchema).min(1),
    packetFamiliesUsed: z.array(BaziSharedPacketFamilySchema).min(1),
    supportingPackets: z.array(BaziSharedPacketSchema).min(1),
  }),
  steps: z.array(Source3HealthOverlayStepSchema).length(SOURCE3_HEALTH_STEP_IDS.length),
});

export type Source3HealthOverlay = z.infer<typeof Source3HealthOverlaySchema>;

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function getSource3ReadinessStep(contract: BaziCallerContract) {
  const source3Step = contract.overlayReadiness.steps.find((step) => step.sourceId === "source-3");

  if (!source3Step || source3Step.handoffStatus !== "ready") {
    throw new Error("Bazi caller contract is not ready for the Source 3 overlay.");
  }

  return source3Step;
}

function getSource3SupportingPackets(
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
    throw new Error(`Source 3 overlay is missing caller-contract packets: ${missingFamilies.join(", ")}`);
  }

  return supportingPackets;
}

export function buildSource3HealthOverlay(contractInput: BaziCallerContract): Source3HealthOverlay {
  const contract = BaziCallerContractSchema.parse(contractInput);
  const doctrine = buildSource3HealthDoctrine();
  const knowledgeOwnership = buildSource3KnowledgeOwnership();
  const source3Readiness = getSource3ReadinessStep(contract);
  const allowedPacketFamilies = [...source3Readiness.requiredPacketFamilies];
  const supportingPackets = getSource3SupportingPackets(contract, allowedPacketFamilies);

  const steps = doctrine.steps.map((doctrineStep) => {
    const stepOwnership = getSource3KnowledgeOwnershipForStep(doctrineStep.stepId);
    const computedStep = buildSource3HealthStepResult(doctrineStep.stepId, supportingPackets, contract);

    return {
      stepId: doctrineStep.stepId,
      manualStep: doctrineStep.manualStep,
      label: doctrineStep.label,
      status: "green",
      runtimeOwner: {
        module: doctrineStep.source3LocalLogic.ownerTarget.module,
        ownerKey: doctrineStep.source3LocalLogic.ownerTarget.ownerKey,
        status: doctrineStep.source3LocalLogic.ownerTarget.status,
        phase2RuntimeOwnerKey: stepOwnership.phase2RuntimeOwner.ownerKey,
        note: stepOwnership.phase2RuntimeOwner.note,
      },
      provenance: {
        routeFrom: "caller-contract",
        packetFamilies: computedStep.packetFamilies,
        sourceFieldIds: unique(doctrineStep.source1Reuse.map((reuse) => reuse.fieldId)),
        source1OwnerKeys: unique(doctrineStep.source1Reuse.map((reuse) => reuse.ownerKey)),
        doctrineStepId: doctrineStep.stepId,
        doctrineOwnerKey: doctrineStep.source3LocalLogic.ownerTarget.ownerKey,
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

  return Source3HealthOverlaySchema.parse({
    sourceId: knowledgeOwnership.sourceId,
    status: "all-steps-green",
    packetContract: {
      routeFrom: "caller-contract",
      allowedPacketFamilies,
      requiredSourceFieldIds: [...source3Readiness.requiredSourceFieldIds],
      packetFamiliesUsed: unique(steps.flatMap((step) => step.provenance.packetFamilies)),
      supportingPackets,
    },
    steps,
  });
}