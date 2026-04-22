import type {
  CalculatedStateValue,
  ElementAnalysisValue,
  ElementStrengthValue,
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
type ElementStrengths = ElementAnalysisValue["elementStrengths"];

const SEASONAL_SUPPORT_MATRIX: Record<
  SeasonalInteractionValue["season"],
  { peak: SupportedElement; support: SupportedElement }
> = {
  spring: { peak: "wood", support: "fire" },
  summer: { peak: "fire", support: "earth" },
  autumn: { peak: "metal", support: "water" },
  winter: { peak: "water", support: "wood" },
};

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

function resolveSeasonalSupport(
  element: SupportedElement,
  monthBranch: string,
): ElementStrengthValue["seasonalSupport"] {
  const season = MONTH_BRANCH_SEASONAL_PROFILE[
    monthBranch as keyof typeof MONTH_BRANCH_SEASONAL_PROFILE
  ]?.season;

  if (!season) {
    return "seasonal-drained";
  }

  const profile = SEASONAL_SUPPORT_MATRIX[season];

  if (profile.peak === element) {
    return "seasonal-peak";
  }

  if (profile.support === element) {
    return "seasonal-support";
  }

  return "seasonal-drained";
}

function resolveStrengthLevel(
  count: number,
  rooted: boolean,
  seasonalSupport: ElementStrengthValue["seasonalSupport"],
): ElementStrengthValue["strength"] {
  if (count === 0) {
    return "missing";
  }

  const supportScore =
    seasonalSupport === "seasonal-peak"
      ? 2
      : seasonalSupport === "seasonal-support"
        ? 1
        : 0;
  const score = count + (rooted ? 1 : 0) + supportScore;

  if (score >= 5) {
    return "strong";
  }

  if (score <= 2) {
    return "weak";
  }

  return "balanced";
}

function buildElementStrengths(
  monthBranch: string,
  hiddenCounts: ElementCounts,
  totalCounts: ElementCounts,
): ElementStrengths {
  return FIVE_ELEMENT_ORDER.map((element) => {
    const rooted = hiddenCounts[element] > 0;
    const seasonalSupport = resolveSeasonalSupport(element, monthBranch);

    return {
      element,
      rooted,
      seasonalSupport,
      strength: resolveStrengthLevel(totalCounts[element], rooted, seasonalSupport),
    };
  });
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
    elementStrengths: buildElementStrengths(pillars.month.branch, hiddenCounts, totalCounts),
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