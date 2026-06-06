import type { BaziCallerContract } from "@/lib/bazi/symbolic-engine.caller-contract";
import {
  BRANCH_TO_ELEMENT,
  ELEMENT_LABELS_TH,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import {
  HIDDEN_SPOUSE_RULES,
} from "@/lib/bazi/source5-relationship-rules/constants";
import {
  buildHiddenStemMatches,
  buildVisibleMatches,
  getBranchSymbolsForElement,
  getChartPillars,
  getElementFromStem,
  getStemSymbolsForElement,
  getTargetElementForRole,
  getTargetRoleForSpouse,
  lookupCheingsaeStage,
  summarizeQualityBand,
  unique,
} from "@/lib/bazi/source5-relationship-rules/helpers";
import {
  Source5RelationshipCheingsaeResultSchema,
  Source5SpouseLookupResultSchema,
} from "@/lib/bazi/source5-relationship-rules/schemas";
import type {
  Source5RelationshipCheingsaeResult,
  Source5RelationshipStepComputation,
  Source5SpouseLookupResult,
} from "@/lib/bazi/source5-relationship-rules/schemas";

export function resolveSpouseLookupResult(
  contract: BaziCallerContract,
): Source5RelationshipStepComputation<Source5SpouseLookupResult> {
  const pillars = getChartPillars(contract);
  const dayMaster = contract.sharedPacketSpine.chartIdentity.dayMaster;
  const genderKey = contract.rawInput.gender === "female" ? "female" : "male";
  const dayMasterElement = getElementFromStem(dayMaster);
  const targetRole = getTargetRoleForSpouse(contract.rawInput.gender);
  const spouseElement = getTargetElementForRole(dayMasterElement, targetRole);
  const directStemSymbols = getStemSymbolsForElement(spouseElement);
  const directBranchSymbols = getBranchSymbolsForElement(spouseElement);
  const hiddenRuleSymbols = HIDDEN_SPOUSE_RULES[genderKey][dayMaster as keyof typeof HIDDEN_SPOUSE_RULES[typeof genderKey]];
  const stemRuleSymbols = hiddenRuleSymbols.filter((symbol) => Boolean(STEM_TO_ELEMENT[symbol as keyof typeof STEM_TO_ELEMENT]));
  const branchRuleSymbols = hiddenRuleSymbols.filter((symbol) => Boolean(BRANCH_TO_ELEMENT[symbol as keyof typeof BRANCH_TO_ELEMENT]));
  const directStemMatches = buildVisibleMatches(pillars, "stem", directStemSymbols);
  const directBranchMatches = buildVisibleMatches(pillars, "branch", directBranchSymbols);
  const hiddenVisibleStemMatches = buildVisibleMatches(pillars, "stem", stemRuleSymbols);
  const hiddenVisibleBranchMatches = buildVisibleMatches(pillars, "branch", branchRuleSymbols);
  const hiddenStemMatches = buildHiddenStemMatches(pillars, stemRuleSymbols);
  const hasDirectMatch = directStemMatches.length > 0 || directBranchMatches.length > 0;
  const hasHiddenMatch = hiddenVisibleStemMatches.length > 0 || hiddenVisibleBranchMatches.length > 0 || hiddenStemMatches.length > 0;
  const presenceMode = hasDirectMatch ? "direct-present" : hasHiddenMatch ? "hidden-only" : "absent";

  return {
    packetFamilies: ["strength", "role-of-element"],
    result: Source5SpouseLookupResultSchema.parse({
      kind: "spouse-element-lookup",
      targetRole,
      spouseElement,
      spouseElementLabel: ELEMENT_LABELS_TH[spouseElement],
      directRules: {
        stemSymbols: directStemSymbols,
        branchSymbols: directBranchSymbols,
      },
      directMatches: {
        stems: directStemMatches,
        branches: directBranchMatches,
      },
      hiddenRules: {
        symbols: hiddenRuleSymbols,
      },
      hiddenMatches: {
        visibleStems: hiddenVisibleStemMatches,
        visibleBranches: hiddenVisibleBranchMatches,
        hiddenStems: hiddenStemMatches,
      },
      presenceMode,
      fallbackToSpouseBaseCheingsae: presenceMode === "absent",
    }),
  };
}

export function resolveCheingsaeResult(
  contract: BaziCallerContract,
  spouseLookup: Source5SpouseLookupResult,
): Source5RelationshipStepComputation<Source5RelationshipCheingsaeResult> {
  const dayMaster = contract.sharedPacketSpine.chartIdentity.dayMaster;
  const spouseBaseBranch = contract.sharedPacketSpine.chartIdentity.fourPillars.day.branch;
  const spouseBaseStage = lookupCheingsaeStage(dayMaster, spouseBaseBranch);
  const hiddenBranchCandidates = unique(
    spouseLookup.hiddenRules.symbols.filter((symbol) => Boolean(BRANCH_TO_ELEMENT[symbol as keyof typeof BRANCH_TO_ELEMENT])),
  );
  const selectedBranches = spouseLookup.presenceMode === "direct-present"
    ? spouseLookup.directRules.branchSymbols
    : spouseLookup.presenceMode === "hidden-only"
      ? (hiddenBranchCandidates.length > 0 ? hiddenBranchCandidates : [spouseBaseBranch])
      : [spouseBaseBranch];
  const spouseElementStages = unique(spouseLookup.directRules.branchSymbols).map((branch) => lookupCheingsaeStage(dayMaster, branch));
  const selectedStages = unique(selectedBranches).map((branch) => lookupCheingsaeStage(dayMaster, branch));

  return {
    packetFamilies: [],
    result: Source5RelationshipCheingsaeResultSchema.parse({
      kind: "relationship-12-cheingsae",
      source: "pillar-display.resolveCanonicalTwelveQiStage",
      selectedLane: spouseLookup.presenceMode === "direct-present"
        ? "direct-spouse-branch"
        : spouseLookup.presenceMode === "hidden-only"
          ? "hidden-spouse-branch"
          : "spouse-base-fallback",
      spouseBaseStage,
      spouseElementStages,
      selectedStages,
      qualityBand: summarizeQualityBand(selectedStages),
    }),
  };
}