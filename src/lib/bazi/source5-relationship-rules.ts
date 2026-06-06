import type { BaziCallerContract } from "@/lib/bazi/symbolic-engine.caller-contract";
import type { BaziSharedPacket } from "@/lib/bazi/symbolic-engine.shared-packets";
import {
  resolveConflictImpactResult,
  resolveMarriageTimingResult,
} from "@/lib/bazi/source5-relationship-rules/conflict-timing-resolvers";
import {
  resolveDayStemVsSpouseBaseResult,
  resolvePotentialResult,
} from "@/lib/bazi/source5-relationship-rules/core-resolvers";
import type {
  Source5RelationshipStepComputation,
  Source5StepId,
} from "@/lib/bazi/source5-relationship-rules/schemas";
import {
  resolveCheingsaeResult,
  resolveSpouseLookupResult,
} from "@/lib/bazi/source5-relationship-rules/spouse-resolvers";
import { resolveSpecialRulesResult } from "@/lib/bazi/source5-relationship-rules/special-rule-resolvers";

export { Source5RelationshipStepResultSchema } from "@/lib/bazi/source5-relationship-rules/schemas";
export type { Source5RelationshipStepResult } from "@/lib/bazi/source5-relationship-rules/schemas";

export function buildSource5RelationshipStepResult(
  stepId: Source5StepId,
  packets: readonly BaziSharedPacket[],
  contract: BaziCallerContract,
): Source5RelationshipStepComputation {
  if (stepId === "step-1-relationship-potential") {
    return resolvePotentialResult(contract, packets);
  }

  if (stepId === "step-2-day-stem-vs-spouse-base") {
    return resolveDayStemVsSpouseBaseResult(contract);
  }

  const spouseLookup = resolveSpouseLookupResult(contract).result;

  if (stepId === "step-3-spouse-element-lookup") {
    return {
      packetFamilies: ["strength", "role-of-element"],
      result: spouseLookup,
    };
  }

  const cheingsae = resolveCheingsaeResult(contract, spouseLookup).result;

  if (stepId === "step-4-relationship-12-cheingsae") {
    return {
      packetFamilies: [],
      result: cheingsae,
    };
  }

  const conflictImpact = resolveConflictImpactResult(contract, packets).result;

  if (stepId === "step-5-conflict-and-interaction") {
    return {
      packetFamilies: ["conflict-context"],
      result: conflictImpact,
    };
  }

  if (stepId === "step-6-marriage-timing") {
    return resolveMarriageTimingResult(contract, packets);
  }

  return resolveSpecialRulesResult(contract, spouseLookup, cheingsae, conflictImpact);
}