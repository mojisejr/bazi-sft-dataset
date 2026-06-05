import type {
  PillarValue,
  RawInputValue,
} from "@/lib/bazi/schema-types";
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import {
  buildDayMasterStrengthVocabulary,
  DAY_MASTER_STRENGTH_KNOWLEDGE_BOUNDARY,
  type CanonicalDayMasterStrengthState,
  type StrengthDoctrineSemanticId,
} from "@/lib/bazi/strength-state-vocabulary";

export const SOURCE1_DEPENDENCY_BUCKETS = [
  "base-structure",
  "role-of-element",
  "table-interaction",
  "timing",
  "narrative-overlay",
] as const;

export type Source1DependencyBucket = (typeof SOURCE1_DEPENDENCY_BUCKETS)[number];

export const SOURCE1_TRUTH_MODES = [
  "numeric_engine",
  "typed_engine",
  "display_narrative",
] as const;

export type Source1TruthMode = (typeof SOURCE1_TRUTH_MODES)[number];

export const SOURCE1_CONTRACT_FIELD_IDS = [
  "four-pillars",
  "day-master",
  "gender",
  "weighted-strength",
  "role-of-element",
  "twelve-qi-texture",
  "conflict-context",
  "timing",
  "useful-god-master-key-readiness",
] as const;

export type Source1ContractFieldId = (typeof SOURCE1_CONTRACT_FIELD_IDS)[number];

export type Source1RuntimeOwner =
  | "calculateBaziStructuralState"
  | "symbolic-engine.strength"
  | "symbolic-engine.seasonal"
  | "symbolic-engine.interactions"
  | "symbolic-engine.birth"
  | "source1-operating-system-contract";

export type Source1ContractField = {
  id: Source1ContractFieldId;
  label: string;
  bucket: Source1DependencyBucket;
  truthMode: Source1TruthMode;
  runtimeOwner: Source1RuntimeOwner;
  dependsOn: Source1ContractFieldId[];
  description: string;
};

export type Source1StrengthContract = {
  score: number;
  bandId: ReturnType<typeof classifyOperatorStrengthScore>["id"];
  semanticId: StrengthDoctrineSemanticId;
  sourceState: string;
  displayLabel: string;
  lookupState: CanonicalDayMasterStrengthState;
  repositoryLookupState: CanonicalDayMasterStrengthState;
  knowledgeBoundary: typeof DAY_MASTER_STRENGTH_KNOWLEDGE_BOUNDARY;
};

export const SOURCE1_GOLDEN_REFERENCE_CASE: {
  label: string;
  input: RawInputValue;
  structuralAnchors: {
    dayMaster: string;
    fourPillars: {
      year: Pick<PillarValue, "stem" | "branch">;
      month: Pick<PillarValue, "stem" | "branch">;
      day: Pick<PillarValue, "stem" | "branch">;
      hour: Pick<PillarValue, "stem" | "branch">;
    };
  };
} = {
  label: "1989-01-03 08:45 male Bangkok",
  input: {
    birthDate: "1989-01-03",
    birthTime: "08:45",
    gender: "male",
    province: "Bangkok",
    calendarSystem: "solar",
    timezone: "Asia/Hong_Kong",
  },
  structuralAnchors: {
    dayMaster: "癸",
    fourPillars: {
      year: { stem: "戊", branch: "辰" },
      month: { stem: "甲", branch: "子" },
      day: { stem: "癸", branch: "亥" },
      hour: { stem: "丙", branch: "辰" },
    },
  },
};

