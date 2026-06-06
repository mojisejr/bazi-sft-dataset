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
  buildSource5KnowledgeOwnership,
  getSource5KnowledgeOwnershipForStep,
  SOURCE5_REPOSITORY_REUSE_VERDICTS,
} from "@/lib/bazi/source5-knowledge-ownership";
import {
  buildSource5RelationshipDoctrine,
  SOURCE5_RELATIONSHIP_STEP_IDS,
  SOURCE5_TERMINOLOGY_IDS,
} from "@/lib/bazi/source5-relationship-doctrine";
import { SOURCE1_CONTRACT_FIELD_IDS } from "@/lib/bazi/source1-operating-system-contract";
import {
  Source5RelationshipStepResultSchema,
  buildSource5RelationshipStepResult,
} from "@/lib/bazi/source5-relationship-rules";

const Source1ContractFieldIdSchema = z.enum(SOURCE1_CONTRACT_FIELD_IDS);
const Source5RelationshipStepIdSchema = z.enum(SOURCE5_RELATIONSHIP_STEP_IDS);
const Source5TerminologyIdSchema = z.enum(SOURCE5_TERMINOLOGY_IDS);
const Source5RepositoryReuseVerdictSchema = z.enum(SOURCE5_REPOSITORY_REUSE_VERDICTS);

const Source5OverlayStatusSchema = z.enum(["all-steps-green"]);
const Source5StepStatusSchema = z.enum(["green"]);

const Source5RuntimeOwnerSchema = z.object({
  module: z.string().trim().min(1),
  ownerKey: z.string().trim().min(1),
  status: z.enum(["existing-owner", "new-owner-required", "gap-classified"]),
  phase3RuntimeOwnerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source5KnowledgeOwnershipProvenanceSchema = z.object({
  repositoryReuseVerdict: Source5RepositoryReuseVerdictSchema,
  primaryOwnerKeys: z.array(z.string().trim().min(1)).min(1),
  requiresNewCanonicalTables: z.array(z.string().trim().min(1)),
  ownerSeparation: z.array(z.string().trim().min(1)).min(1),
});

const Source5StepProvenanceSchema = z.object({
  routeFrom: z.literal("caller-contract"),
  packetFamilies: z.array(BaziSharedPacketFamilySchema),
  sourceFieldIds: z.array(Source1ContractFieldIdSchema).min(1),
  source1OwnerKeys: z.array(z.string().trim().min(1)).min(1),
  doctrineStepId: Source5RelationshipStepIdSchema,
  doctrineOwnerKey: z.string().trim().min(1),
  terminologyIds: z.array(Source5TerminologyIdSchema).min(1),
  knowledgeOwnership: Source5KnowledgeOwnershipProvenanceSchema,
});

const Source5RelationshipOverlayStepSchema = z.object({
  stepId: Source5RelationshipStepIdSchema,
  manualStep: z.number().int().min(1).max(7),
  label: z.string().trim().min(1),
  status: Source5StepStatusSchema,
  runtimeOwner: Source5RuntimeOwnerSchema,
  provenance: Source5StepProvenanceSchema,
  result: Source5RelationshipStepResultSchema,
});

export const Source5RelationshipOverlaySchema = z.object({
  sourceId: z.literal("source-5"),
  status: Source5OverlayStatusSchema,
  packetContract: z.object({
    routeFrom: z.literal("caller-contract"),
    allowedPacketFamilies: z.array(BaziSharedPacketFamilySchema).min(1),
    requiredSourceFieldIds: z.array(Source1ContractFieldIdSchema).min(1),
    packetFamiliesUsed: z.array(BaziSharedPacketFamilySchema).min(1),
    supportingPackets: z.array(BaziSharedPacketSchema).min(1),
  }),
  steps: z.array(Source5RelationshipOverlayStepSchema).length(SOURCE5_RELATIONSHIP_STEP_IDS.length),
});

export type Source5RelationshipOverlay = z.infer<typeof Source5RelationshipOverlaySchema>;

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function getSource5ReadinessStep(contract: BaziCallerContract) {
  const source5Step = contract.overlayReadiness.steps.find((step) => step.sourceId === "source-5");

  if (!source5Step || source5Step.handoffStatus !== "ready") {
    throw new Error("Bazi caller contract is not ready for the Source 5 overlay.");
  }

  return source5Step;
}

function getSource5SupportingPackets(
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
    throw new Error(`Source 5 overlay is missing caller-contract packets: ${missingFamilies.join(", ")}`);
  }

  return supportingPackets;
}

export function buildSource5RelationshipOverlay(contractInput: BaziCallerContract): Source5RelationshipOverlay {
  const contract = BaziCallerContractSchema.parse(contractInput);
  const doctrine = buildSource5RelationshipDoctrine();
  const knowledgeOwnership = buildSource5KnowledgeOwnership();
  const source5Readiness = getSource5ReadinessStep(contract);
  const allowedPacketFamilies = [...source5Readiness.requiredPacketFamilies];
  const supportingPackets = getSource5SupportingPackets(contract, allowedPacketFamilies);

  const steps = doctrine.steps.map((doctrineStep) => {
    const stepOwnership = getSource5KnowledgeOwnershipForStep(doctrineStep.stepId);
    const computedStep = buildSource5RelationshipStepResult(doctrineStep.stepId, supportingPackets, contract);

    return {
      stepId: doctrineStep.stepId,
      manualStep: doctrineStep.manualStep,
      label: doctrineStep.label,
      status: "green",
      runtimeOwner: {
        module: doctrineStep.source5LocalLogic.ownerTarget.module,
        ownerKey: doctrineStep.source5LocalLogic.ownerTarget.ownerKey,
        status: doctrineStep.source5LocalLogic.ownerTarget.status,
        phase3RuntimeOwnerKey: stepOwnership.phase3RuntimeOwner.ownerKey,
        note: stepOwnership.phase3RuntimeOwner.note,
      },
      provenance: {
        routeFrom: "caller-contract",
        packetFamilies: computedStep.packetFamilies,
        sourceFieldIds: unique(doctrineStep.source1Reuse.map((reuse) => reuse.fieldId)),
        source1OwnerKeys: unique(doctrineStep.source1Reuse.map((reuse) => reuse.ownerKey)),
        doctrineStepId: doctrineStep.stepId,
        doctrineOwnerKey: doctrineStep.source5LocalLogic.ownerTarget.ownerKey,
        terminologyIds: doctrineStep.terminologyIds,
        knowledgeOwnership: {
          repositoryReuseVerdict: stepOwnership.currentRepositoryReuse.verdict,
          primaryOwnerKeys: stepOwnership.primaryOwners.map((owner) => owner.ownerKey),
          requiresNewCanonicalTables: stepOwnership.requiresNewCanonicalOwners.map((gap) => gap.tableName),
          ownerSeparation: stepOwnership.ownerSeparation,
        },
      },
      result: computedStep.result,
    };
  });

  return Source5RelationshipOverlaySchema.parse({
    sourceId: knowledgeOwnership.sourceId,
    status: "all-steps-green",
    packetContract: {
      routeFrom: "caller-contract",
      allowedPacketFamilies,
      requiredSourceFieldIds: [...source5Readiness.requiredSourceFieldIds],
      packetFamiliesUsed: unique(steps.flatMap((step) => step.provenance.packetFamilies)),
      supportingPackets,
    },
    steps,
  });
}