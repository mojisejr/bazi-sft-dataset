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

type OutcomeByRelationId = Map<string, InteractionOutcomeValue>;

function resolveDayMasterEffect(
  dayMasterElement: string | undefined,
  candidateElement: string | undefined,
): InteractionOutcomeValue["dayMasterEffect"] {
  if (!dayMasterElement || !candidateElement) {
    return undefined;
  }

  if (dayMasterElement === candidateElement || GENERATES[candidateElement as keyof typeof GENERATES] === dayMasterElement) {
    return "beneficial";
  }

  if (CONTROLS[candidateElement as keyof typeof CONTROLS] === dayMasterElement) {
    return "harmful";
  }

  return "neutral";
}

function getQualifierByEntityId(
  qualifiers: InteractionQualifierValue[],
  entityId: string,
) {
  return qualifiers.find((qualifier) => qualifier.entityId === entityId && qualifier.qualifierKey === "twelve-qi-stage");
}

function isSupportiveTwelveQiStage(stage: string | undefined) {
  return stage === "长生" || stage === "临官" || stage === "帝旺" || stage === "冠带";
}

function indexOutcomesByRelationId(outcomes: InteractionOutcomeValue[]): OutcomeByRelationId {
  return new Map(outcomes.map((outcome) => [outcome.relationId, outcome]));
}

function resolveStemCombinationOutcomes(
  relations: InteractionRelationValue[],
  outcomes: OutcomeByRelationId,
  qualifiers: InteractionQualifierValue[],
  dayMasterElement: string | undefined,
) {
  for (const relation of relations) {
    if (relation.familyKey !== "heavenly-stem-he") {
      continue;
    }

    const outcome = outcomes.get(relation.id);
    if (!outcome) {
      continue;
    }

    const supportReasons = [...outcome.supportReasons];
    const branchQualifiers = relation.participantEntityIds
      .map((entityId) => entityId.replace(/^stem-/, "branch-"))
      .map((entityId) => getQualifierByEntityId(qualifiers, entityId))
      .filter((qualifier): qualifier is InteractionQualifierValue => Boolean(qualifier));
    const hasSupportiveBranchRoute = branchQualifiers.some((qualifier) => isSupportiveTwelveQiStage(qualifier.value));

    if (hasSupportiveBranchRoute) {
      supportReasons.push("supportive-branch-route");
    }

    outcome.supportReasons = uniqueStrings(supportReasons);
    outcome.dayMasterEffect = resolveDayMasterEffect(dayMasterElement, relation.transformElement);

    if (relation.transformElement && hasSupportiveBranchRoute) {
      outcome.status = "transformed";
      outcome.precedence = "primary";
    } else if (relation.transformElement) {
      outcome.status = "supported";
      outcome.precedence = "primary";
    }
  }
}

function resolveBranchCombinationOutcomes(
  relations: InteractionRelationValue[],
  outcomes: OutcomeByRelationId,
  qualifiers: InteractionQualifierValue[],
  dayMasterElement: string | undefined,
) {
  const fullGroupBySource = new Map<string, InteractionRelationValue>();

  for (const relation of relations) {
    if (relation.familyKey === "earthly-branch-san-he") {
      fullGroupBySource.set(relation.label, relation);
    }
  }

  for (const relation of relations) {
    const outcome = outcomes.get(relation.id);
    if (!outcome) {
      continue;
    }

    if (relation.familyKey === "earthly-branch-san-he") {
      const supportingStages = relation.participantEntityIds
        .map((entityId) => getQualifierByEntityId(qualifiers, entityId))
        .filter((qualifier): qualifier is InteractionQualifierValue => Boolean(qualifier))
        .filter((qualifier) => isSupportiveTwelveQiStage(qualifier.value));

      outcome.dayMasterEffect = resolveDayMasterEffect(dayMasterElement, relation.transformElement);
      outcome.supportReasons = uniqueStrings([
        ...outcome.supportReasons,
        ...(supportingStages.length >= 2 ? ["route-backed-full-triad"] : []),
      ]);
      outcome.status = "supported";
      outcome.precedence = "primary";
      continue;
    }

    if (relation.familyKey !== "earthly-branch-ban-san-he") {
      continue;
    }

    const sourceGroup = typeof relation.metadata.sourceGroup === "string"
      ? relation.metadata.sourceGroup
      : undefined;
    const blockingRelation = sourceGroup ? fullGroupBySource.get(sourceGroup) : undefined;
    outcome.dayMasterEffect = resolveDayMasterEffect(dayMasterElement, relation.transformElement);

    if (blockingRelation) {
      outcome.status = "blocked";
      outcome.blockedByRelationIds = uniqueStrings([
        ...outcome.blockedByRelationIds,
        blockingRelation.id,
      ]);
      outcome.supportReasons = uniqueStrings([...outcome.supportReasons, "superseded-by-full-triad"]);
      outcome.precedence = "secondary";
      continue;
    }

    const supportingStages = relation.participantEntityIds
      .map((entityId) => getQualifierByEntityId(qualifiers, entityId))
      .filter((qualifier): qualifier is InteractionQualifierValue => Boolean(qualifier))
      .filter((qualifier) => isSupportiveTwelveQiStage(qualifier.value));

    outcome.supportReasons = uniqueStrings([
      ...outcome.supportReasons,
      ...(supportingStages.length >= 1 ? ["route-backed-half-triad"] : []),
    ]);
    outcome.status = supportingStages.length >= 1 ? "supported" : "detected";
    outcome.precedence = "secondary";
  }
}

