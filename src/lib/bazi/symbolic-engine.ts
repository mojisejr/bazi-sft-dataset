import { and, asc, desc, eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import {
  baziDayMasterStrengthStates,
  baziDomainMatrices,
  baziSixtyJiaziNarratives,
  baziTimeSolarTerms,
} from "@/db/schema";
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import {
  CalculatedStateSchema,
  RawInputSchema,
  type AgeSnapshotValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import {
  buildCurrentReferenceSolar,
  buildDaYunState,
  buildLiuNianState,
  buildOrthodoxMingGongValue,
  buildPillarValue,
  normalizeBirthContext,
  normalizeGenderForYun,
  resolveTwelveQiStage,
} from "@/lib/bazi/symbolic-engine.birth";
export { HONG_KONG_TIMEZONE } from "@/lib/bazi/symbolic-engine.constants";
import {
  resolveBranchInteractionEffects,
} from "@/lib/bazi/symbolic-engine.interactions";
export {
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
import { renderContextRuleNoteEnglish } from "@/lib/bazi/symbolic-engine.context-notes";
import {
  buildElementMetaphors,
  buildStrengthScoreExplainable,
} from "@/lib/bazi/symbolic-engine.strength";
import {
  buildElementAnalysis,
} from "@/lib/bazi/symbolic-engine.seasonal";
import type {
  BaziKnowledgeRepository,
  BaziStructuralState,
} from "@/lib/bazi/symbolic-engine.types";
export type {
  BaziKnowledgeRepository,
  BaziStructuralState,
} from "@/lib/bazi/symbolic-engine.types";

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

const DAY_MASTER_STRENGTH_STATE_LOOKUP = {
  "อ่อนเกินไป": "อ่อนแอ",
  "ดวงอ่อน": "อ่อนแอ",
  "สมดุล": "แข็งแรง/สมดุล",
  "ดวงแข็ง": "แข็งแรง/สมดุล",
  "แข็งเกินไป": "แข็งแรงมากเกินไป",
} as const;

function normalizeDayMasterStrengthState(strengthState: string) {
  return DAY_MASTER_STRENGTH_STATE_LOOKUP[
    strengthState as keyof typeof DAY_MASTER_STRENGTH_STATE_LOOKUP
  ] ?? strengthState;
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

export function createDbKnowledgeRepository(databaseUrl?: string): BaziKnowledgeRepository {
  const db = createDbClient(databaseUrl);

  return {
    async findSolarTermBoundaryContext(birthAtHongKong) {
      const [previous] = await db
        .select({
          label: baziTimeSolarTerms.label,
          solarTermName: baziTimeSolarTerms.solarTermName,
          boundaryAt: baziTimeSolarTerms.boundaryAt,
        })
        .from(baziTimeSolarTerms)
        .where(sql`${baziTimeSolarTerms.boundaryAt} is not null and ${baziTimeSolarTerms.boundaryAt} <= ${birthAtHongKong}`)
        .orderBy(desc(baziTimeSolarTerms.boundaryAt))
        .limit(1);

      const [next] = await db
        .select({
          label: baziTimeSolarTerms.label,
          solarTermName: baziTimeSolarTerms.solarTermName,
          boundaryAt: baziTimeSolarTerms.boundaryAt,
        })
        .from(baziTimeSolarTerms)
        .where(sql`${baziTimeSolarTerms.boundaryAt} is not null and ${baziTimeSolarTerms.boundaryAt} > ${birthAtHongKong}`)
        .orderBy(asc(baziTimeSolarTerms.boundaryAt))
        .limit(1);

      return {
        previous: previous ?? null,
        next: next ?? null,
      };
    },

    async findSixtyJiaziPersona(dayMasterChinese, branchChinese) {
      const [persona] = await db
        .select({
          dayMasterChinese: baziSixtyJiaziNarratives.dayMasterChinese,
          branchChinese: baziSixtyJiaziNarratives.branchChinese,
          elementTone: baziSixtyJiaziNarratives.elementTone,
          twelveQiLabel: baziSixtyJiaziNarratives.twelveQiLabel,
          combinedNarrative: baziSixtyJiaziNarratives.combinedNarrative,
        })
        .from(baziSixtyJiaziNarratives)
        .where(
          and(
            eq(baziSixtyJiaziNarratives.dayMasterChinese, dayMasterChinese),
            eq(baziSixtyJiaziNarratives.branchChinese, branchChinese),
          ),
        )
        .limit(1);

      return persona ?? null;
    },

    async findDayMasterStrengthProfile(dayMasterChinese, strengthState) {
      const [profile] = await db
        .select({
          dayMaster: baziDayMasterStrengthStates.dayMasterChinese,
          strengthState: baziDayMasterStrengthStates.strengthState,
          narrative: baziDayMasterStrengthStates.narrativeSummary,
          qiLabel: baziDayMasterStrengthStates.qiLabel,
          scoreText: baziDayMasterStrengthStates.scoreText,
        })
        .from(baziDayMasterStrengthStates)
        .where(
          and(
            eq(baziDayMasterStrengthStates.dayMasterChinese, dayMasterChinese),
            eq(baziDayMasterStrengthStates.strengthState, strengthState),
          ),
        )
        .orderBy(asc(baziDayMasterStrengthStates.rowOrder))
        .limit(1);

      if (!profile?.dayMaster || !profile.strengthState || !profile.narrative) {
        return null;
      }

      return {
        dayMaster: profile.dayMaster,
        strengthState: profile.strengthState,
        narrative: profile.narrative,
        qiLabel: profile.qiLabel,
        scoreText: profile.scoreText,
      };
    },

    async findDomainMatrixRows(domain) {
      return db
        .select({
          domain: baziDomainMatrices.domain,
          sourceVariant: baziDomainMatrices.sourceVariant,
          pairKey: baziDomainMatrices.pairKey,
          rowOrder: baziDomainMatrices.rowOrder,
          code: baziDomainMatrices.code,
          label: baziDomainMatrices.label,
          scoreText: baziDomainMatrices.scoreText,
          narrative: baziDomainMatrices.narrative,
          rawCells: baziDomainMatrices.rawCells,
        })
        .from(baziDomainMatrices)
        .where(eq(baziDomainMatrices.domain, domain))
        .orderBy(asc(baziDomainMatrices.sourceVariant), asc(baziDomainMatrices.rowOrder));
    },
  };
}

export async function calculateBaziChart(
  payload: RawInputValue,
  repository: BaziKnowledgeRepository,
) {
  const rawInput = RawInputSchema.parse(payload);
  const birthContext = normalizeBirthContext(rawInput);
  const eightChar = birthContext.solar.getLunar().getEightChar();
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
  const twelveQiState = {
    yearBranch: eightChar.getYearDiShi(),
    monthBranch: eightChar.getMonthDiShi(),
    dayBranch: eightChar.getDayDiShi(),
    hourBranch: eightChar.getTimeDiShi(),
    ...(currentDaYunPillar
      ? { currentDaYunBranch: resolveTwelveQiStage(dayMasterStem, currentDaYunPillar.branch) }
      : {}),
    ...(liuNian?.branch
      ? { currentLiuNianBranch: resolveTwelveQiStage(dayMasterStem, liuNian.branch) }
      : {}),
  };
  const interactionResolution = resolveBranchInteractionEffects(pillars);
  const elementAnalysis = buildElementAnalysis(pillars);
  const strengthScore = buildStrengthScoreExplainable(
    dayMasterStem,
    pillars,
    {
      year: twelveQiState.yearBranch,
      month: twelveQiState.monthBranch,
      day: twelveQiState.dayBranch,
      hour: twelveQiState.hourBranch,
    },
    interactionResolution,
  );
  const currentStrengthBand = classifyOperatorStrengthScore(strengthScore.value);
  const normalizedStrengthState = normalizeDayMasterStrengthState(currentStrengthBand.label);
  const [dayMasterStrengthProfile, persona, solarTerms, loveMatrixRows, workMatrixRows] = await Promise.all([
    repository.findDayMasterStrengthProfile(dayMasterStem, normalizedStrengthState),
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

  const calculatedState = CalculatedStateSchema.parse({
    fourPillars: pillars,
    ageSnapshot,
    mingGong: mingGong.value,
    daYun: daYunState,
    liuNian,
    shenSha: buildShenShaState({
      pillars,
      dayMasterStem,
      mingGong: mingGong.value,
      liuNian,
      currentDaYun: currentDaYunPillar,
    }),
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
    },
    twelveQi: twelveQiState,
    elementMetaphors: buildElementMetaphors(dayMasterStem),
    elementAnalysis,
    dayMasterStrengthProfile: dayMasterStrengthProfile
      ? {
          dayMaster: dayMasterStrengthProfile.dayMaster,
          strengthState: dayMasterStrengthProfile.strengthState,
          narrative: dayMasterStrengthProfile.narrative,
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
    compatibilityMatrixProfiles,
  });

  return calculatedState;
}