export const SOURCE1_CONTRACT_FIELDS: readonly Source1ContractField[] = [
  {
    id: "four-pillars",
    label: "4 pillars",
    bucket: "base-structure",
    truthMode: "typed_engine",
    runtimeOwner: "calculateBaziStructuralState",
    dependsOn: [],
    description: "Canonical year, month, day, and hour pillars are the base engine structure.",
  },
  {
    id: "day-master",
    label: "Day master",
    bucket: "base-structure",
    truthMode: "typed_engine",
    runtimeOwner: "calculateBaziStructuralState",
    dependsOn: ["four-pillars"],
    description: "Day master is derived directly from the day pillar stem and stays typed.",
  },
  {
    id: "gender",
    label: "Gender",
    bucket: "base-structure",
    truthMode: "typed_engine",
    runtimeOwner: "symbolic-engine.birth",
    dependsOn: [],
    description: "Gender is an input truth used for Da Yun direction and must not be inferred from narrative.",
  },
  {
    id: "weighted-strength",
    label: "Weighted strength",
    bucket: "base-structure",
    truthMode: "numeric_engine",
    runtimeOwner: "symbolic-engine.strength",
    dependsOn: ["four-pillars", "day-master"],
    description: "Strength remains a weighted numeric score before any lookup or prose layer.",
  },
  {
    id: "role-of-element",
    label: "Role of element",
    bucket: "role-of-element",
    truthMode: "typed_engine",
    runtimeOwner: "symbolic-engine.seasonal",
    dependsOn: ["day-master", "weighted-strength"],
    description: "Element-role semantics stay typed so downstream overlays do not route on display strings.",
  },
  {
    id: "twelve-qi-texture",
    label: "12 Qi texture",
    bucket: "table-interaction",
    truthMode: "typed_engine",
    runtimeOwner: "symbolic-engine.birth",
    dependsOn: ["day-master", "four-pillars"],
    description: "Twelve-Qi stages are lookup-table engine truth and only localized at display boundaries.",
  },
  {
    id: "conflict-context",
    label: "Conflict/context",
    bucket: "table-interaction",
    truthMode: "typed_engine",
    runtimeOwner: "symbolic-engine.interactions",
    dependsOn: ["four-pillars", "twelve-qi-texture"],
    description: "Precedence-resolved combinations, clashes, punishments, and context stay as typed interaction facts.",
  },
  {
    id: "timing",
    label: "Timing",
    bucket: "timing",
    truthMode: "typed_engine",
    runtimeOwner: "symbolic-engine.birth",
    dependsOn: ["gender", "four-pillars"],
    description: "Da Yun, Liu Nian, age snapshot, and direction are timing facts, not narrative overlays.",
  },
  {
    id: "useful-god-master-key-readiness",
    label: "Useful-god/master-key readiness",
    bucket: "narrative-overlay",
    truthMode: "typed_engine",
    runtimeOwner: "source1-operating-system-contract",
    dependsOn: [
      "weighted-strength",
      "role-of-element",
      "twelve-qi-texture",
      "conflict-context",
      "timing",
    ],
    description: "Source 1 only freezes readiness inputs here; final useful-god or master-key wording belongs to later overlays.",
  },
] as const;

function uniqueFieldIds(fields: readonly Source1ContractField[]) {
  return [...new Set(fields.map((field) => field.id))];
}

export function buildSource1StrengthContract(score: number): Source1StrengthContract {
  const vocabulary = buildDayMasterStrengthVocabulary(score);

  return {
    score,
    bandId: vocabulary.bandId,
    semanticId: vocabulary.semanticId,
    sourceState: vocabulary.sourceState,
    displayLabel: vocabulary.displayLabel,
    lookupState: vocabulary.lookupState,
    repositoryLookupState: vocabulary.repositoryLookupState,
    knowledgeBoundary: DAY_MASTER_STRENGTH_KNOWLEDGE_BOUNDARY,
  };
}

export function buildSource1OperatingSystemContract() {
  const fieldIds = uniqueFieldIds(SOURCE1_CONTRACT_FIELDS);

  return {
    referenceCase: SOURCE1_GOLDEN_REFERENCE_CASE,
    fields: SOURCE1_CONTRACT_FIELDS,
    bucketSummary: SOURCE1_DEPENDENCY_BUCKETS.map((bucket) => ({
      bucket,
      fieldIds: SOURCE1_CONTRACT_FIELDS
        .filter((field) => field.bucket === bucket)
        .map((field) => field.id),
    })),
    engineTruthIds: SOURCE1_CONTRACT_FIELDS
      .filter((field) => field.truthMode !== "display_narrative")
      .map((field) => field.id),
    narrativeTruthIds: SOURCE1_CONTRACT_FIELDS
      .filter((field) => field.truthMode === "display_narrative")
      .map((field) => field.id),
    fieldIds,
  };
}