import type {
  AnnotationDimensionName,
  CalculatedStateValue,
} from "@/lib/bazi/schema-types";

export type HybridDictionarySpec = {
  dimensionName: AnnotationDimensionName;
  sourceRelativePaths: readonly string[];
  buildKeywords: (calculatedState: CalculatedStateValue) => string[];
  buildNotes?: (calculatedState: CalculatedStateValue) => string[];
};

function pushUniqueKeyword(target: string[], value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized || target.includes(normalized)) {
    return;
  }

  target.push(normalized);
}

export function createBaseCalculatedKeywords(calculatedState: CalculatedStateValue) {
  const keywords: string[] = [];

  pushUniqueKeyword(keywords, calculatedState.dayMaster);
  pushUniqueKeyword(keywords, calculatedState.dayMasterStrengthProfile?.strengthState);
  pushUniqueKeyword(keywords, calculatedState.dayMasterStrengthProfile?.qiLabel);
  pushUniqueKeyword(keywords, calculatedState.sixtyJiaziCorePersona?.code);
  pushUniqueKeyword(keywords, calculatedState.sixtyJiaziCorePersona?.twelveQiLabel);

  for (const pillar of Object.values(calculatedState.fourPillars)) {
    pushUniqueKeyword(keywords, pillar.stem);
    pushUniqueKeyword(keywords, pillar.branch);
  }

  for (const value of Object.values(calculatedState.twelveQi)) {
    pushUniqueKeyword(keywords, value);
  }

  for (const element of calculatedState.elementAnalysis.dominantElements) {
    pushUniqueKeyword(keywords, element);
  }

  for (const element of calculatedState.elementAnalysis.missingElements) {
    pushUniqueKeyword(keywords, element);
  }

  return keywords;
}

export function createElementKeywords(calculatedState: CalculatedStateValue) {
  const keywords = createBaseCalculatedKeywords(calculatedState);

  for (const elementStrength of calculatedState.elementAnalysis.elementStrengths) {
    pushUniqueKeyword(keywords, elementStrength.element);
    pushUniqueKeyword(keywords, elementStrength.strength);
    pushUniqueKeyword(keywords, elementStrength.seasonalSupport);
  }

  return keywords;
}

export function createRelationKeywords(calculatedState: CalculatedStateValue) {
  const keywords = createBaseCalculatedKeywords(calculatedState);

  pushUniqueKeyword(keywords, "ชง");
  pushUniqueKeyword(keywords, "เฮ้ง");
  pushUniqueKeyword(keywords, "ไห่");
  pushUniqueKeyword(keywords, "ผั่ว");

  return keywords;
}

export function createLifeCycleKeywords(calculatedState: CalculatedStateValue) {
  const keywords = createBaseCalculatedKeywords(calculatedState);

  pushUniqueKeyword(keywords, "วัยจร");
  pushUniqueKeyword(keywords, calculatedState.daYun[0]?.stem);
  pushUniqueKeyword(keywords, calculatedState.daYun[0]?.branch);

  return keywords;
}
