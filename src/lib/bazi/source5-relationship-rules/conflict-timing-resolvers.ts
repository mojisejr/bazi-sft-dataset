import type { BaziCallerContract } from "@/lib/bazi/symbolic-engine.caller-contract";
import type { BaziSharedPacket } from "@/lib/bazi/symbolic-engine.shared-packets";
import { ELEMENT_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";
import {
  buildConflictMeaning,
  categorizeConflictFamily,
  dedupeWindowAssessments,
  findPacket,
  getAudienceLabels,
  getElementFromBranch,
  getElementFromStem,
  getTargetElementForRole,
  lookupCheingsaeStage,
  unique,
} from "@/lib/bazi/source5-relationship-rules/helpers";
import {
  Source5ConflictImpactResultSchema,
  Source5MarriageTimingResultSchema,
  Source5TimingWindowAssessmentSchema,
} from "@/lib/bazi/source5-relationship-rules/schemas";
import type {
  Source5ConflictImpactResult,
  Source5MarriageTimingResult,
  Source5PillarKey,
  Source5RelationshipStepComputation,
  Source5TimingRoleTarget,
} from "@/lib/bazi/source5-relationship-rules/schemas";

export function resolveConflictImpactResult(
  contract: BaziCallerContract,
  packets: readonly BaziSharedPacket[],
): Source5RelationshipStepComputation<Source5ConflictImpactResult> {
  const conflictPacket = findPacket(packets, "conflict-context");
  const consequences = conflictPacket.sections.contextMap.value
    .filter((item) => item.participants.some((participant) => participant.pillarKey === "day"))
    .map((item) => {
      const relationType = categorizeConflictFamily(item.familyKey);
      const affectedPillars = unique(
        item.participants
          .map((participant) => participant.pillarKey)
          .filter((pillarKey): pillarKey is Source5PillarKey => pillarKey === "year" || pillarKey === "month" || pillarKey === "day" || pillarKey === "hour"),
      );
      const audiences = unique(affectedPillars.flatMap((pillarKey) => getAudienceLabels(relationType, pillarKey)));
      const consequence = buildConflictMeaning(relationType, affectedPillars);

      return {
        relationId: item.relationId,
        familyKey: item.familyKey,
        relationType,
        precedence: item.precedence ?? null,
        status: item.status,
        affectedPillars,
        audiences,
        consequenceKey: consequence.consequenceKey,
        meaning: consequence.meaning,
      };
    });
  const activeRelationCounts = {
    combinations: conflictPacket.sections.resolution.value.activeCombinations.length,
    clashes: conflictPacket.sections.resolution.value.activeClashes.length,
    punishments: conflictPacket.sections.resolution.value.activePunishments.length,
    harms: conflictPacket.sections.resolution.value.activeHarms.length,
    destructions: conflictPacket.sections.resolution.value.activeDestructions.length,
  };
  const pressureScore = activeRelationCounts.clashes + activeRelationCounts.punishments + activeRelationCounts.destructions;

  return {
    packetFamilies: ["conflict-context"],
    result: Source5ConflictImpactResultSchema.parse({
      kind: "relationship-conflict-impact",
      precedenceNotes: conflictPacket.sections.resolution.value.precedenceNotes,
      activeRelationCounts,
      relationshipPressure: pressureScore >= 2 ? "elevated" : pressureScore >= 1 ? "active" : "low",
      consequences,
    }),
  };
}

function buildTimingRoleTargets(contract: BaziCallerContract, packets: readonly BaziSharedPacket[]) {
  const strengthPacket = findPacket(packets, "strength");
  const lookupState = strengthPacket.sections.profile.value.lookupState;
  const dayMasterElement = getElementFromStem(contract.sharedPacketSpine.chartIdentity.dayMaster);
  const targetRoles = lookupState === "แข็งแรงมากเกินไป"
    ? ["output"] as const
    : lookupState === "แข็งแรง/สมดุล"
      ? [contract.rawInput.gender === "female" ? "power" : "wealth"] as const
      : ["parallel", "resource"] as const;

  return {
    lookupState,
    targets: targetRoles.map((role) => {
      const targetElement = getTargetElementForRole(dayMasterElement, role);

      return {
        role,
        targetElement,
        targetElementLabel: ELEMENT_LABELS_TH[targetElement],
      };
    }),
  };
}

function assessTimingWindow(
  dayMaster: string,
  pillar: { stem: string; branch: string; startAge: number; endAge: number },
  targetRoles: Source5TimingRoleTarget[],
) {
  const stemElement = getElementFromStem(pillar.stem);
  const branchElement = getElementFromBranch(pillar.branch);
  const matchedRoles = targetRoles
    .filter((target) => target.targetElement === stemElement || target.targetElement === branchElement)
    .map((target) => target.role);
  const cheingsae = lookupCheingsaeStage(dayMaster, pillar.branch);
  const timingSignal = matchedRoles.length > 0 && cheingsae.qualityBand === "favorable"
    ? "prime-window" as const
    : matchedRoles.length > 0 || cheingsae.qualityBand === "favorable"
      ? "supportive-window" as const
      : "background-window" as const;

  return Source5TimingWindowAssessmentSchema.parse({
    pillarCode: `${pillar.stem}${pillar.branch}`,
    startAge: pillar.startAge,
    endAge: pillar.endAge,
    stemElement,
    branchElement,
    matchedRoles,
    cheingsae,
    timingSignal,
  });
}

export function resolveMarriageTimingResult(
  contract: BaziCallerContract,
  packets: readonly BaziSharedPacket[],
): Source5RelationshipStepComputation<Source5MarriageTimingResult> {
  const timingPacket = findPacket(packets, "timing");
  const { lookupState, targets } = buildTimingRoleTargets(contract, packets);
  const currentDaYun = timingPacket.sections.currentWindow.value.currentDaYun;
  const projectedWindows = dedupeWindowAssessments(
    timingPacket.sections.nextWindows.value.map((window) => assessTimingWindow(contract.sharedPacketSpine.chartIdentity.dayMaster, window, targets)),
  );

  return {
    packetFamilies: ["timing", "strength", "role-of-element"],
    result: Source5MarriageTimingResultSchema.parse({
      kind: "marriage-timing",
      targetRoles: targets,
      strengthState: lookupState,
      thaiAge: timingPacket.sections.currentWindow.value.ageSnapshot.thaiAge,
      currentWindow: currentDaYun
        ? assessTimingWindow(contract.sharedPacketSpine.chartIdentity.dayMaster, currentDaYun, targets)
        : null,
      projectedWindows,
    }),
  };
}