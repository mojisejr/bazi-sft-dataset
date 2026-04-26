import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";

export const CANONICAL_DAY_MASTER_STRENGTH_STATES = [
  "อ่อนแอ",
  "แข็งแรง/สมดุล",
  "แข็งแรงมากเกินไป",
] as const;

export type CanonicalDayMasterStrengthState =
  (typeof CANONICAL_DAY_MASTER_STRENGTH_STATES)[number];

export type StrengthStateMatchKind =
  | "canonical"
  | "alias"
  | "numeric"
  | "descriptive";

export type ResolvedStrengthState = {
  lookupState: CanonicalDayMasterStrengthState;
  matchKind: StrengthStateMatchKind;
  sourceState: string;
};

export type DayMasterStrengthVocabulary = {
  displayBand: string;
  displayLabel: string;
  lookupState: CanonicalDayMasterStrengthState;
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

export function resolveCanonicalDayMasterStrengthState(
  rawState: string | null | undefined,
): ResolvedStrengthState | null {
  const normalized = normalizeStrengthSourceText(rawState);

  if (!normalized || normalized === "รูปแบบโดยสังเขป") {
    return null;
  }

  if (DIRECT_STRENGTH_STATE_MAP[normalized]) {
    const lookupState = DIRECT_STRENGTH_STATE_MAP[normalized];

    return {
      lookupState,
      matchKind: lookupState === normalized ? "canonical" : "alias",
      sourceState: normalized,
    };
  }

  if (/^ต่ำกว่า\s*3/.test(normalized)) {
    return {
      lookupState: "อ่อนแอ",
      matchKind: "descriptive",
      sourceState: normalized,
    };
  }

  if (/^[0-9]+(?:\.[0-9]+)?$/.test(normalized)) {
    return {
      lookupState: resolveNumericStrengthState(Number.parseFloat(normalized)),
      matchKind: "numeric",
      sourceState: normalized,
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
    displayBand: band.label,
    displayLabel: band.displayLabel,
    lookupState: normalized.lookupState,
  };
}