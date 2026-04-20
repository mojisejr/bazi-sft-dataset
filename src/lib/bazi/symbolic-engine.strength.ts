import type {
  CalculatedStateValue,
  ExplainableValue,
} from "@/lib/bazi/schema-types";
import {
  BASE_STRENGTH_OFFSET,
  CONTROLS,
  GENERATES,
  STAGE_POSITION_WEIGHTS,
  STAGE_WEIGHT_NORMALIZER,
  STAGE_WEIGHTS,
  STEM_METAPHORS,
  STEM_TO_ELEMENT,
  SUPPORT_ELEMENT_METAPHORS,
} from "@/lib/bazi/symbolic-engine.constants";
import type {
  BranchInteractionResolution,
  StrengthScoreBreakdown,
  StrengthStageSnapshot,
  SupportedElement,
} from "@/lib/bazi/symbolic-engine.types";
import {
  TRACE_RULE_NAMES,
  TRACE_STEP_KEYS,
} from "@/lib/bazi/trace-keys";

function getElement(stem: string): SupportedElement {
  const element = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];

  if (!element) {
    throw new Error(`Unsupported heavenly stem: ${stem}`);
  }

  return element;
}

function relationWeight(
  dayMasterElement: SupportedElement,
  candidateElement: SupportedElement,
  hidden = false,
) {
  const supportWeight = hidden ? 0.12 : 0.35;
  const resourceWeight = hidden ? 0.1 : 0.3;
  const outputWeight = hidden ? -0.06 : -0.15;
  const wealthWeight = hidden ? -0.08 : -0.2;
  const officerWeight = hidden ? -0.12 : -0.35;

  if (candidateElement === dayMasterElement) {
    return supportWeight;
  }

  if (GENERATES[candidateElement] === dayMasterElement) {
    return resourceWeight;
  }

  if (GENERATES[dayMasterElement] === candidateElement) {
    return outputWeight;
  }

  if (CONTROLS[dayMasterElement] === candidateElement) {
    return wealthWeight;
  }

  if (CONTROLS[candidateElement] === dayMasterElement) {
    return officerWeight;
  }

  return 0;
}

function getStageStrengthWeight(stageName: string) {
  return STAGE_WEIGHTS[stageName as keyof typeof STAGE_WEIGHTS] ?? 1;
}

