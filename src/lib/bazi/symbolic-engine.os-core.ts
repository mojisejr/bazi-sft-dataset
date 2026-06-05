import type {
  AgeSnapshotValue,
  CalculatedStateExplainableValue,
  CalculatedStateValue,
  RawInputValue,
} from "@/lib/bazi/schema-types";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import {
  buildCurrentReferenceSolar,
  buildDaYunState,
  buildLiuNianState,
  buildOrthodoxMingGongValue,
  buildPillarValue,
  isForwardDaYunDirection,
  normalizeBirthContext,
  normalizeGenderForYun,
  resolveTwelveQiStage,
} from "@/lib/bazi/symbolic-engine.birth";
import {
  buildGeneralizedInteractionState,
  resolveBranchInteractionEffects,
} from "@/lib/bazi/symbolic-engine.interactions";
import {
  buildElementAnalysis,
  buildSeasonalInteraction,
} from "@/lib/bazi/symbolic-engine.seasonal";
import { buildStrengthScoreExplainable } from "@/lib/bazi/symbolic-engine.strength";
import type {
  BaziOsCoreFactState,
  BaziStructuralState,
} from "@/lib/bazi/symbolic-engine.types";
import {
  formatStagePair,
  getBranchTranslation,
  getStemElementTranslation,
  localizeTwelveQiLabel,
  resolveDisplayStemPairStage,
  resolveDisplayTwelveQiStage,
  resolveTenGodForStem,
} from "@/lib/bazi/pillar-display";

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

function normalizeCurrentPhase(value: string | undefined): "upper" | "lower" | undefined {
  if (value === "upper" || value === "lower") {
    return value;
  }

  return undefined;
}

