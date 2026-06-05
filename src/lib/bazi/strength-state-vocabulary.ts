import {
  classifyOperatorStrengthScore,
  OPERATOR_STRENGTH_CLASS_BANDS,
  type OperatorStrengthBandId,
} from "@/lib/bazi/constants/operator-strength";

export const CANONICAL_DAY_MASTER_STRENGTH_STATES = [
  "อ่อนแอ",
  "แข็งแรง/สมดุล",
  "แข็งแรงมากเกินไป",
] as const;

export type CanonicalDayMasterStrengthState =
  (typeof CANONICAL_DAY_MASTER_STRENGTH_STATES)[number];

export const STRENGTH_DOCTRINE_SEMANTIC_IDS = [
  "reinforce-max",
  "reinforce",
  "circulate",
  "channel",
  "disperse-max",
] as const;

export type StrengthDoctrineSemanticId =
  (typeof STRENGTH_DOCTRINE_SEMANTIC_IDS)[number];

export const DAY_MASTER_STRENGTH_KNOWLEDGE_BOUNDARY = {
  bandSemantics: "constants/operator-strength",
  compiledLookupSemantics: "strength-state-vocabulary",
  compiledCorpusTable: "canonical-knowledge.dayMasterStrengthStates",
  repositoryLookup: "symbolic-engine.repository.findDayMasterStrengthProfile",
} as const;

export type StrengthStateMatchKind =
  | "canonical"
  | "alias"
  | "numeric"
  | "descriptive";

export type ResolvedStrengthState = {
  lookupState: CanonicalDayMasterStrengthState;
  repositoryLookupState: CanonicalDayMasterStrengthState;
  matchKind: StrengthStateMatchKind;
  sourceState: string;
  bandCoverage: OperatorStrengthBandId[];
  semanticCoverage: StrengthDoctrineSemanticId[];
};

export type DayMasterStrengthVocabulary = {
  bandId: OperatorStrengthBandId;
  semanticId: StrengthDoctrineSemanticId;
  sourceState: string;
  displayBand: string;
  displayLabel: string;
  lookupState: CanonicalDayMasterStrengthState;
  repositoryLookupState: CanonicalDayMasterStrengthState;
};

const EXACT_STRENGTH_STATE_TO_BAND_ID: Partial<Record<string, OperatorStrengthBandId>> =
  Object.fromEntries(
    OPERATOR_STRENGTH_CLASS_BANDS.flatMap((band) => [
      [band.label, band.id],
      [band.displayLabel, band.id],
    ]),
  );

const LOOKUP_STATE_TO_BAND_IDS: Record<
  CanonicalDayMasterStrengthState,
  OperatorStrengthBandId[]
> = {
  "อ่อนแอ": ["very-weak", "weak"],
  "แข็งแรง/สมดุล": ["balanced", "strong"],
  "แข็งแรงมากเกินไป": ["very-strong"],
};

const BAND_ID_TO_SEMANTIC_ID: Record<OperatorStrengthBandId, StrengthDoctrineSemanticId> = {
  "very-weak": "reinforce-max",
  weak: "reinforce",
  balanced: "circulate",
  strong: "channel",
  "very-strong": "disperse-max",
};

const DIRECT_STRENGTH_STATE_MAP: Record<string, CanonicalDayMasterStrengthState> = {
  "อ่อนแอ": "อ่อนแอ",
  "อ่อน": "อ่อนแอ",
  "อ่อนเกินไป": "อ่อนแอ",
  "ดวงอ่อน": "อ่อนแอ",
  "ดิถีอ่อน": "อ่อนแอ",
  "ดิถีอ่อนเกินไป": "อ่อนแอ",
  "แข็งแรง/สมดุล": "แข็งแรง/สมดุล",
  "สมดุล": "แข็งแรง/สมดุล",
  "ดวงแข็ง": "แข็งแรง/สมดุล",
  "ดิถีสมดุล": "แข็งแรง/สมดุล",
  "ดิถีแข็ง": "แข็งแรง/สมดุล",
  "แข็ง": "แข็งแรง/สมดุล",
  "แข็งเกือบอ่อน": "แข็งแรง/สมดุล",
  "แข็งแรงมากเกินไป": "แข็งแรงมากเกินไป",
  "แข็งเกินไป": "แข็งแรงมากเกินไป",
  "แข็งมากเกินไป": "แข็งแรงมากเกินไป",
  "ดิถีแข็งเกินไป": "แข็งแรงมากเกินไป",
};