function computeStrengthScoreBreakdown(
  dayMasterStem: string,
  pillars: CalculatedStateValue["fourPillars"],
  stages: StrengthStageSnapshot,
  interactionResolution: BranchInteractionResolution,
): StrengthScoreBreakdown {
  const dayMasterElement = getElement(dayMasterStem);
  const stageContribution =
    (getStageStrengthWeight(stages.year) * STAGE_POSITION_WEIGHTS.year +
      getStageStrengthWeight(stages.month) *
        STAGE_POSITION_WEIGHTS.month *
        interactionResolution.monthBranchSeasonalFactor +
      getStageStrengthWeight(stages.day) * STAGE_POSITION_WEIGHTS.day +
      getStageStrengthWeight(stages.hour) * STAGE_POSITION_WEIGHTS.hour) /
    STAGE_WEIGHT_NORMALIZER;
  let score = BASE_STRENGTH_OFFSET + stageContribution;

  const visibleContributions = [
    {
      label: "yearStem",
      stem: pillars.year.stem,
      hidden: false,
      weight: relationWeight(dayMasterElement, getElement(pillars.year.stem)),
    },
    {
      label: "monthStem",
      stem: pillars.month.stem,
      hidden: false,
      weight: relationWeight(dayMasterElement, getElement(pillars.month.stem)),
    },
    {
      label: "hourStem",
      stem: pillars.hour.stem,
      hidden: false,
      weight: relationWeight(dayMasterElement, getElement(pillars.hour.stem)),
    },
  ];

  for (const contribution of visibleContributions) {
    score += contribution.weight;
  }

  const hiddenContributions = [
    ...((pillars.year.hiddenStems ?? []).map((stem, index) => ({
      label: `yearHiddenStem${index + 1}`,
      stem,
      hidden: true,
      weight: relationWeight(dayMasterElement, getElement(stem), true),
    }))),
    ...((pillars.month.hiddenStems ?? []).map((stem, index) => ({
      label: `monthHiddenStem${index + 1}`,
      stem,
      hidden: true,
      weight: relationWeight(dayMasterElement, getElement(stem), true),
    }))),
    ...((pillars.day.hiddenStems ?? []).map((stem, index) => ({
      label: `dayHiddenStem${index + 1}`,
      stem,
      hidden: true,
      weight: relationWeight(dayMasterElement, getElement(stem), true),
    }))),
    ...((pillars.hour.hiddenStems ?? []).map((stem, index) => ({
      label: `hourHiddenStem${index + 1}`,
      stem,
      hidden: true,
      weight: relationWeight(dayMasterElement, getElement(stem), true),
    }))),
  ];

  for (const contribution of hiddenContributions) {
    score += contribution.weight;
  }

  const penalties = {
    clashes: interactionResolution.activeClashes.length * 0.18,
    punishments: interactionResolution.activePunishments.length * 0.08,
    harms:
      interactionResolution.activeCombinations.length === 0 &&
      interactionResolution.activeClashes.length === 0
        ? interactionResolution.activeHarms.length * 0.05
        : 0,
    destructions:
      interactionResolution.activeCombinations.length === 0 &&
      interactionResolution.activeClashes.length === 0
        ? interactionResolution.activeDestructions.length * 0.05
        : 0,
  };

  score -= penalties.clashes;
  score -= penalties.punishments;
  score -= penalties.harms;
  score -= penalties.destructions;

  return {
    score: Number(score.toFixed(2)),
    stageContribution,
    visibleContributions,
    hiddenContributions,
    penalties,
  };
}

export function buildStrengthScoreExplainable(
  dayMasterStem: string,
  pillars: CalculatedStateValue["fourPillars"],
  stages: StrengthStageSnapshot,
  interactionResolution: BranchInteractionResolution,
): ExplainableValue<number> {
  const breakdown = computeStrengthScoreBreakdown(
    dayMasterStem,
    pillars,
    stages,
    interactionResolution,
  );

  return {
    value: breakdown.score,
    trace: {
      engine: "orthodox-override",
      ruleName: TRACE_RULE_NAMES.strengthScore,
      steps: [],
      stepKeys: [
        TRACE_STEP_KEYS.strengthScore.weightStages,
        TRACE_STEP_KEYS.strengthScore.addRelations,
        TRACE_STEP_KEYS.strengthScore.applyPenalties,
      ],
      rawVariables: {
        dayMasterStem,
        stages,
        stageContribution: Number(breakdown.stageContribution.toFixed(4)),
        monthBranchSeasonalFactor: interactionResolution.monthBranchSeasonalFactor,
        activeCombinations: interactionResolution.activeCombinations,
        activeClashes: interactionResolution.activeClashes,
        activePunishments: interactionResolution.activePunishments,
        activeHarms: interactionResolution.activeHarms,
        activeDestructions: interactionResolution.activeDestructions,
        visibleContributions: breakdown.visibleContributions,
        hiddenContributions: breakdown.hiddenContributions,
        penalties: breakdown.penalties,
        result: breakdown.score,
      },
    },
  };
}

export function buildElementMetaphors(dayMasterStem: string) {
  const dayMasterElement = getElement(dayMasterStem);
  const resourceElement = Object.entries(GENERATES).find(([, produced]) => produced === dayMasterElement)?.[0];

  return [
    {
      element: dayMasterElement,
      metaphor: STEM_METAPHORS[dayMasterStem as keyof typeof STEM_METAPHORS],
    },
    ...(resourceElement
      ? [
          {
            element: resourceElement,
            metaphor:
              SUPPORT_ELEMENT_METAPHORS[
                resourceElement as keyof typeof SUPPORT_ELEMENT_METAPHORS
              ],
          },
        ]
      : []),
  ];
}
