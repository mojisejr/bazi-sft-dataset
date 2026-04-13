import {
  calculateBaziStructuralState,
  type BaziStructuralState,
} from "@/lib/bazi/symbolic-engine";
import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";

const STRUCTURAL_PILLAR_KEYS = ["year", "month", "day", "hour"] as const;

function formatPillarCode(pillar: BaziStructuralState["fourPillars"][keyof BaziStructuralState["fourPillars"]]) {
  return `${pillar.stem}${pillar.branch}`;
}

function normalizeHiddenStems(hiddenStems: readonly string[] | undefined) {
  return JSON.stringify(hiddenStems ?? []);
}

export function collectCalculatedStateIntegrityIssues(
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
) {
  const expectedState = calculateBaziStructuralState(rawInput);
  const issues: string[] = [];

  for (const pillarKey of STRUCTURAL_PILLAR_KEYS) {
    const expectedPillar = expectedState.fourPillars[pillarKey];
    const actualPillar = calculatedState.fourPillars[pillarKey];

    if (
      expectedPillar.stem !== actualPillar.stem
      || expectedPillar.branch !== actualPillar.branch
    ) {
      issues.push(
        `calculatedState.fourPillars.${pillarKey} must match rawInput (${formatPillarCode(expectedPillar)} expected, received ${formatPillarCode(actualPillar)}).`,
      );
      continue;
    }

    if (
      normalizeHiddenStems(expectedPillar.hiddenStems)
      !== normalizeHiddenStems(actualPillar.hiddenStems)
    ) {
      issues.push(
        `calculatedState.fourPillars.${pillarKey}.hiddenStems must match rawInput (${(expectedPillar.hiddenStems ?? []).join(", ")} expected).`,
      );
    }
  }

  if (expectedState.dayMaster !== calculatedState.dayMaster) {
    issues.push(
      `calculatedState.dayMaster must match rawInput (${expectedState.dayMaster} expected, received ${calculatedState.dayMaster}).`,
    );
  }

  return issues;
}