function resolveElementInteractionOutcomes(
  relations: InteractionRelationValue[],
  outcomes: OutcomeByRelationId,
  dayMasterElement: string | undefined,
) {
  for (const relation of relations) {
    if (relation.familyKey !== "element-generate" && relation.familyKey !== "element-control") {
      continue;
    }

    const outcome = outcomes.get(relation.id);
    if (!outcome) {
      continue;
    }

    const targetElement = typeof relation.metadata.targetElement === "string"
      ? relation.metadata.targetElement
      : undefined;
    outcome.dayMasterEffect = resolveDayMasterEffect(dayMasterElement, targetElement);

    if (relation.familyKey === "element-generate") {
      outcome.supportReasons = uniqueStrings([
        ...outcome.supportReasons,
        ...(outcome.dayMasterEffect === "beneficial" ? ["nourishes-day-master-lane"] : []),
      ]);
    }

    if (relation.familyKey === "element-control") {
      outcome.supportReasons = uniqueStrings([
        ...outcome.supportReasons,
        ...(outcome.dayMasterEffect === "harmful" ? ["pressures-day-master-lane"] : []),
      ]);
    }
  }
}

function resolveGeneralizedInteractionOutcomes(state: GeneralizedInteractionState): GeneralizedInteractionState {
  const dayMasterElement = state.entities.find((entity) => entity.type === "day-master")?.element;
  const outcomes = indexOutcomesByRelationId(state.outcomes);

  resolveStemCombinationOutcomes(state.relations, outcomes, state.qualifiers, dayMasterElement);
  resolveBranchCombinationOutcomes(state.relations, outcomes, state.qualifiers, dayMasterElement);
  resolveElementInteractionOutcomes(state.relations, outcomes, dayMasterElement);

  return {
    ...state,
    outcomes: state.outcomes.map((outcome) => outcomes.get(outcome.relationId) ?? outcome),
  };
}

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

  const allEntities = entries.flatMap(([key, pillar]) => [
    {
      type: "stem" as const,
      key,
      symbol: pillar.stem,
      element: STEM_TO_ELEMENT[pillar.stem as keyof typeof STEM_TO_ELEMENT],
      entityId: buildStemEntityId(key),
    },
    {
      type: "branch" as const,
      key,
      symbol: pillar.branch,
      element: BRANCH_TO_ELEMENT[pillar.branch as keyof typeof BRANCH_TO_ELEMENT],
      entityId: buildBranchEntityId(key),
    },
  ]);

  for (let leftIndex = 0; leftIndex < allEntities.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < allEntities.length; rightIndex += 1) {
      if (leftIndex === rightIndex) continue;

      const left = allEntities[leftIndex];
      const right = allEntities[rightIndex];

      if (!left.element || !right.element) continue;

      if (GENERATES[left.element as keyof typeof GENERATES] === right.element) {
        const relationId = `relation-generate-${left.entityId}-${right.entityId}`;
        relations.push({
          id: relationId,
          familyKey: "element-generate",
          type: "element-interaction",
          participantEntityIds: [left.entityId, right.entityId],
          label: `${left.symbol}->${right.symbol}`,
          elementInteractionType: "generate",
          metadata: {
            sourceElement: left.element,
            targetElement: right.element,
            sourceType: left.type,
            targetType: right.type,
          },
        });
        outcomes.push({
          relationId,
          status: "detected",
          precedence: "secondary",
          dayMasterEffect:
            dayMasterElement === right.element ? "beneficial" : dayMasterElement === left.element ? "harmful" : "neutral",
          supportReasons: [],
          blockedByRelationIds: [],
          metadata: {},
        });
      }

      if (CONTROLS[left.element as keyof typeof CONTROLS] === right.element) {
        const relationId = `relation-control-${left.entityId}-${right.entityId}`;
        relations.push({
          id: relationId,
          familyKey: "element-control",
          type: "element-interaction",
          participantEntityIds: [left.entityId, right.entityId],
          label: `${left.symbol}x${right.symbol}`,
          elementInteractionType: "control",
          metadata: {
            sourceElement: left.element,
            targetElement: right.element,
            sourceType: left.type,
            targetType: right.type,
          },
        });
        outcomes.push({
          relationId,
          status: "detected",
          precedence: "secondary",
          dayMasterEffect:
            dayMasterElement === right.element ? "harmful" : dayMasterElement === left.element ? "beneficial" : "neutral",
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

  return resolveGeneralizedInteractionOutcomes({
    version: "v3-phase-1",
    entities,
    relations: [...stem.relations, ...branchFamilies.relations, ...elemental.relations],
    outcomes: [...stem.outcomes, ...branchFamilies.outcomes, ...elemental.outcomes],
    qualifiers,
  });
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
