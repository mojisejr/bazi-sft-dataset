import type {
  CalculatedStateValue,
  PillarValue,
} from "@/lib/bazi/schema-types";

import {
  BRANCH_ORDER,
  CLASH_PAIRS,
  DESTRUCTION_PAIRS,
  HARM_PAIRS,
  MONTH_SEASONAL_CLASH_FACTOR,
  PUNISHMENT_PAIR_KEYS,
  PUNISHMENT_TRIOS,
  SELF_PUNISHMENT_BRANCHES,
  SIX_COMBINATION_PAIRS,
} from "@/lib/bazi/symbolic-engine.constants";
import type {
  BranchInteractionResolution,
  MultiBranchInteraction,
  PairInteraction,
  PillarKey,
} from "@/lib/bazi/symbolic-engine.types";

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeBranchPairKey(left: string, right: string) {
  const leftIndex = BRANCH_ORDER.indexOf(left as (typeof BRANCH_ORDER)[number]);
  const rightIndex = BRANCH_ORDER.indexOf(right as (typeof BRANCH_ORDER)[number]);

  if (leftIndex === -1 || rightIndex === -1) {
    return [left, right].sort().join("|");
  }

  return leftIndex <= rightIndex ? `${left}|${right}` : `${right}|${left}`;
}

function buildNormalizedBranchPairLabel(left: string, right: string) {
  return normalizeBranchPairKey(left, right).replace("|", "");
}


function buildPairInteractions(
  pillars: CalculatedStateValue["fourPillars"],
  relationKeys: Set<string>,
) {
  const entries = Object.entries(pillars) as Array<[PillarKey, PillarValue]>;
  const interactions: PairInteraction[] = [];

  for (let leftIndex = 0; leftIndex < entries.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const [leftPillar, leftValue] = entries[leftIndex];
      const [rightPillar, rightValue] = entries[rightIndex];
      const pairKey = normalizeBranchPairKey(leftValue.branch, rightValue.branch);

      if (!relationKeys.has(pairKey)) {
        continue;
      }

      interactions.push({
        leftPillar,
        rightPillar,
        leftBranch: leftValue.branch,
        rightBranch: rightValue.branch,
        label: buildNormalizedBranchPairLabel(leftValue.branch, rightValue.branch),
      });
    }
  }

  return interactions;
}

function buildPunishmentInteractions(pillars: CalculatedStateValue["fourPillars"]) {
  const entries = Object.entries(pillars) as Array<[PillarKey, PillarValue]>;
  const interactions: MultiBranchInteraction[] = [];

  for (const interaction of buildPairInteractions(pillars, PUNISHMENT_PAIR_KEYS)) {
    interactions.push({
      pillars: [interaction.leftPillar, interaction.rightPillar],
      branches: [interaction.leftBranch, interaction.rightBranch],
      label: interaction.label,
    });
  }

  for (const trio of PUNISHMENT_TRIOS) {
    const matches = entries.filter(([, value]) =>
      trio.some((branch) => branch === value.branch),
    );

    if (matches.length === trio.length) {
      interactions.push({
        pillars: matches.map(([pillarKey]) => pillarKey),
        branches: [...trio],
        label: trio.join(""),
      });
    }
  }

  for (const branch of SELF_PUNISHMENT_BRANCHES) {
    const matches = entries.filter(([, value]) => value.branch === branch);

    if (matches.length >= 2) {
      interactions.push({
        pillars: matches.map(([pillarKey]) => pillarKey),
        branches: matches.map(([, value]) => value.branch),
        label: `${branch}${branch}`,
      });
    }
  }

  return interactions;
}

export function resolveBranchInteractionEffects(
  pillars: CalculatedStateValue["fourPillars"],
): BranchInteractionResolution {
  const combinations = buildPairInteractions(pillars, SIX_COMBINATION_PAIRS);
  const clashes = buildPairInteractions(pillars, CLASH_PAIRS);
  const harms = buildPairInteractions(pillars, HARM_PAIRS);
  const destructions = buildPairInteractions(pillars, DESTRUCTION_PAIRS);
  const punishments = buildPunishmentInteractions(pillars);
  const combinationPillars = new Set(
    combinations.flatMap((interaction) => [interaction.leftPillar, interaction.rightPillar]),
  );
  const neutralizedClashes = clashes.filter(
    (interaction) =>
      combinationPillars.has(interaction.leftPillar) ||
      combinationPillars.has(interaction.rightPillar),
  );
  const activeClashes = clashes.filter(
    (interaction) => !neutralizedClashes.includes(interaction),
  );
  const activeClashPillars = new Set(
    activeClashes.flatMap((interaction) => [interaction.leftPillar, interaction.rightPillar]),
  );
  const activePunishments = punishments.filter(
    (interaction) =>
      !interaction.pillars.some((pillarKey) => combinationPillars.has(pillarKey)) &&
      !interaction.pillars.some((pillarKey) => activeClashPillars.has(pillarKey)),
  );
  const majorConflictPillars = new Set([...combinationPillars, ...activeClashPillars]);
  const monthBranchSeasonalFactor = activeClashes.some(
    (interaction) =>
      interaction.leftPillar === "month" || interaction.rightPillar === "month",
  )
    ? MONTH_SEASONAL_CLASH_FACTOR
    : 1;
  const precedenceNotes = uniqueStrings([
    ...combinations.map(
      (interaction) =>
        `Active combination ${interaction.label} takes precedence over clashes touching the same branches.`,
    ),
    ...neutralizedClashes.map(
      (interaction) =>
        `Clash ${interaction.label} is neutralized because one of its branches first enters a combination.`,
    ),
    ...activeClashes.map(
      (interaction) =>
        `Active clash ${interaction.label} remains in force and should outrank punishment-level interpretations.`,
    ),
    ...activePunishments.map(
      (interaction) =>
        `Punishment pattern ${interaction.label} remains active after higher-precedence interactions were resolved.`,
    ),
    ...harms.map((interaction) => {
      const supplementary =
        majorConflictPillars.has(interaction.leftPillar) ||
        majorConflictPillars.has(interaction.rightPillar);

      return supplementary
        ? `Harm ${interaction.label} is present but treated as a supplementary detail because a higher-precedence interaction exists.`
        : `Harm ${interaction.label} is active as a secondary relational signal.`;
    }),
    ...destructions.map((interaction) => {
      const supplementary =
        majorConflictPillars.has(interaction.leftPillar) ||
        majorConflictPillars.has(interaction.rightPillar);

      return supplementary
        ? `Destruction ${interaction.label} is present but remains a supplementary note under higher-precedence interactions.`
        : `Destruction ${interaction.label} is active as a secondary relational signal.`;
    }),
    ...(monthBranchSeasonalFactor < 1
      ? [
          `Month-branch clash reduces seasonal support weighting to ${monthBranchSeasonalFactor.toFixed(2)} until a higher-precedence combination resolves it.`,
        ]
      : []),
  ]);

  return {
    activeCombinations: uniqueStrings(combinations.map((interaction) => interaction.label)),
    neutralizedClashes: uniqueStrings(neutralizedClashes.map((interaction) => interaction.label)),
    activeClashes: uniqueStrings(activeClashes.map((interaction) => interaction.label)),
    activePunishments: uniqueStrings(activePunishments.map((interaction) => interaction.label)),
    activeHarms: uniqueStrings(harms.map((interaction) => interaction.label)),
    activeDestructions: uniqueStrings(destructions.map((interaction) => interaction.label)),
    monthBranchSeasonalFactor,
    precedenceNotes,
  };
}