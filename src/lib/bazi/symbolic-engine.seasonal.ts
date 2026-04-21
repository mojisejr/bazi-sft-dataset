import type {
  CalculatedStateValue,
  ElementAnalysisValue,
  SeasonalInteractionValue,
} from "@/lib/bazi/schema-types";
import {
  DAY_MASTER_SEASONAL_NOUNS_TH,
  FIVE_ELEMENT_ORDER,
  MONTH_BRANCH_SEASONAL_PROFILE,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import type { SupportedElement } from "@/lib/bazi/symbolic-engine.types";

type ElementCounts = ElementAnalysisValue["totalCounts"];

function createEmptyCounts(): ElementCounts {
  return {
    wood: 0,
    fire: 0,
    earth: 0,
    metal: 0,
    water: 0,
  };
}

function resolveElementFromStem(stem: string): SupportedElement {
  const element = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];

  if (!element) {
    throw new Error(`Unsupported heavenly stem: ${stem}`);
  }

  return element;
}

function incrementCount(counts: ElementCounts, stem: string) {
  const element = resolveElementFromStem(stem);

  counts[element] += 1;
}

export const SEASONAL_METAPHOR_MATRIX: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(DAY_MASTER_SEASONAL_NOUNS_TH).map(([stem, noun]) => [
    stem,
    Object.fromEntries(
      Object.entries(MONTH_BRANCH_SEASONAL_PROFILE).map(([branch, profile]) => [
        branch,
        `${noun}ใน${profile.seasonLabel}`,
      ]),
    ),
  ]),
);

export function buildElementAnalysis(
  pillars: CalculatedStateValue["fourPillars"],
): ElementAnalysisValue {
  const visibleCounts = createEmptyCounts();
  const hiddenCounts = createEmptyCounts();

  for (const pillar of Object.values(pillars)) {
    incrementCount(visibleCounts, pillar.stem);

    for (const hiddenStem of pillar.hiddenStems ?? []) {
      incrementCount(hiddenCounts, hiddenStem);
    }
  }

  const totalCounts = createEmptyCounts();

  for (const element of FIVE_ELEMENT_ORDER) {
    totalCounts[element] = visibleCounts[element] + hiddenCounts[element];
  }

  const maxCount = Math.max(...Object.values(totalCounts));

  return {
    visibleCounts,
    hiddenCounts,
    totalCounts,
    missingElements: FIVE_ELEMENT_ORDER.filter((element) => totalCounts[element] === 0),
    dominantElements:
      maxCount > 0
        ? FIVE_ELEMENT_ORDER.filter((element) => totalCounts[element] === maxCount)
        : [],
  };
}

export function buildSeasonalInteraction(
  dayMasterStem: string,
  monthBranch: string,
): SeasonalInteractionValue {
  const profile = MONTH_BRANCH_SEASONAL_PROFILE[
    monthBranch as keyof typeof MONTH_BRANCH_SEASONAL_PROFILE
  ];
  const metaphor = SEASONAL_METAPHOR_MATRIX[dayMasterStem]?.[monthBranch];

  if (!profile || !metaphor) {
    throw new Error(
      `Unsupported seasonal interaction pair: dayMaster=${dayMasterStem}, monthBranch=${monthBranch}`,
    );
  }

  return {
    dayMasterStem,
    dayMasterElement: resolveElementFromStem(dayMasterStem),
    monthBranch,
    season: profile.season,
    phase: profile.phase,
    seasonLabel: profile.seasonLabel,
    metaphor,
  };
}