import {
  CalculatedStateSchema,
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
  CalculatedStateSchema.parse(calculatedState);
  const shell = createEngineFactShell();

  return dependencies.map((dependency) => {
    const parsedDependency = EngineDependencySchema.parse(dependency);

    return shell[parsedDependency];
  });
}

export function getEngineFactBlueprint(dependency: EngineDependency): EngineFactDTO {
  const parsedDependency = EngineDependencySchema.parse(dependency);

  return buildPendingEngineFact(parsedDependency);
}