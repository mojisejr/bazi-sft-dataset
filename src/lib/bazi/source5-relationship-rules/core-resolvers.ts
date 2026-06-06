import type { BaziCallerContract } from "@/lib/bazi/symbolic-engine.caller-contract";
import type { BaziSharedPacket } from "@/lib/bazi/symbolic-engine.shared-packets";
import {
  RELATIONSHIP_POTENTIAL_BY_STRENGTH,
  RELATIONSHIP_REACTION_MEANINGS,
} from "@/lib/bazi/source5-relationship-rules/constants";
import {
  findPacket,
  getElementFromBranch,
  getElementFromStem,
  resolveReactionLane,
} from "@/lib/bazi/source5-relationship-rules/helpers";
import {
  Source5ReactionResultSchema,
  Source5RelationshipPotentialResultSchema,
} from "@/lib/bazi/source5-relationship-rules/schemas";
import type {
  Source5ReactionResult,
  Source5RelationshipPotentialResult,
  Source5RelationshipStepComputation,
} from "@/lib/bazi/source5-relationship-rules/schemas";

export function resolvePotentialResult(
  contract: BaziCallerContract,
  packets: readonly BaziSharedPacket[],
): Source5RelationshipStepComputation<Source5RelationshipPotentialResult> {
  const strengthPacket = findPacket(packets, "strength");
  const strengthState = strengthPacket.sections.profile.value.lookupState;
  const strengthBandId = strengthPacket.sections.profile.value.bandId;
  const tableEntry = strengthState === "อ่อนแอ"
    ? (strengthBandId === "very-weak"
      ? RELATIONSHIP_POTENTIAL_BY_STRENGTH["อ่อนแอ"].veryWeak
      : RELATIONSHIP_POTENTIAL_BY_STRENGTH["อ่อนแอ"].weak)
    : strengthState === "แข็งแรง/สมดุล"
      ? (strengthBandId === "strong"
        ? RELATIONSHIP_POTENTIAL_BY_STRENGTH["แข็งแรง/สมดุล"].strong
        : RELATIONSHIP_POTENTIAL_BY_STRENGTH["แข็งแรง/สมดุล"].balanced)
      : RELATIONSHIP_POTENTIAL_BY_STRENGTH["แข็งแรงมากเกินไป"].veryStrong;

  return {
    packetFamilies: ["strength"],
    result: Source5RelationshipPotentialResultSchema.parse({
      kind: "relationship-potential",
      ...tableEntry,
      inputs: {
        gender: contract.rawInput.gender,
        strengthBandId,
        strengthState,
      },
    }),
  };
}

export function resolveDayStemVsSpouseBaseResult(
  contract: BaziCallerContract,
): Source5RelationshipStepComputation<Source5ReactionResult> {
  const dayPillar = contract.sharedPacketSpine.chartIdentity.fourPillars.day;
  const dayMasterElement = getElementFromStem(dayPillar.stem);
  const spouseBaseElement = getElementFromBranch(dayPillar.branch);
  const reactionLane = resolveReactionLane(dayMasterElement, spouseBaseElement);

  return {
    packetFamilies: ["role-of-element"],
    result: Source5ReactionResultSchema.parse({
      kind: "spouse-base-reaction",
      reactionLane,
      ...RELATIONSHIP_REACTION_MEANINGS[reactionLane],
      inputs: {
        dayStem: dayPillar.stem,
        spouseBaseBranch: dayPillar.branch,
        dayMasterElement,
        spouseBaseElement,
      },
    }),
  };
}