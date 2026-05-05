import type {
  CalculatedStateValue,
  PillarValue,
} from "@/lib/bazi/schema-types";

import {
  CLASH_PAIRS,
  DESTRUCTION_PAIRS,
  HARM_PAIRS,
  MONTH_SEASONAL_CLASH_FACTOR,
  PUNISHMENT_PAIR_KEYS,
  PUNISHMENT_TRIOS,
  SELF_PUNISHMENT_BRANCHES,
  SIX_COMBINATION_PAIRS,
  STEM_BRANCH_DESTRUCTION_PAIRS,
  normalizeBranchPairKey,
} from "@/lib/bazi/symbolic-engine.constants";
import type {
  BranchInteractionResolution,
  InteractionTier,
  MultiBranchInteraction,
  PairInteraction,
  PillarKey,
} from "@/lib/bazi/symbolic-engine.types";
import {
  buildContextRuleNote,
  renderContextRuleNoteEnglish,
  uniqueContextRuleNotes,
} from "@/lib/bazi/symbolic-engine.context-notes";

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
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

export function buildPunishmentInteractions(pillars: CalculatedStateValue["fourPillars"]) {
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

function buildIntraPillarDestruction(pillars: CalculatedStateValue["fourPillars"]) {
  const entries = Object.entries(pillars) as Array<[PillarKey, PillarValue]>;
  const interactions: PairInteraction[] = [];

  for (const [pillarKey, pillar] of entries) {
    const key = `${pillar.stem}|${pillar.branch}`;

    if (STEM_BRANCH_DESTRUCTION_PAIRS.has(key)) {
      interactions.push({
        leftPillar: pillarKey,
        rightPillar: pillarKey,
        leftBranch: pillar.stem,
        rightBranch: pillar.branch,
        label: `${pillar.stem}${pillar.branch}`,
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
  const activePunishments = punishments;
  const interactionTiers: Record<string, InteractionTier> = {};
  combinations.forEach((i) => { interactionTiers[`combination-${i.label}`] = "primary"; });
  activeClashes.forEach((i) => { interactionTiers[`clash-${i.label}`] = "primary"; });
  neutralizedClashes.forEach((i) => { interactionTiers[`clash-${i.label}`] = "secondary"; });
  harms.forEach((i) => { interactionTiers[`harm-${i.label}`] = "secondary"; });
  destructions.forEach((i) => { interactionTiers[`destruction-${i.label}`] = "secondary"; });
  punishments.forEach((i) => { interactionTiers[`punishment-${i.label}`] = "tertiary"; });
  const majorConflictPillars = new Set([...combinationPillars, ...activeClashPillars]);
  const monthBranchSeasonalFactor = activeClashes.some(
    (interaction) =>
      interaction.leftPillar === "month" || interaction.rightPillar === "month",
  )
    ? MONTH_SEASONAL_CLASH_FACTOR
    : 1;
  const precedenceSignals = uniqueContextRuleNotes([
    ...combinations.map((interaction) =>
      buildContextRuleNote("ACTIVE_COMBINATION_PRECEDENCE", {
        label: interaction.label,
      }),
    ),
    ...neutralizedClashes.map((interaction) =>
      buildContextRuleNote("CLASH_NEUTRALIZED_BY_COMBINATION", {
        label: interaction.label,
      }),
    ),
    ...activeClashes.map((interaction) =>
      buildContextRuleNote("ACTIVE_CLASH_OUTRANKS_PUNISHMENT", {
        label: interaction.label,
      }),
    ),
    ...activePunishments.map((interaction) =>
      buildContextRuleNote("ACTIVE_PUNISHMENT_REMAINS", {
        label: interaction.label,
      }),
    ),
    ...harms.map((interaction) => {
      const supplementary =
        majorConflictPillars.has(interaction.leftPillar) ||
        majorConflictPillars.has(interaction.rightPillar);

      return buildContextRuleNote(
        supplementary
          ? "HARM_SUPPLEMENTARY_UNDER_HIGHER_PRECEDENCE"
          : "HARM_ACTIVE_SECONDARY",
        {
          label: interaction.label,
        },
      );
    }),
    ...destructions.map((interaction) => {
      const supplementary =
        majorConflictPillars.has(interaction.leftPillar) ||
        majorConflictPillars.has(interaction.rightPillar);

      return buildContextRuleNote(
        supplementary
          ? "DESTRUCTION_SUPPLEMENTARY_UNDER_HIGHER_PRECEDENCE"
          : "DESTRUCTION_ACTIVE_SECONDARY",
        {
          label: interaction.label,
        },
      );
    }),
    ...(monthBranchSeasonalFactor < 1
      ? [
          buildContextRuleNote("MONTH_BRANCH_CLASH_REDUCES_SEASONAL_SUPPORT", {
            factor: monthBranchSeasonalFactor.toFixed(2),
          }),
        ]
      : []),
  ]);
  const precedenceNotes = uniqueStrings(
    precedenceSignals.map((signal) => renderContextRuleNoteEnglish(signal)),
  );

  const intraPillarDestructions = buildIntraPillarDestruction(pillars);

  return {
    activeCombinations: uniqueStrings(combinations.map((interaction) => interaction.label)),
    neutralizedClashes: uniqueStrings(neutralizedClashes.map((interaction) => interaction.label)),
    activeClashes: uniqueStrings(activeClashes.map((interaction) => interaction.label)),
    activePunishments: uniqueStrings(activePunishments.map((interaction) => interaction.label)),
    activeHarms: uniqueStrings(harms.map((interaction) => interaction.label)),
    activeDestructions: uniqueStrings(destructions.map((interaction) => interaction.label)),
    intraPillarDestructions: uniqueStrings(intraPillarDestructions.map((interaction) => interaction.label)),
    monthBranchSeasonalFactor,
    precedenceNotes,
    precedenceSignals,
    interactionTiers,
  };
}