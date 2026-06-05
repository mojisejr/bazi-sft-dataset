import {
  CalculatedStateSchema,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import {
} from "@/lib/bazi/symbolic-engine.birth";
export { HONG_KONG_TIMEZONE } from "@/lib/bazi/symbolic-engine.constants";
import {
  ELEMENT_LABELS_TH,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
export {
  buildGeneralizedInteractionState,
  resolveBranchInteractionEffects,
} from "@/lib/bazi/symbolic-engine.interactions";
import {
  buildCompatibilityMatrixProfiles,
  normalizeCorpusBranchSymbol,
} from "@/lib/bazi/symbolic-engine.matrix";
export { buildCompatibilityMatrixProfiles } from "@/lib/bazi/symbolic-engine.matrix";
import {
  calculateBaziFactState,
} from "@/lib/bazi/symbolic-engine.os-core";
export {
  calculateBaziFactState,
  calculateBaziStructuralState,
} from "@/lib/bazi/symbolic-engine.os-core";
import { buildShenShaState } from "@/lib/bazi/symbolic-engine.shen-sha";
import {
  buildPrecedenceNoteSignals,
  buildSixtyJiaziSemanticNotes,
} from "@/lib/bazi/symbolic-engine.persona";
import { buildBaseChartReading } from "@/lib/bazi/symbolic-engine.base-chart";
import { renderContextRuleNoteEnglish } from "@/lib/bazi/symbolic-engine.context-notes";
import {
  buildElementMetaphors,
} from "@/lib/bazi/symbolic-engine.strength";
import {
  buildDayMasterStrengthVocabulary,
} from "@/lib/bazi/strength-state-vocabulary";
export {
  buildSource1OperatingSystemContract,
  buildSource1StrengthContract,
  SOURCE1_CONTRACT_FIELDS,
  SOURCE1_GOLDEN_REFERENCE_CASE,
} from "@/lib/bazi/source1-operating-system-contract";
import {
} from "@/lib/bazi/symbolic-engine.seasonal";
import type { BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine.types";
export type {
  BaziKnowledgeRepository,
  BaziStructuralState,
} from "@/lib/bazi/symbolic-engine.types";

function buildNarrativeReason(
  dayMasterStem: string,
  strengthScoreValue: number,
  twelveQiMonthBranch: string | null,
  displayLabel: string | undefined,
): string {
  const element = STEM_TO_ELEMENT[dayMasterStem as keyof typeof STEM_TO_ELEMENT];
  const elementLabel = element ? ELEMENT_LABELS_TH[element] : dayMasterStem;
  const strengthLabel = displayLabel ?? (strengthScoreValue >= 4 ? "แข็งแรง" : strengthScoreValue >= 3 ? "สมดุล" : "อ่อน");
  const stageLabel = twelveQiMonthBranch ?? "";

  const parts: string[] = [];
  parts.push(`ดิถี${elementLabel} ${strengthLabel}`);

  if (stageLabel) {
    parts.push(`เพราะได้ชั้น ${stageLabel} จากเดือนเกิด`);
  }

  if (strengthScoreValue >= 4) {
    parts.push("มีแรงหนุนจากฤดูและสาขาที่ส่งเสริมมากกว่าหักล้าง");
  } else if (strengthScoreValue < 3) {
    parts.push("ต้องอาศัยแรงหนุนจากภายนอกจึงจะออกผลดี");
  }

  return parts.join(" ");
}

export async function calculateBaziChart(
  payload: RawInputValue,
  repository: BaziKnowledgeRepository,
) {
  const factState = calculateBaziFactState(payload);
  const strengthVocabulary = buildDayMasterStrengthVocabulary(factState.strengthScore);
  const [dayMasterStrengthProfile, persona, solarTerms, loveMatrixRows, workMatrixRows] = await Promise.all([
    repository.findDayMasterStrengthProfile(
      factState.dayMaster,
      strengthVocabulary.repositoryLookupState,
      factState.strengthScore,
    ),
    repository.findSixtyJiaziPersona(factState.dayMaster, factState.structuralState.fourPillars.day.branch),
    repository.findSolarTermBoundaryContext(factState.birthContext.birthAtHongKong),
    repository.findDomainMatrixRows("love"),
    repository.findDomainMatrixRows("work"),
  ]);
  const compatibilityMatrixProfiles = buildCompatibilityMatrixProfiles(factState.dayMaster, [
    ...loveMatrixRows,
    ...workMatrixRows,
  ]);
  const precedenceNoteSignals = buildPrecedenceNoteSignals(
    factState.birthContext.birthAtHongKong,
    solarTerms,
    persona,
    factState.interactionResolution,
  );
  const shenSha = buildShenShaState({
    pillars: factState.structuralState.fourPillars,
    dayMasterStem: factState.dayMaster,
    mingGong: factState.mingGong,
    liuNian: factState.liuNian,
    currentDaYun: factState.currentDaYun,
  });
  const baseChartReading = buildBaseChartReading({
    dayMasterStem: factState.dayMaster,
    pillars: factState.fourPillars,
    shenSha,
    resolution: factState.interactionResolution,
    precedenceSignals: precedenceNoteSignals,
    interactionState: factState.interactionState,
  });

  const calculatedState = CalculatedStateSchema.parse({
    fourPillars: factState.fourPillars,
    ageSnapshot: factState.ageSnapshot,
    mingGong: factState.mingGong,
    daYun: factState.daYun,
    liuNian: factState.liuNian,
    shenSha,
    dayMaster: factState.dayMaster,
    strengthScore: factState.strengthScore,
    tenGods: factState.roleOfElementFacts.tenGods,
    twelveQi: factState.twelveQi.display,
    elementMetaphors: buildElementMetaphors(factState.dayMaster),
    elementAnalysis: factState.elementAnalysis,
    dayMasterStrengthProfile: dayMasterStrengthProfile
      ? {
          dayMaster: dayMasterStrengthProfile.dayMaster,
          bandId: strengthVocabulary.bandId,
          semanticId: strengthVocabulary.semanticId,
          strengthState: dayMasterStrengthProfile.lookupState,
          sourceState: dayMasterStrengthProfile.sourceState ?? undefined,
          lookupState: dayMasterStrengthProfile.lookupState,
          repositoryLookupState: strengthVocabulary.repositoryLookupState,
          displayBand: strengthVocabulary.displayBand,
          displayLabel: strengthVocabulary.displayLabel,
          narrative: dayMasterStrengthProfile.narrative,
          narrativeReason: buildNarrativeReason(
            factState.dayMaster,
            factState.strengthScore,
            factState.twelveQi.display.monthBranch,
            strengthVocabulary.displayLabel,
          ),
          qiLabel: dayMasterStrengthProfile.qiLabel ?? undefined,
          scoreText: dayMasterStrengthProfile.scoreText ?? undefined,
        }
      : undefined,
    explainable: factState.explainable,
    sixtyJiaziCorePersona: persona?.combinedNarrative
      ? {
          code: `${factState.structuralState.fourPillars.day.stem}${factState.structuralState.fourPillars.day.branch}`,
          narrative: persona.combinedNarrative,
          heavenNarrative: persona.dayMasterNarrative ?? undefined,
          earthNarrative: persona.branchNarrative ?? undefined,
          elementTone: persona.elementTone ?? undefined,
          twelveQiLabel: persona.twelveQiLabel
            ? normalizeCorpusBranchSymbol(persona.twelveQiLabel)
            : undefined,
          semanticNotes: buildSixtyJiaziSemanticNotes(persona),
          precedenceNotes: precedenceNoteSignals.map((signal) =>
            renderContextRuleNoteEnglish(signal),
          ),
          precedenceNoteSignals,
        }
      : undefined,
    interactionState: factState.interactionState,
    baseChartReading,
    compatibilityMatrixProfiles,
    isForwardDirection: factState.isForwardDirection,
  });

  return calculatedState;
}
