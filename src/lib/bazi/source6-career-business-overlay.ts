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
  buildSource6CareerBusinessDoctrine,
  SOURCE6_CAREER_BUSINESS_STEP_IDS,
  SOURCE6_TERMINOLOGY_IDS,
} from "@/lib/bazi/source6-career-business-doctrine";
import {
  buildSource6CareerBusinessStepResult,
  Source6CareerBusinessStepResultSchema,
} from "@/lib/bazi/source6-career-business-rules";
import {
  buildSource6KnowledgeOwnership,
  getSource6KnowledgeOwnershipForStep,
  SOURCE6_SURFACE_REUSE_VERDICTS,
} from "@/lib/bazi/source6-knowledge-ownership";
import { SOURCE1_CONTRACT_FIELD_IDS } from "@/lib/bazi/source1-operating-system-contract";

const Source1ContractFieldIdSchema = z.enum(SOURCE1_CONTRACT_FIELD_IDS);
const Source6CareerBusinessStepIdSchema = z.enum(SOURCE6_CAREER_BUSINESS_STEP_IDS);
const Source6TerminologyIdSchema = z.enum(SOURCE6_TERMINOLOGY_IDS);
const Source6SurfaceReuseVerdictSchema = z.enum(SOURCE6_SURFACE_REUSE_VERDICTS);

const Source6OverlayStatusSchema = z.enum(["all-steps-green"]);
const Source6StepStatusSchema = z.enum(["green"]);

const Source6RuntimeOwnerSchema = z.object({
  module: z.string().trim().min(1),
  ownerKey: z.string().trim().min(1),
  status: z.enum(["existing-owner", "new-owner-required", "gap-classified"]),
  phase2RuntimeOwnerKey: z.string().trim().min(1),
  note: z.string().trim().min(1),
});

const Source6KnowledgeOwnershipProvenanceSchema = z.object({
  surfaceReuseVerdict: Source6SurfaceReuseVerdictSchema,
  primaryOwnerKeys: z.array(z.string().trim().min(1)).min(1),
  requiresNewCanonicalTables: z.array(z.string().trim().min(1)),
  ownerSeparation: z.array(z.string().trim().min(1)).min(1),
});

const Source6StepProvenanceSchema = z.object({
  routeFrom: z.literal("caller-contract"),
  packetFamilies: z.array(BaziSharedPacketFamilySchema),
  sourceFieldIds: z.array(Source1ContractFieldIdSchema).min(1),
  source1OwnerKeys: z.array(z.string().trim().min(1)).min(1),
  doctrineStepId: Source6CareerBusinessStepIdSchema,
  doctrineOwnerKey: z.string().trim().min(1),
  terminologyIds: z.array(Source6TerminologyIdSchema).min(1),
  knowledgeOwnership: Source6KnowledgeOwnershipProvenanceSchema,
});

const Source6CareerBusinessOverlayStepSchema = z.object({
  stepId: Source6CareerBusinessStepIdSchema,
  manualStep: z.number().int().min(1).max(8),
  label: z.string().trim().min(1),
  status: Source6StepStatusSchema,
  runtimeOwner: Source6RuntimeOwnerSchema,
  provenance: Source6StepProvenanceSchema,
  result: Source6CareerBusinessStepResultSchema,
});

export const Source6CareerBusinessOverlaySchema = z.object({
  sourceId: z.literal("source-6"),
  status: Source6OverlayStatusSchema,
  packetContract: z.object({
    routeFrom: z.literal("caller-contract"),
    allowedPacketFamilies: z.array(BaziSharedPacketFamilySchema).min(1),
    requiredSourceFieldIds: z.array(Source1ContractFieldIdSchema).min(1),
    packetFamiliesUsed: z.array(BaziSharedPacketFamilySchema).min(1),
    supportingPackets: z.array(BaziSharedPacketSchema).min(1),
  }),
  steps: z.array(Source6CareerBusinessOverlayStepSchema).length(SOURCE6_CAREER_BUSINESS_STEP_IDS.length),
});

export type Source6CareerBusinessOverlay = z.infer<typeof Source6CareerBusinessOverlaySchema>;

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function getSource6ReadinessStep(contract: BaziCallerContract) {
  const source6Step = contract.overlayReadiness.steps.find((step) => step.sourceId === "source-6");

  if (!source6Step || source6Step.handoffStatus !== "ready") {
    throw new Error("Bazi caller contract is not ready for the Source 6 overlay.");
  }

  return source6Step;
}

function getSource6SupportingPackets(
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
    throw new Error(`Source 6 overlay is missing caller-contract packets: ${missingFamilies.join(", ")}`);
  }

  return supportingPackets;
}

export function buildSource6CareerBusinessOverlay(contractInput: BaziCallerContract): Source6CareerBusinessOverlay {
  const contract = BaziCallerContractSchema.parse(contractInput);
  const doctrine = buildSource6CareerBusinessDoctrine();
  const knowledgeOwnership = buildSource6KnowledgeOwnership();
  const source6Readiness = getSource6ReadinessStep(contract);
  const allowedPacketFamilies = [...source6Readiness.requiredPacketFamilies];
  const supportingPackets = getSource6SupportingPackets(contract, allowedPacketFamilies);

  const steps = doctrine.steps.map((doctrineStep) => {
    const stepOwnership = getSource6KnowledgeOwnershipForStep(doctrineStep.stepId);
    const computedStep = buildSource6CareerBusinessStepResult(doctrineStep.stepId, supportingPackets, contract);

    return {
      stepId: doctrineStep.stepId,
      manualStep: doctrineStep.manualStep,
      label: doctrineStep.label,
      status: "green",
      runtimeOwner: {
        module: doctrineStep.source6LocalLogic.ownerTarget.module,
        ownerKey: doctrineStep.source6LocalLogic.ownerTarget.ownerKey,
        status: doctrineStep.source6LocalLogic.ownerTarget.status,
        phase2RuntimeOwnerKey: stepOwnership.phase2RuntimeOwner.ownerKey,
        note: stepOwnership.phase2RuntimeOwner.note,
      },
      provenance: {
        routeFrom: "caller-contract",
        packetFamilies: computedStep.packetFamilies,
        sourceFieldIds: unique(doctrineStep.source1Reuse.map((reuse) => reuse.fieldId)),
        source1OwnerKeys: unique(doctrineStep.source1Reuse.map((reuse) => reuse.ownerKey)),
        doctrineStepId: doctrineStep.stepId,
        doctrineOwnerKey: doctrineStep.source6LocalLogic.ownerTarget.ownerKey,
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

  return Source6CareerBusinessOverlaySchema.parse({
    sourceId: knowledgeOwnership.sourceId,
    status: "all-steps-green",
    packetContract: {
      routeFrom: "caller-contract",
      allowedPacketFamilies,
      requiredSourceFieldIds: [...source6Readiness.requiredSourceFieldIds],
      packetFamiliesUsed: unique(steps.flatMap((step) => step.provenance.packetFamilies)),
      supportingPackets,
    },
    steps,
  });
}