import {
  CalculatedStateSchema,
  type InteractionEntityValue,
  type InteractionOutcomeValue,
  type InteractionRelationValue,
  type CalculatedStateValue,
} from "@/lib/bazi/schema-types";
import {
  ENGINE_DEPENDENCIES,
  EngineDependencySchema,
  EngineFactDTOSchema,
  EngineFactMapSchema,
  type EngineDependency,
  type EngineFactDTO,
  type EngineFactMap,
} from "@/lib/bazi/knowledge/topic-types";
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import {
  CONTROLS,
  ELEMENT_LABELS_TH,
  GENERATES,
  STEM_TO_ELEMENT,
  type FIVE_ELEMENT_ORDER,
} from "@/lib/bazi/symbolic-engine.constants";

type SupportedElement = (typeof FIVE_ELEMENT_ORDER)[number];

type EngineFactBlueprint = {
  label: string;
  sourcePaths: string[];
};

const ENGINE_FACT_BLUEPRINTS: Record<EngineDependency, EngineFactBlueprint> = {
  day_master: {
    label: "Day Master",
    sourcePaths: ["calculatedState.dayMaster"],
  },
  day_master_strength: {
    label: "Day Master Strength",
    sourcePaths: ["calculatedState.dayMasterStrengthProfile", "calculatedState.strengthScore"],
  },
  sixty_jiazi_persona: {
    label: "Sixty Jiazi Persona",
    sourcePaths: ["calculatedState.sixtyJiaziCorePersona"],
  },
  hidden_stems: {
    label: "Hidden Stems",
    sourcePaths: ["calculatedState.fourPillars.*.hiddenStems"],
  },
  element_balance: {
    label: "Element Balance",
    sourcePaths: ["calculatedState.elementAnalysis"],
  },
  useful_god: {
    label: "Useful God",
    sourcePaths: [],
  },
  favorable_elements: {
    label: "Favorable Elements",
    sourcePaths: ["calculatedState.elementAnalysis", "calculatedState.dayMasterStrengthProfile"],
  },
  unfavorable_elements: {
    label: "Unfavorable Elements",
    sourcePaths: ["calculatedState.elementAnalysis", "calculatedState.dayMasterStrengthProfile"],
  },
  wealth_star: {
    label: "Wealth Star",
    sourcePaths: ["calculatedState.tenGods"],
  },
  power_star: {
    label: "Power Star",
    sourcePaths: ["calculatedState.tenGods"],
  },
  resource_star: {
    label: "Resource Star",
    sourcePaths: ["calculatedState.tenGods"],
  },
  output_star: {
    label: "Output Star",
    sourcePaths: ["calculatedState.tenGods"],
  },
  peer_star: {
    label: "Peer Star",
    sourcePaths: ["calculatedState.tenGods"],
  },
  pillar_relations: {
    label: "Pillar Relations",
    sourcePaths: ["calculatedState.interactionState"],
  },
  month_branch_relations: {
    label: "Month Branch Relations",
    sourcePaths: ["calculatedState.interactionState", "calculatedState.fourPillars.month"],
  },
  day_branch_relations: {
    label: "Day Branch Relations",
    sourcePaths: ["calculatedState.interactionState", "calculatedState.fourPillars.day"],
  },
  hour_branch_relations: {
    label: "Hour Branch Relations",
    sourcePaths: ["calculatedState.interactionState", "calculatedState.fourPillars.hour"],
  },
  clash_matrix: {
    label: "Clash Matrix",
    sourcePaths: ["calculatedState.interactionState"],
  },
  combination_matrix: {
    label: "Combination Matrix",
    sourcePaths: ["calculatedState.interactionState"],
  },
  harm_matrix: {
    label: "Harm Matrix",
    sourcePaths: ["calculatedState.interactionState"],
  },
  punishment_matrix: {
    label: "Punishment Matrix",
    sourcePaths: ["calculatedState.interactionState"],
  },
  twelve_qi_profile: {
    label: "Twelve Qi Profile",
    sourcePaths: ["calculatedState.twelveQi"],
  },
  dayun_cycles: {
    label: "Da Yun Cycles",
    sourcePaths: ["calculatedState.daYun"],
  },
  health_signals: {
    label: "Health Signals",
    sourcePaths: ["calculatedState.elementAnalysis", "calculatedState.shenSha"],
  },
};

function buildPendingEngineFact(dependency: EngineDependency): EngineFactDTO {
  const blueprint = ENGINE_FACT_BLUEPRINTS[dependency];

  return EngineFactDTOSchema.parse({
    dependency,
    label: blueprint.label,
    summary: `Pending extractor implementation for ${blueprint.label}.`,
    sourcePaths: blueprint.sourcePaths,
    resolved: false,
  });
}

function joinParts(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part && part.trim().length > 0)).join(" | ");
}