export function calculateBaziStructuralState(payload: RawInputValue): BaziStructuralState {
  const rawInput = RawInputSchema.parse(payload);
  const birthContext = normalizeBirthContext(rawInput);
  const eightChar = birthContext.solar.getLunar().getEightChar();
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

export function calculateBaziFactState(payload: RawInputValue): BaziOsCoreFactState {
  const rawInput = RawInputSchema.parse(payload);
  const birthContext = normalizeBirthContext(rawInput);
  const lunar = birthContext.solar.getLunar();
  const eightChar = lunar.getEightChar();
  const currentReferenceSolar = buildCurrentReferenceSolar();
  const currentReferenceEightChar = currentReferenceSolar.getLunar().getEightChar();
  const currentYear = currentReferenceSolar.getYear();
  const structuralState = calculateBaziStructuralState(rawInput);
  const pillars = structuralState.fourPillars;
  const dayMasterStem = structuralState.dayMaster;
  const ageSnapshot = buildAgeSnapshot(birthContext, currentReferenceSolar);
  const forwardDirection = isForwardDaYunDirection(
    lunar as Parameters<typeof isForwardDaYunDirection>[0],
    rawInput.gender,
  );
  const mingGongExplainable = buildOrthodoxMingGongValue(birthContext);
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
  const daYun: CalculatedStateValue["daYun"] = daYunState.map((entry) => {
    const dynamicDisplays = buildDynamicLuckStageDisplays(dayMasterStem, entry.stem, entry.branch);

    return {
      ...entry,
      ...dynamicDisplays,
      currentPhase: normalizeCurrentPhase(entry.currentPhase),
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
  const currentDaYun = daYun.find((entry) => entry.isCurrent);
  const enrichedLiuNian = liuNian
    ? {
        ...liuNian,
        ...buildDynamicLuckStageDisplays(dayMasterStem, liuNian.stem, liuNian.branch),
      }
    : undefined;
  const twelveQiRaw: BaziOsCoreFactState["twelveQi"]["raw"] = {
    yearBranch: eightChar.getYearDiShi(),
    monthBranch: eightChar.getMonthDiShi(),
    dayBranch: eightChar.getDayDiShi(),
    hourBranch: eightChar.getTimeDiShi(),
    mingGongBranch: resolveTwelveQiStage(dayMasterStem, mingGongExplainable.value.branch),
    ...(currentDaYun?.branch
      ? { currentDaYunBranch: resolveTwelveQiStage(dayMasterStem, currentDaYun.branch) }
      : {}),
    ...(enrichedLiuNian?.branch
      ? { currentLiuNianBranch: resolveTwelveQiStage(dayMasterStem, enrichedLiuNian.branch) }
      : {}),
  };
  const twelveQiDisplay = Object.fromEntries(
    Object.entries(twelveQiRaw).map(([key, value]) => [key, localizeTwelveQiLabel(value)]),
  ) as CalculatedStateValue["twelveQi"];
  const fourPillars = {
    year: enrichPillar(pillars.year, {
      dayMasterStem,
      stemTenGod: eightChar.getYearShiShenGan(),
      lookingStage: twelveQiRaw.yearBranch,
    }),
    month: enrichPillar(pillars.month, {
      dayMasterStem,
      stemTenGod: eightChar.getMonthShiShenGan(),
      lookingStage: twelveQiRaw.monthBranch,
    }),
    day: enrichPillar(pillars.day, {
      dayMasterStem,
      stemTenGod: "ดิถี",
      lookingStage: twelveQiRaw.dayBranch,
      hideUpperStage: true,
      hideLowerContext: true,
    }),
    hour: enrichPillar(pillars.hour, {
      dayMasterStem,
      stemTenGod: eightChar.getTimeShiShenGan(),
      lookingStage: twelveQiRaw.hourBranch,
    }),
  };
  const mingGongSittingStage = resolveDisplayTwelveQiStage(
    mingGongExplainable.value.stem,
    mingGongExplainable.value.branch,
  ) || undefined;
  const mingGongUpperPrimary = resolveDisplayStemPairStage(dayMasterStem, mingGongExplainable.value.stem) || undefined;
  const mingGongLowerPrimary = localizeTwelveQiLabel(twelveQiRaw.mingGongBranch) || undefined;
  const mingGong = {
    ...mingGongExplainable.value,
    tenGod: resolveTenGodForStem(dayMasterStem, mingGongExplainable.value.stem) || undefined,
    stemTranslation: getStemElementTranslation(mingGongExplainable.value.stem) ?? undefined,
    branchTranslation: getBranchTranslation(mingGongExplainable.value.branch) ?? undefined,
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
      year: twelveQiRaw.yearBranch,
      month: twelveQiRaw.monthBranch,
      day: twelveQiRaw.dayBranch,
      hour: twelveQiRaw.hourBranch,
    },
    resolution: interactionResolution,
  });
  interactionResolution.interactionState = interactionState;
  const strengthScoreExplainable = buildStrengthScoreExplainable(
    dayMasterStem,
    pillars,
    {
      year: twelveQiRaw.yearBranch,
      month: twelveQiRaw.monthBranch,
      day: twelveQiRaw.dayBranch,
      hour: twelveQiRaw.hourBranch,
    },
    interactionResolution,
  );

  return {
    input: rawInput,
    birthContext,
    structuralState,
    fourPillars,
    dayMaster: dayMasterStem,
    strengthScore: strengthScoreExplainable.value,
    roleOfElementFacts: {
      tenGods: {
        yearStem: eightChar.getYearShiShenGan(),
        yearBranch: String(eightChar.getYearShiShenZhi()),
        monthStem: eightChar.getMonthShiShenGan(),
        monthBranch: String(eightChar.getMonthShiShenZhi()),
        dayStem: eightChar.getDayShiShenGan(),
        dayBranch: String(eightChar.getDayShiShenZhi()),
        hourStem: eightChar.getTimeShiShenGan(),
        hourBranch: String(eightChar.getTimeShiShenZhi()),
        mingGongStem: mingGong.tenGod ?? "",
      },
      seasonalInteraction: buildSeasonalInteraction(dayMasterStem, pillars.month.branch),
    },
    twelveQi: {
      raw: twelveQiRaw,
      display: twelveQiDisplay,
    },
    interactionResolution,
    interactionState,
    daYun,
    currentDaYun,
    liuNian: enrichedLiuNian,
    ageSnapshot,
    mingGong,
    traceMetadata: {
      mingGong: mingGongExplainable.trace,
      strengthScore: strengthScoreExplainable.trace,
    },
    explainable: {
      mingGong: mingGongExplainable,
      strengthScore: strengthScoreExplainable,
    } as CalculatedStateExplainableValue,
    elementAnalysis: buildElementAnalysis(pillars),
    isForwardDirection: forwardDirection,
  };
}