function normalizeStrengthSourceText(rawState: string | null | undefined) {
  return rawState?.trim() ?? "";
}

function resolveNumericStrengthState(score: number): CanonicalDayMasterStrengthState {
  if (score < 4) {
    return "อ่อนแอ";
  }

  if (score < 7) {
    return "แข็งแรง/สมดุล";
  }

  return "แข็งแรงมากเกินไป";
}

export function resolveStrengthDoctrineSemanticId(
  bandId: OperatorStrengthBandId,
): StrengthDoctrineSemanticId {
  return BAND_ID_TO_SEMANTIC_ID[bandId];
}

export function resolveStrengthBandCoverageForLookupState(
  lookupState: CanonicalDayMasterStrengthState,
): OperatorStrengthBandId[] {
  return [...LOOKUP_STATE_TO_BAND_IDS[lookupState]];
}

function resolveBandCoverage(
  normalizedSourceState: string,
  lookupState: CanonicalDayMasterStrengthState,
): OperatorStrengthBandId[] {
  const exactBandId = EXACT_STRENGTH_STATE_TO_BAND_ID[normalizedSourceState];

  if (exactBandId) {
    return [exactBandId];
  }

  return resolveStrengthBandCoverageForLookupState(lookupState);
}

export function resolveCanonicalDayMasterStrengthState(
  rawState: string | null | undefined,
): ResolvedStrengthState | null {
  const normalized = normalizeStrengthSourceText(rawState);

  if (!normalized || normalized === "รูปแบบโดยสังเขป") {
    return null;
  }

  if (DIRECT_STRENGTH_STATE_MAP[normalized]) {
    const lookupState = DIRECT_STRENGTH_STATE_MAP[normalized];
    const bandCoverage = resolveBandCoverage(normalized, lookupState);

    return {
      lookupState,
      repositoryLookupState: lookupState,
      matchKind: lookupState === normalized ? "canonical" : "alias",
      sourceState: normalized,
      bandCoverage,
      semanticCoverage: bandCoverage.map(resolveStrengthDoctrineSemanticId),
    };
  }

  if (/^ต่ำกว่า\s*3/.test(normalized)) {
    const bandCoverage = resolveStrengthBandCoverageForLookupState("อ่อนแอ");

    return {
      lookupState: "อ่อนแอ",
      repositoryLookupState: "อ่อนแอ",
      matchKind: "descriptive",
      sourceState: normalized,
      bandCoverage,
      semanticCoverage: bandCoverage.map(resolveStrengthDoctrineSemanticId),
    };
  }

  if (/^[0-9]+(?:\.[0-9]+)?$/.test(normalized)) {
    const score = Number.parseFloat(normalized);
    const lookupState = resolveNumericStrengthState(score);
    const bandCoverage = [classifyOperatorStrengthScore(score).id];

    return {
      lookupState,
      repositoryLookupState: lookupState,
      matchKind: "numeric",
      sourceState: normalized,
      bandCoverage,
      semanticCoverage: bandCoverage.map(resolveStrengthDoctrineSemanticId),
    };
  }

  return null;
}

export function buildDayMasterStrengthVocabulary(score: number): DayMasterStrengthVocabulary {
  const band = classifyOperatorStrengthScore(score);
  const normalized = resolveCanonicalDayMasterStrengthState(band.label);

  if (!normalized) {
    throw new Error(`Unsupported operator strength band: ${band.label}`);
  }

  return {
    bandId: band.id,
    semanticId: resolveStrengthDoctrineSemanticId(band.id),
    sourceState: band.label,
    displayBand: band.label,
    displayLabel: band.displayLabel,
    lookupState: normalized.lookupState,
    repositoryLookupState: normalized.repositoryLookupState,
  };
}