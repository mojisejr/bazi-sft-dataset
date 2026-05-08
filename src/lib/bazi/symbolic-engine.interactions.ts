import type {
  CalculatedStateValue,
  InteractionEntityValue,
  InteractionOutcomeValue,
  InteractionQualifierValue,
  InteractionRelationValue,
  PillarValue,
} from "@/lib/bazi/schema-types";

import {
  BRANCH_TO_ELEMENT,
  CLASH_PAIRS,
  CONTROLS,
  DESTRUCTION_PAIRS,
  GENERATES,
  HARM_PAIRS,
  MONTH_SEASONAL_CLASH_FACTOR,
  SAN_HE_GROUPS,
  PUNISHMENT_PAIR_KEYS,
  PUNISHMENT_TRIOS,
  SELF_PUNISHMENT_BRANCHES,
  SIX_COMBINATION_PAIRS,
  STEM_CLASH_PAIRS,
  STEM_COMBINATION_TRANSFORMS,
  STEM_TO_ELEMENT,
  STEM_BRANCH_DESTRUCTION_PAIRS,
  normalizeBranchPairKey,
} from "@/lib/bazi/symbolic-engine.constants";
import type {
  BranchInteractionResolution,
  GeneralizedInteractionState,
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

function buildStemKey(left: string, right: string) {
  return normalizeBranchPairKey(left, right);
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

function buildBranchEntityId(pillarKey: PillarKey) {
  return `branch-${pillarKey}`;
}

function buildStemEntityId(pillarKey: PillarKey) {
  return `stem-${pillarKey}`;
}

function buildParticipantEntities(
  pillars: CalculatedStateValue["fourPillars"],
  dayMasterStem: string,
): InteractionEntityValue[] {
  const entries = Object.entries(pillars) as Array<[PillarKey, PillarValue]>;

  return [
    {
      id: "day-master",
      type: "day-master",
      symbol: dayMasterStem,
      element: STEM_TO_ELEMENT[dayMasterStem as keyof typeof STEM_TO_ELEMENT],
      label: `ดิถี ${dayMasterStem}`,
    },
    ...entries.flatMap(([pillarKey, pillar]) => {
      const stemElement = STEM_TO_ELEMENT[pillar.stem as keyof typeof STEM_TO_ELEMENT];
      const branchElement = BRANCH_TO_ELEMENT[pillar.branch as keyof typeof BRANCH_TO_ELEMENT];

      return [
        {
          id: buildStemEntityId(pillarKey),
          type: "stem" as const,
          pillarKey,
          symbol: pillar.stem,
          element: stemElement,
          label: `${pillarKey}-stem`,
        },
        {
          id: buildBranchEntityId(pillarKey),
          type: "branch" as const,
          pillarKey,
          symbol: pillar.branch,
          element: branchElement,
          label: `${pillarKey}-branch`,
        },
      ];
    }),
  ];
}

function buildTwelveQiQualifiers(
  pillars: CalculatedStateValue["fourPillars"],
  twelveQiByBranch: Record<string, string>,
): InteractionQualifierValue[] {
  const entries = Object.entries(pillars) as Array<[PillarKey, PillarValue]>;

  return entries.flatMap(([pillarKey]) => {
    const value = twelveQiByBranch[pillarKey];
    if (!value) {
      return [];
    }

    return [{
      id: `qualifier-twelve-qi-${pillarKey}`,
      lane: "twelve-qi",
      qualifierKey: "twelve-qi-stage",
      entityId: buildBranchEntityId(pillarKey),
      value,
      display: value,
      metadata: { pillarKey },
    }];
  });
}

function buildStemRelations(pillars: CalculatedStateValue["fourPillars"]) {
  const entries = Object.entries(pillars) as Array<[PillarKey, PillarValue]>;
  const relations: InteractionRelationValue[] = [];
  const outcomes: InteractionOutcomeValue[] = [];

  for (let leftIndex = 0; leftIndex < entries.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const [leftKey, leftPillar] = entries[leftIndex];
      const [rightKey, rightPillar] = entries[rightIndex];
      const stemKey = buildStemKey(leftPillar.stem, rightPillar.stem);
      const participantEntityIds = [buildStemEntityId(leftKey), buildStemEntityId(rightKey)];

      if (STEM_COMBINATION_TRANSFORMS.has(stemKey)) {
        const relationId = `relation-stem-he-${leftKey}-${rightKey}`;
        const transformElementTh = STEM_COMBINATION_TRANSFORMS.get(stemKey) ?? "";
        const transformElement =
          transformElementTh === "木" || transformElementTh === "ไม้"
            ? "wood"
            : transformElementTh === "火" || transformElementTh === "ไฟ"
              ? "fire"
              : transformElementTh === "土" || transformElementTh === "ดิน"
                ? "earth"
                : transformElementTh === "金" || transformElementTh === "ทอง"
                  ? "metal"
                    : transformElementTh === "水" || transformElementTh === "น้ำ"
                      ? "water"
                      : undefined;

        relations.push({
          id: relationId,
          familyKey: "heavenly-stem-he",
          type: "stem-combination",
          participantEntityIds,
          label: `${leftPillar.stem}${rightPillar.stem}`,
          transformElement,
          metadata: {
            leftPillar: leftKey,
            rightPillar: rightKey,
          },
        });

        outcomes.push({
          relationId,
          status: transformElement ? "supported" : "detected",
          precedence: "primary",
          transformElement,
          supportReasons: transformElement ? ["stem-combination-transform-vector"] : [],
          blockedByRelationIds: [],
          metadata: {},
        });
      }

      if (STEM_CLASH_PAIRS.has(stemKey)) {
        const relationId = `relation-stem-clash-${leftKey}-${rightKey}`;
        relations.push({
          id: relationId,
          familyKey: "heavenly-stem-clash",
          type: "stem-clash",
          participantEntityIds,
          label: `${leftPillar.stem}${rightPillar.stem}`,
          metadata: {
            leftPillar: leftKey,
            rightPillar: rightKey,
          },
        });

        outcomes.push({
          relationId,
          status: "detected",
          precedence: "primary",
          supportReasons: [],
          blockedByRelationIds: [],
          metadata: {},
        });
      }
    }
  }

  return { relations, outcomes };
}

function buildBranchFamilyRelations(
  pillars: CalculatedStateValue["fourPillars"],
  resolution: BranchInteractionResolution,
) {
  const pairInteractions = buildPairInteractions(pillars, SIX_COMBINATION_PAIRS);
  const branchEntries = Object.entries(pillars) as Array<[PillarKey, PillarValue]>;
  const relations: InteractionRelationValue[] = [];
  const outcomes: InteractionOutcomeValue[] = [];
  const pairLabels = new Set(resolution.activeCombinations);

  for (const interaction of pairInteractions) {
    if (!pairLabels.has(interaction.label)) {
      continue;
    }

    const relationId = `relation-liu-he-${interaction.leftPillar}-${interaction.rightPillar}`;
    relations.push({
      id: relationId,
      familyKey: "earthly-branch-liu-he",
      type: "branch-combination",
      participantEntityIds: [
        buildBranchEntityId(interaction.leftPillar),
        buildBranchEntityId(interaction.rightPillar),
      ],
      label: interaction.label,
      metadata: {},
    });
      outcomes.push({
        relationId,
        status: "detected",
        precedence: "primary",
        supportReasons: [],
        blockedByRelationIds: [],
        metadata: {},
      });
  }

  for (const group of SAN_HE_GROUPS) {
    const groupBranches = [...group.branches] as string[];
    const matches = branchEntries.filter(([, pillar]) => groupBranches.includes(pillar.branch));
    const uniqueMatchedBranches = Array.from(new Set(matches.map(([, pillar]) => pillar.branch)));

    if (uniqueMatchedBranches.length === 3) {
      const relationId = `relation-san-he-${group.branches.join("")}`;
      relations.push({
        id: relationId,
        familyKey: "earthly-branch-san-he",
        type: "branch-combination",
        participantEntityIds: matches
          .filter((entry, index, all) => all.findIndex((candidate) => candidate[1].branch === entry[1].branch) === index)
          .map(([pillarKey]) => buildBranchEntityId(pillarKey)),
        label: group.branches.join(""),
        transformElement: group.element,
        metadata: {},
      });
      outcomes.push({
        relationId,
        status: "supported",
        precedence: "primary",
        transformElement: group.element,
        supportReasons: ["full-triad"],
        blockedByRelationIds: [],
        metadata: {},
      });
    }

    if (uniqueMatchedBranches.length >= 2) {
      const halfMatches = matches
        .filter((entry, index, all) => all.findIndex((candidate) => candidate[1].branch === entry[1].branch) === index)
        .slice(0, 2);
      const halfLabel = buildNormalizedBranchPairLabel(
        halfMatches[0]?.[1].branch ?? "",
        halfMatches[1]?.[1].branch ?? "",
      );
      const relationId = `relation-half-san-he-${halfLabel}`;
      relations.push({
        id: relationId,
        familyKey: "earthly-branch-ban-san-he",
        type: "branch-combination",
        participantEntityIds: halfMatches.map(([pillarKey]) => buildBranchEntityId(pillarKey)),
        label: halfLabel,
        transformElement: group.element,
        metadata: {
          sourceGroup: group.branches.join(""),
        },
      });
      outcomes.push({
        relationId,
        status: "detected",
        precedence: "secondary",
        transformElement: group.element,
        supportReasons: ["partial-triad"],
        blockedByRelationIds: [],
        metadata: {},
      });
    }
  }

  return { relations, outcomes };
}

function buildElementRelations(
  pillars: CalculatedStateValue["fourPillars"],
  dayMasterStem: string,
) {
  const entries = Object.entries(pillars) as Array<[PillarKey, PillarValue]>;
  const relations: InteractionRelationValue[] = [];
  const outcomes: InteractionOutcomeValue[] = [];
  const dayMasterElement = STEM_TO_ELEMENT[dayMasterStem as keyof typeof STEM_TO_ELEMENT];

  for (let leftIndex = 0; leftIndex < entries.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const [leftKey, leftPillar] = entries[leftIndex];
      const [rightKey, rightPillar] = entries[rightIndex];
      const leftElement = STEM_TO_ELEMENT[leftPillar.stem as keyof typeof STEM_TO_ELEMENT];
      const rightElement = STEM_TO_ELEMENT[rightPillar.stem as keyof typeof STEM_TO_ELEMENT];

      if (!leftElement || !rightElement) {
        continue;
      }

      if (GENERATES[leftElement] === rightElement) {
        const relationId = `relation-generate-${leftKey}-${rightKey}`;
        relations.push({
          id: relationId,
          familyKey: "element-generate",
          type: "element-interaction",
          participantEntityIds: [buildStemEntityId(leftKey), buildStemEntityId(rightKey)],
          label: `${leftPillar.stem}->${rightPillar.stem}`,
          elementInteractionType: "generate",
          metadata: {
            sourceElement: leftElement,
            targetElement: rightElement,
          },
        });
        outcomes.push({
          relationId,
          status: "detected",
          precedence: "secondary",
          dayMasterEffect:
            dayMasterElement === rightElement ? "beneficial" : dayMasterElement === leftElement ? "harmful" : "neutral",
          supportReasons: [],
          blockedByRelationIds: [],
          metadata: {},
        });
      }

      if (GENERATES[rightElement] === leftElement) {
        const relationId = `relation-generate-${rightKey}-${leftKey}`;
        relations.push({
          id: relationId,
          familyKey: "element-generate",
          type: "element-interaction",
          participantEntityIds: [buildStemEntityId(rightKey), buildStemEntityId(leftKey)],
          label: `${rightPillar.stem}->${leftPillar.stem}`,
          elementInteractionType: "generate",
          metadata: {
            sourceElement: rightElement,
            targetElement: leftElement,
          },
        });
        outcomes.push({
          relationId,
          status: "detected",
          precedence: "secondary",
          dayMasterEffect:
            dayMasterElement === leftElement ? "beneficial" : dayMasterElement === rightElement ? "harmful" : "neutral",
          supportReasons: [],
          blockedByRelationIds: [],
          metadata: {},
        });
      }

      if (CONTROLS[leftElement] === rightElement) {
        const relationId = `relation-control-${leftKey}-${rightKey}`;
        relations.push({
          id: relationId,
          familyKey: "element-control",
          type: "element-interaction",
          participantEntityIds: [buildStemEntityId(leftKey), buildStemEntityId(rightKey)],
          label: `${leftPillar.stem}x${rightPillar.stem}`,
          elementInteractionType: "control",
          metadata: {
            sourceElement: leftElement,
            targetElement: rightElement,
          },
        });
        outcomes.push({
          relationId,
          status: "detected",
          precedence: "secondary",
          dayMasterEffect:
            dayMasterElement === rightElement ? "harmful" : dayMasterElement === leftElement ? "beneficial" : "neutral",
          supportReasons: [],
          blockedByRelationIds: [],
          metadata: {},
        });
      }

      if (CONTROLS[rightElement] === leftElement) {
        const relationId = `relation-control-${rightKey}-${leftKey}`;
        relations.push({
          id: relationId,
          familyKey: "element-control",
          type: "element-interaction",
          participantEntityIds: [buildStemEntityId(rightKey), buildStemEntityId(leftKey)],
          label: `${rightPillar.stem}x${leftPillar.stem}`,
          elementInteractionType: "control",
          metadata: {
            sourceElement: rightElement,
            targetElement: leftElement,
          },
        });
        outcomes.push({
          relationId,
          status: "detected",
          precedence: "secondary",
          dayMasterEffect:
            dayMasterElement === leftElement ? "harmful" : dayMasterElement === rightElement ? "beneficial" : "neutral",
          supportReasons: [],
          blockedByRelationIds: [],
          metadata: {},
        });
      }
    }
  }

  return { relations, outcomes };
}

export function buildGeneralizedInteractionState(options: {
  pillars: CalculatedStateValue["fourPillars"];
  dayMasterStem: string;
  twelveQiByBranch: Record<string, string>;
  resolution: BranchInteractionResolution;
}): GeneralizedInteractionState {
  const entities = buildParticipantEntities(options.pillars, options.dayMasterStem);
  const stem = buildStemRelations(options.pillars);
  const branchFamilies = buildBranchFamilyRelations(options.pillars, options.resolution);
  const elemental = buildElementRelations(options.pillars, options.dayMasterStem);
  const qualifiers = buildTwelveQiQualifiers(options.pillars, options.twelveQiByBranch);

  return {
    version: "v3-phase-1",
    entities,
    relations: [...stem.relations, ...branchFamilies.relations, ...elemental.relations],
    outcomes: [...stem.outcomes, ...branchFamilies.outcomes, ...elemental.outcomes],
    qualifiers,
  };
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
