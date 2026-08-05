import {
  CalculatedStateSchema,
  RawInputSchema,
  type AgeSnapshotValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import {
  buildCurrentReferenceSolar,
  buildDaYunState,
  buildLiuNianSeries,
  buildLiuNianState,
  buildOrthodoxMingGongValue,
  buildPillarValue,
  getBirthEightChar,
  isForwardDaYunDirection,
  normalizeBirthContext,
  normalizeGenderForYun,
  resolveTwelveQiStage,
} from "@/lib/bazi/symbolic-engine.birth";
export { HONG_KONG_TIMEZONE } from "@/lib/bazi/symbolic-engine.constants";
import {
  ELEMENT_LABELS_TH,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import {
  buildGeneralizedInteractionState,
  resolveBranchInteractionEffects,
} from "@/lib/bazi/symbolic-engine.interactions";
export {
  buildGeneralizedInteractionState,
  resolveBranchInteractionEffects,
} from "@/lib/bazi/symbolic-engine.interactions";
import {
  buildCompatibilityMatrixProfiles,
  normalizeCorpusBranchSymbol,
} from "@/lib/bazi/symbolic-engine.matrix";
export { buildCompatibilityMatrixProfiles } from "@/lib/bazi/symbolic-engine.matrix";
import { buildShenShaState } from "@/lib/bazi/symbolic-engine.shen-sha";
import {
  buildPrecedenceNoteSignals,
  buildSixtyJiaziSemanticNotes,
} from "@/lib/bazi/symbolic-engine.persona";
import { buildBaseChartReading } from "@/lib/bazi/symbolic-engine.base-chart";
import { renderContextRuleNoteEnglish } from "@/lib/bazi/symbolic-engine.context-notes";
import { computeDomainPower } from "@/lib/bazi/symbolic-engine.domain-power";
import {
  buildElementMetaphors,
  buildStrengthScoreExplainable,
} from "@/lib/bazi/symbolic-engine.strength";
import {
  buildDayMasterStrengthVocabulary,
} from "@/lib/bazi/strength-state-vocabulary";
import {
  buildElementAnalysis,
} from "@/lib/bazi/symbolic-engine.seasonal";
import {
  formatStagePair,
  getBranchTranslation,
  resolveDisplayStemPairStage,
  getStemElementTranslation,
  localizeTwelveQiLabel,
  resolveDisplayTwelveQiStage,
  resolveTenGodForStem,
} from "@/lib/bazi/pillar-display";
import type {
  BaziKnowledgeRepository,
  BaziStructuralState,
} from "@/lib/bazi/symbolic-engine.types";
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

function buildAgeSnapshot(
  birthContext: ReturnType<typeof normalizeBirthContext>,
  currentReferenceSolar: ReturnType<typeof buildCurrentReferenceSolar>,
): AgeSnapshotValue {
  const birthYear = birthContext.solar.getYear();
  const birthMonth = birthContext.solar.getMonth();
  const birthDay = birthContext.solar.getDay();
  const currentYear = currentReferenceSolar.getYear();
  const currentMonth = currentReferenceSolar.getMonth();
  const currentDay = currentReferenceSolar.getDay();
  const hasReachedBirthday = currentMonth > birthMonth
    || (currentMonth === birthMonth && currentDay >= birthDay);
  const thaiAge = Math.max(currentYear - birthYear - (hasReachedBirthday ? 0 : 1), 0);

  return {
    referenceDate: [
      currentYear,
      String(currentMonth).padStart(2, "0"),
      String(currentDay).padStart(2, "0"),
    ].join("-"),
    thaiAge,
    chineseAge: thaiAge + 1,
  };
}

function enrichPillar(
  pillar: BaziStructuralState["fourPillars"][keyof BaziStructuralState["fourPillars"]],
  options: {
    dayMasterStem: string;
    stemTenGod?: string;
    lookingStage?: string;
    hideUpperStage?: boolean;
    hideLowerContext?: boolean;
  },
) {
  const sittingStage = resolveDisplayTwelveQiStage(pillar.stem, pillar.branch) || undefined;
  const upperStagePrimary = options.hideUpperStage
    ? undefined
    : resolveDisplayStemPairStage(options.dayMasterStem, pillar.stem) || undefined;
  const lowerStagePrimary = options.lookingStage ? localizeTwelveQiLabel(options.lookingStage) : undefined;

  return {
    ...pillar,
    tenGod: options.stemTenGod,
    stemTranslation: getStemElementTranslation(pillar.stem) ?? undefined,
    branchTranslation: getBranchTranslation(pillar.branch) ?? undefined,
    sittingStage,
    lookingStage: lowerStagePrimary,
    upperStagePrimary,
    upperStageContext: upperStagePrimary ? sittingStage : undefined,
    upperStageDisplay: upperStagePrimary ? formatStagePair(upperStagePrimary, sittingStage) : undefined,
    lowerStagePrimary,
    lowerStageContext: lowerStagePrimary ? sittingStage : undefined,
    lowerStageDisplay: options.hideLowerContext
      ? lowerStagePrimary
      : (lowerStagePrimary ? formatStagePair(lowerStagePrimary, sittingStage) : undefined),
  };
}

function buildDynamicLuckStageDisplays(
  dayMasterStem: string,
  targetStem: string,
  targetBranch: string,
) {
  return {
    upperStageDisplay: resolveDisplayStemPairStage(dayMasterStem, targetStem) || undefined,
    lowerStageDisplay: resolveDisplayTwelveQiStage(dayMasterStem, targetBranch) || undefined,
  };
}

export function calculateBaziStructuralState(payload: RawInputValue): BaziStructuralState {
  const rawInput = RawInputSchema.parse(payload);
  const birthContext = normalizeBirthContext(rawInput);
  const eightChar = getBirthEightChar(birthContext.solar);
  const pillars = {
    year: buildPillarValue(eightChar.getYear(), eightChar.getYearHideGan()),
    month: buildPillarValue(eightChar.getMonth(), eightChar.getMonthHideGan()),
    day: buildPillarValue(eightChar.getDay(), eightChar.getDayHideGan()),
    hour: buildPillarValue(eightChar.getTime(), eightChar.getTimeHideGan()),
  };

  return {
    fourPillars: pillars,
    dayMaster: pillars.day.stem,
  };
}

export async function calculateBaziChart(
  payload: RawInputValue,
  repository: BaziKnowledgeRepository,
) {
  const rawInput = RawInputSchema.parse(payload);
  const birthContext = normalizeBirthContext(rawInput);
  const lunar = birthContext.solar.getLunar();
  const eightChar = getBirthEightChar(birthContext.solar);
  const forwardDirection = isForwardDaYunDirection(lunar as Parameters<typeof isForwardDaYunDirection>[0], rawInput.gender);
  const currentReferenceSolar = buildCurrentReferenceSolar();
  const currentReferenceEightChar = currentReferenceSolar.getLunar().getEightChar();
  const currentYear = currentReferenceSolar.getYear();
  const structuralState = calculateBaziStructuralState(rawInput);
  const pillars = structuralState.fourPillars;
  const dayMasterStem = structuralState.dayMaster;
  const ageSnapshot = buildAgeSnapshot(birthContext, currentReferenceSolar);
  const mingGong = buildOrthodoxMingGongValue(birthContext);
  const daYunState = buildDaYunState(
    birthContext,
    rawInput.gender,
    ageSnapshot.thaiAge,
    currentYear,
  );
  const currentDaYunEntry = eightChar
    .getYun(normalizeGenderForYun(rawInput.gender))
    .getDaYun()
    .find((entry) => entry.getGanZhi().trim().length > 0 && entry.getLiuNian().some((liuNian) => liuNian.getYear() === currentYear));
  const liuNian = buildLiuNianState(currentDaYunEntry, currentYear, currentReferenceEightChar);
  const currentDaYunPillar = daYunState.find((entry) => entry.isCurrent);
  const enrichedDaYunState = daYunState.map((entry) => {
    const dynamicDisplays = buildDynamicLuckStageDisplays(dayMasterStem, entry.stem, entry.branch);

    return {
      ...entry,
      ...dynamicDisplays,
      upperPhase: entry.upperPhase
        ? {
            ...entry.upperPhase,
            twelveQiDisplay: dynamicDisplays.upperStageDisplay,
          }
        : undefined,
      lowerPhase: entry.lowerPhase
        ? {
            ...entry.lowerPhase,
            twelveQiDisplay: dynamicDisplays.lowerStageDisplay,
          }
        : undefined,
    };
  });
  const enrichedLiuNian = liuNian
    ? {
        ...liuNian,
        ...buildDynamicLuckStageDisplays(dayMasterStem, liuNian.stem, liuNian.branch),
      }
    : undefined;
  // ปีจรรายปีแบบเต็ม (P-B) — กรอบปัจจุบัน → อีก 20 ปีข้างหน้า พร้อม 12 เชี่ยงแซของกิ่งปี
  const liuNianSeries = buildLiuNianSeries(eightChar, rawInput.gender, ageSnapshot.thaiAge, 20).map(
    (entry) => ({
      ...entry,
      twelveQiDisplay: localizeTwelveQiLabel(resolveTwelveQiStage(dayMasterStem, entry.branch)),
    }),
  );
  const canonicalTwelveQiState = {
    yearBranch: eightChar.getYearDiShi(),
    monthBranch: eightChar.getMonthDiShi(),
    dayBranch: eightChar.getDayDiShi(),
    hourBranch: eightChar.getTimeDiShi(),
    mingGongBranch: resolveTwelveQiStage(dayMasterStem, mingGong.value.branch),
    ...(currentDaYunPillar
      ? { currentDaYunBranch: resolveTwelveQiStage(dayMasterStem, currentDaYunPillar.branch) }
      : {}),
    ...(liuNian?.branch
      ? { currentLiuNianBranch: resolveTwelveQiStage(dayMasterStem, liuNian.branch) }
      : {}),
  };
  const twelveQiState = Object.fromEntries(
    Object.entries(canonicalTwelveQiState).map(([key, value]) => [key, localizeTwelveQiLabel(value)]),
  );
  const enrichedPillars = {
    year: enrichPillar(pillars.year, {
      dayMasterStem,
      stemTenGod: eightChar.getYearShiShenGan(),
      lookingStage: canonicalTwelveQiState.yearBranch,
    }),
    month: enrichPillar(pillars.month, {
      dayMasterStem,
      stemTenGod: eightChar.getMonthShiShenGan(),
      lookingStage: canonicalTwelveQiState.monthBranch,
    }),
    day: enrichPillar(pillars.day, {
      dayMasterStem,
      stemTenGod: "ดิถี",
      lookingStage: canonicalTwelveQiState.dayBranch,
      hideUpperStage: true,
      hideLowerContext: true,
    }),
    hour: enrichPillar(pillars.hour, {
      dayMasterStem,
      stemTenGod: eightChar.getTimeShiShenGan(),
      lookingStage: canonicalTwelveQiState.hourBranch,
    }),
  };
  const mingGongSittingStage = resolveDisplayTwelveQiStage(mingGong.value.stem, mingGong.value.branch) || undefined;
  const mingGongUpperPrimary = resolveDisplayStemPairStage(dayMasterStem, mingGong.value.stem) || undefined;
  const mingGongLowerPrimary = localizeTwelveQiLabel(canonicalTwelveQiState.mingGongBranch) || undefined;
  const enrichedMingGong = {
    ...mingGong.value,
    tenGod: resolveTenGodForStem(dayMasterStem, mingGong.value.stem) || undefined,
    stemTranslation: getStemElementTranslation(mingGong.value.stem) ?? undefined,
    branchTranslation: getBranchTranslation(mingGong.value.branch) ?? undefined,
    sittingStage: mingGongSittingStage,
    lookingStage: mingGongLowerPrimary,
    upperStagePrimary: mingGongUpperPrimary,
    upperStageContext: mingGongUpperPrimary ? mingGongSittingStage : undefined,
    upperStageDisplay: mingGongUpperPrimary ? formatStagePair(mingGongUpperPrimary, mingGongSittingStage) : undefined,
    lowerStagePrimary: mingGongLowerPrimary,
    lowerStageContext: mingGongLowerPrimary ? mingGongSittingStage : undefined,
    lowerStageDisplay: mingGongLowerPrimary ? formatStagePair(mingGongLowerPrimary, mingGongSittingStage) : undefined,
  };
  const interactionResolution = resolveBranchInteractionEffects(pillars);
  const interactionState = buildGeneralizedInteractionState({
    pillars,
    dayMasterStem,
    twelveQiByBranch: {
      year: canonicalTwelveQiState.yearBranch,
      month: canonicalTwelveQiState.monthBranch,
      day: canonicalTwelveQiState.dayBranch,
      hour: canonicalTwelveQiState.hourBranch,
    },
    resolution: interactionResolution,
  });
  interactionResolution.interactionState = interactionState;
  const elementAnalysis = buildElementAnalysis(pillars);
  const strengthScore = buildStrengthScoreExplainable(
    dayMasterStem,
    pillars,
    {
      year: canonicalTwelveQiState.yearBranch,
      month: canonicalTwelveQiState.monthBranch,
      day: canonicalTwelveQiState.dayBranch,
      hour: canonicalTwelveQiState.hourBranch,
    },
    interactionResolution,
  );
  const strengthVocabulary = buildDayMasterStrengthVocabulary(strengthScore.value);
  const [dayMasterStrengthProfile, persona, solarTerms, loveMatrixRows, workMatrixRows] = await Promise.all([
    repository.findDayMasterStrengthProfile(dayMasterStem, strengthVocabulary.lookupState, strengthScore.value),
    repository.findSixtyJiaziPersona(dayMasterStem, pillars.day.branch),
    repository.findSolarTermBoundaryContext(birthContext.birthAtHongKong),
    repository.findDomainMatrixRows("love"),
    repository.findDomainMatrixRows("work"),
  ]);
  const compatibilityMatrixProfiles = buildCompatibilityMatrixProfiles(dayMasterStem, [
    ...loveMatrixRows,
    ...workMatrixRows,
  ]);
  const precedenceNoteSignals = buildPrecedenceNoteSignals(
    birthContext.birthAtHongKong,
    solarTerms,
    persona,
    interactionResolution,
  );
  const shenSha = buildShenShaState({
    pillars,
    dayMasterStem,
    mingGong: mingGong.value,
    liuNian: enrichedLiuNian,
    currentDaYun: currentDaYunPillar,
  });
  const baseChartReading = buildBaseChartReading({
    dayMasterStem,
    pillars: enrichedPillars,
    shenSha,
    resolution: interactionResolution,
    precedenceSignals: precedenceNoteSignals,
    interactionState,
  });

  const calculatedState = CalculatedStateSchema.parse({
    fourPillars: enrichedPillars,
    ageSnapshot,
    mingGong: enrichedMingGong,
    daYun: enrichedDaYunState,
    liuNian: enrichedLiuNian,
    liuNianSeries,
    shenSha,
    dayMaster: dayMasterStem,
    strengthScore: strengthScore.value,
    tenGods: {
      yearStem: eightChar.getYearShiShenGan(),
      yearBranch: String(eightChar.getYearShiShenZhi()),
      monthStem: eightChar.getMonthShiShenGan(),
      monthBranch: String(eightChar.getMonthShiShenZhi()),
      dayStem: eightChar.getDayShiShenGan(),
      dayBranch: String(eightChar.getDayShiShenZhi()),
      hourStem: eightChar.getTimeShiShenGan(),
      hourBranch: String(eightChar.getTimeShiShenZhi()),
      mingGongStem: enrichedMingGong.tenGod ?? "",
    },
    twelveQi: twelveQiState,
    elementMetaphors: buildElementMetaphors(dayMasterStem),
    elementAnalysis,
    dayMasterStrengthProfile: dayMasterStrengthProfile
      ? {
          dayMaster: dayMasterStrengthProfile.dayMaster,
          strengthState: dayMasterStrengthProfile.lookupState,
          sourceState: dayMasterStrengthProfile.sourceState ?? undefined,
          lookupState: dayMasterStrengthProfile.lookupState,
          displayBand: strengthVocabulary.displayBand,
          displayLabel: strengthVocabulary.displayLabel,
          narrative: dayMasterStrengthProfile.narrative,
          narrativeReason: buildNarrativeReason(
            dayMasterStem,
            strengthScore.value,
            twelveQiState.monthBranch,
            strengthVocabulary.displayLabel,
          ),
          qiLabel: dayMasterStrengthProfile.qiLabel ?? undefined,
          scoreText: dayMasterStrengthProfile.scoreText ?? undefined,
        }
      : undefined,
    explainable: {
      mingGong,
      strengthScore,
    },
    sixtyJiaziCorePersona: persona?.combinedNarrative
      ? {
          code: `${pillars.day.stem}${pillars.day.branch}`,
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
    interactionState,
    baseChartReading,
    compatibilityMatrixProfiles,
    isForwardDirection: forwardDirection,
    domainPower: computeDomainPower({
      year: { stem: pillars.year.stem, branch: pillars.year.branch },
      month: { stem: pillars.month.stem, branch: pillars.month.branch },
      day: { stem: pillars.day.stem, branch: pillars.day.branch },
      hour: { stem: pillars.hour.stem, branch: pillars.hour.branch },
    }),
  });

  return calculatedState;
}