function summarizeRecord(record: Record<string, string>, options?: { includeKeys?: boolean }) {
  return Object.entries(record)
    .filter(([, value]) => value.trim().length > 0)
    .map(([key, value]) => (options?.includeKeys ? `${key}: ${value}` : value))
    .join(", ");
}

function splitTenGodTokens(value: string) {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function buildResolvedFact(
  dependency: EngineDependency,
  summary: string,
  options?: {
    sourcePaths?: string[];
    resolved?: boolean;
  },
): EngineFactDTO {
  const blueprint = ENGINE_FACT_BLUEPRINTS[dependency];

  return EngineFactDTOSchema.parse({
    dependency,
    label: blueprint.label,
    summary,
    sourcePaths: options?.sourcePaths ?? blueprint.sourcePaths,
    resolved: options?.resolved ?? true,
  });
}

function getDayMasterElement(calculatedState: CalculatedStateValue): SupportedElement | null {
  const element = STEM_TO_ELEMENT[calculatedState.dayMaster as keyof typeof STEM_TO_ELEMENT];

  return (element as SupportedElement | undefined) ?? null;
}

function toThaiElement(element: SupportedElement) {
  return ELEMENT_LABELS_TH[element];
}

function getGeneratingElement(targetElement: SupportedElement) {
  return (Object.entries(GENERATES).find(([, generated]) => generated === targetElement)?.[0] ?? null) as SupportedElement | null;
}

function getControllingElement(targetElement: SupportedElement) {
  return (Object.entries(CONTROLS).find(([, controlled]) => controlled === targetElement)?.[0] ?? null) as SupportedElement | null;
}

function buildSupportGuidance(calculatedState: CalculatedStateValue) {
  const dayMasterElement = getDayMasterElement(calculatedState);
  const strengthBandId = calculatedState.dayMasterStrengthProfile?.bandId
    ?? classifyOperatorStrengthScore(calculatedState.strengthScore).id;

  if (!dayMasterElement) {
    return null;
  }

  const resourceElement = getGeneratingElement(dayMasterElement);
  const outputElement = GENERATES[dayMasterElement];
  const wealthElement = CONTROLS[dayMasterElement];
  const powerElement = getControllingElement(dayMasterElement);

  if (!resourceElement || !outputElement || !wealthElement || !powerElement) {
    return null;
  }

  if (strengthBandId === "very-weak") {
    return {
      usefulGod: resourceElement,
      favorable: [resourceElement, dayMasterElement],
      unfavorable: [outputElement, wealthElement, powerElement],
      rationale: "ดิถีอ่อนเกินไปจึงต้องอุ้มกำลังด้วยธาตุส่งเสริมก่อน แล้วค่อยคืนแกนให้ธาตุคู่",
    };
  }

  if (strengthBandId === "weak") {
    return {
      usefulGod: resourceElement,
      favorable: [resourceElement, dayMasterElement],
      unfavorable: [outputElement, wealthElement, powerElement],
      rationale: "ดวงอ่อนจึงให้น้ำหนักกับธาตุส่งเสริมและธาตุคู่ก่อน",
    };
  }

  if (strengthBandId === "strong") {
    return {
      usefulGod: wealthElement,
      favorable: [wealthElement, outputElement, powerElement],
      unfavorable: [resourceElement, dayMasterElement],
      rationale: "ดวงแข็งจึงควรถ่ายแรงออกผ่านทรัพย์ ผลลัพธ์ และความรับผิดชอบ ไม่ย้อนเพิ่มกำลัง",
    };
  }

  if (strengthBandId === "very-strong") {
    return {
      usefulGod: outputElement,
      favorable: [outputElement, wealthElement, powerElement],
      unfavorable: [resourceElement, dayMasterElement],
      rationale: "ดวงแข็งมากจึงระบายกำลังออกผ่านถ่ายเท ทรัพย์ และอำนาจ",
    };
  }

  return {
    usefulGod: wealthElement,
    favorable: [outputElement, wealthElement, powerElement],
    unfavorable: [resourceElement, dayMasterElement],
    rationale: "ดวงสมดุลใช้ธาตุงานและผลลัพธ์เพื่อขยับพลังให้เกิดประโยชน์",
  };
}

function getTenGodMatches(calculatedState: CalculatedStateValue, targets: string[]) {
  return Object.entries(calculatedState.tenGods)
    .flatMap(([position, value]) => splitTenGodTokens(value).map((token) => ({ position, token })))
    .filter(({ token }) => targets.includes(token));
}

function summarizeTenGodFamily(calculatedState: CalculatedStateValue, dependency: EngineDependency) {
  const families: Record<string, string[]> = {
    wealth_star: ["正财", "偏财"],
    power_star: ["正官", "七杀"],
    resource_star: ["正印", "偏印"],
    output_star: ["食神", "伤官"],
    peer_star: ["比肩", "劫财"],
  };

  const matches = getTenGodMatches(calculatedState, families[dependency] ?? []);

  if (matches.length === 0) {
    return buildResolvedFact(dependency, `ไม่พบ ${ENGINE_FACT_BLUEPRINTS[dependency].label} ในตำแหน่งที่ engine ปล่อยออกมาปัจจุบัน`);
  }

  return buildResolvedFact(
    dependency,
    matches.map(({ position, token }) => `${position}=${token}`).join(", "),
  );
}

function summarizeInteractionMatrices(
  calculatedState: CalculatedStateValue,
  predicate: (relation: InteractionRelationValue) => boolean,
  dependency: EngineDependency,
) {
  const relations = calculatedState.interactionState?.relations.filter(predicate) ?? [];
  const outcomesByRelation = new Map<string, InteractionOutcomeValue>(
    (calculatedState.interactionState?.outcomes ?? []).map((outcome) => [outcome.relationId, outcome]),
  );

  if (relations.length === 0) {
    return buildResolvedFact(dependency, `ไม่พบ ${ENGINE_FACT_BLUEPRINTS[dependency].label.toLowerCase()} จาก interactionState`);
  }

  return buildResolvedFact(
    dependency,
    relations
      .map((relation) => {
        const outcome = outcomesByRelation.get(relation.id);
        const outcomeText = outcome ? ` (${outcome.status}${outcome.precedence ? `/${outcome.precedence}` : ""})` : "";

        return `${relation.label}${outcomeText}`;
      })
      .join(", "),
  );
}

function getBranchEntityIdsByPillar(calculatedState: CalculatedStateValue, pillarKey: string) {
  return new Set(
    (calculatedState.interactionState?.entities ?? [])
      .filter((entity: InteractionEntityValue) => entity.type === "branch" && entity.pillarKey === pillarKey)
      .map((entity) => entity.id),
  );
}

function summarizeBranchRelations(calculatedState: CalculatedStateValue, pillarKey: "month" | "day" | "hour", dependency: EngineDependency) {
  const branchEntityIds = getBranchEntityIdsByPillar(calculatedState, pillarKey);
  const relations = (calculatedState.interactionState?.relations ?? []).filter((relation) =>
    relation.participantEntityIds.some((entityId) => branchEntityIds.has(entityId)),
  );

  if (relations.length === 0) {
    return buildResolvedFact(dependency, `ไม่พบความสัมพันธ์ของกิ่ง ${pillarKey} ใน interactionState`);
  }

  return buildResolvedFact(
    dependency,
    relations.map((relation) => `${relation.label} [${relation.familyKey}]`).join(", "),
  );
}

function extractEngineFact(dependency: EngineDependency, calculatedState: CalculatedStateValue): EngineFactDTO {
  switch (dependency) {
    case "day_master": {
      const element = getDayMasterElement(calculatedState);

      return buildResolvedFact(
        dependency,
        element
          ? `${calculatedState.dayMaster} (${toThaiElement(element)})`
          : calculatedState.dayMaster,
      );
    }
    case "day_master_strength": {
      const profile = calculatedState.dayMasterStrengthProfile;

      return buildResolvedFact(
        dependency,
        profile
          ? joinParts([
              profile.strengthState,
              profile.displayLabel,
              profile.scoreText ? `score ${profile.scoreText}` : undefined,
              profile.narrativeReason,
            ])
          : `score ${calculatedState.strengthScore}`,
      );
    }
    case "sixty_jiazi_persona":
      return buildResolvedFact(
        dependency,
        calculatedState.sixtyJiaziCorePersona
          ? joinParts([
              calculatedState.sixtyJiaziCorePersona.code,
              calculatedState.sixtyJiaziCorePersona.narrative,
            ])
          : "ไม่พบ sixty jiazi persona ใน state ปัจจุบัน",
      );
    case "hidden_stems":
      return buildResolvedFact(
        dependency,
        ["year", "month", "day", "hour"]
          .map((pillarKey) => {
            const pillar = calculatedState.fourPillars[pillarKey as keyof typeof calculatedState.fourPillars];

            return `${pillarKey}=${pillar.hiddenStems?.join("/") ?? "-"}`;
          })
          .join(", "),
      );
    case "element_balance": {
      const analysis = calculatedState.elementAnalysis;

      return buildResolvedFact(
        dependency,
        joinParts([
          `รวม ${summarizeRecord(Object.fromEntries(Object.entries(analysis.totalCounts).map(([key, value]) => [ELEMENT_LABELS_TH[key as SupportedElement], String(value)])), { includeKeys: true })}`,
          analysis.dominantElements.length > 0
            ? `เด่น ${analysis.dominantElements.map((element) => ELEMENT_LABELS_TH[element]).join(", ")}`
            : undefined,
          analysis.missingElements.length > 0
            ? `ขาด ${analysis.missingElements.map((element) => ELEMENT_LABELS_TH[element]).join(", ")}`
            : undefined,
        ]),
      );
    }
    case "useful_god": {
      const guidance = buildSupportGuidance(calculatedState);

      return buildResolvedFact(
        dependency,
        guidance
          ? `${toThaiElement(guidance.usefulGod)} — ${guidance.rationale}`
          : "ยังไม่สามารถคำนวณ useful god จาก state ปัจจุบันได้",
        { resolved: guidance !== null },
      );
    }
    case "favorable_elements": {
      const guidance = buildSupportGuidance(calculatedState);

      return buildResolvedFact(
        dependency,
        guidance
          ? guidance.favorable.map((element) => toThaiElement(element)).join(", ")
          : "ยังไม่สามารถสรุปธาตุส่งเสริมได้",
        { resolved: guidance !== null },
      );
    }
    case "unfavorable_elements": {
      const guidance = buildSupportGuidance(calculatedState);

      return buildResolvedFact(
        dependency,
        guidance
          ? guidance.unfavorable.map((element) => toThaiElement(element)).join(", ")
          : "ยังไม่สามารถสรุปธาตุถ่วงได้",
        { resolved: guidance !== null },
      );
    }
    case "wealth_star":
    case "power_star":
    case "resource_star":
    case "output_star":
    case "peer_star":
      return summarizeTenGodFamily(calculatedState, dependency);
    case "pillar_relations":
      return buildResolvedFact(
        dependency,
        (calculatedState.interactionState?.relations ?? []).length > 0
          ? calculatedState.interactionState!.relations.map((relation) => `${relation.label} [${relation.familyKey}]`).join(", ")
          : "ไม่พบ relation ใน interactionState",
      );
    case "month_branch_relations":
      return summarizeBranchRelations(calculatedState, "month", dependency);
    case "day_branch_relations":
      return summarizeBranchRelations(calculatedState, "day", dependency);
    case "hour_branch_relations":
      return summarizeBranchRelations(calculatedState, "hour", dependency);
    case "clash_matrix":
      return summarizeInteractionMatrices(
        calculatedState,
        (relation) => relation.familyKey.includes("clash"),
        dependency,
      );
    case "combination_matrix":
      return summarizeInteractionMatrices(
        calculatedState,
        (relation) => (
          relation.familyKey.includes("-he")
          || relation.familyKey.includes("combination")
          || relation.familyKey.includes("san-hui")
        ),
        dependency,
      );
    case "harm_matrix":
      return summarizeInteractionMatrices(
        calculatedState,
        (relation) => relation.familyKey.includes("harm"),
        dependency,
      );
    case "punishment_matrix":
      return summarizeInteractionMatrices(
        calculatedState,
        (relation) => relation.familyKey.includes("punishment"),
        dependency,
      );
    case "twelve_qi_profile":
      return buildResolvedFact(dependency, summarizeRecord(calculatedState.twelveQi, { includeKeys: true }));
    case "dayun_cycles":
      return buildResolvedFact(
        dependency,
        calculatedState.daYun
          .map((entry) => `${entry.startAge}-${entry.endAge}:${entry.stem}${entry.branch}${entry.isCurrent ? "(current)" : ""}`)
          .join(", "),
      );
    case "health_signals":
      return buildResolvedFact(
        dependency,
        joinParts([
          calculatedState.elementAnalysis.missingElements.length > 0
            ? `ธาตุขาด ${calculatedState.elementAnalysis.missingElements.map((element) => ELEMENT_LABELS_TH[element]).join(", ")}`
            : undefined,
          calculatedState.shenSha.length > 0
            ? `shen sha ${calculatedState.shenSha.map((entry) => entry.starName).join(", ")}`
            : undefined,
        ]) || "ยังไม่พบ health signal เด่นจาก state ปัจจุบัน",
      );
    default:
      return buildPendingEngineFact(dependency);
  }
}

export function createEngineFactShell(): EngineFactMap {
  return EngineFactMapSchema.parse(
    Object.fromEntries(
      ENGINE_DEPENDENCIES.map((dependency) => [dependency, buildPendingEngineFact(dependency)]),
    ),
  );
}

export function getEngineFactsForDependencies(
  calculatedState: CalculatedStateValue,
  dependencies: readonly EngineDependency[],
): EngineFactDTO[] {
  const parsedState = CalculatedStateSchema.parse(calculatedState);

  return dependencies.map((dependency) => {
    const parsedDependency = EngineDependencySchema.parse(dependency);

    return extractEngineFact(parsedDependency, parsedState);
  });
}

export function getEngineFactBlueprint(dependency: EngineDependency): EngineFactDTO {
  const parsedDependency = EngineDependencySchema.parse(dependency);

  return buildPendingEngineFact(parsedDependency);
}