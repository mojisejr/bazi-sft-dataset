import { and, asc, desc, eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import {
  baziDomainMatrices,
  baziSixtyJiaziNarratives,
  baziTimeSolarTerms,
  baziTwelveQiStages,
} from "@/db/schema";
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
  buildSeasonalInteraction,
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

    async findTwelveQiStage(dayMasterChinese, branchChinese) {
      const [stage] = await db
        .select({
          stageNameChinese: baziTwelveQiStages.stageNameChinese,
          stageNameThai: baziTwelveQiStages.stageNameThai,
          dayMaster: baziTwelveQiStages.dayMaster,
          branch: baziTwelveQiStages.branch,
        })
        .from(baziTwelveQiStages)
        .where(
          and(
            eq(baziTwelveQiStages.dayMaster, dayMasterChinese),
            eq(baziTwelveQiStages.branch, branchChinese),
          ),
        )
        .limit(1);

      return stage ?? null;
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
  const daYunState = buildDaYunState(eightChar, rawInput.gender, currentYear);
  const currentDaYunEntry = eightChar
    .getYun(normalizeGenderForYun(rawInput.gender))
    .getDaYun()
    .find((entry) => entry.getGanZhi().trim().length > 0 && entry.getLiuNian().some((liuNian) => liuNian.getYear() === currentYear));
  const liuNian = buildLiuNianState(currentDaYunEntry, currentYear, currentReferenceEightChar);
  const currentDaYunPillar = daYunState.find((entry) => entry.isCurrent);
  const [yearStage, monthStage, dayStage, hourStage, persona, solarTerms, loveMatrixRows, workMatrixRows] = await Promise.all([
    repository.findTwelveQiStage(dayMasterStem, pillars.year.branch),
    repository.findTwelveQiStage(dayMasterStem, pillars.month.branch),
    repository.findTwelveQiStage(dayMasterStem, pillars.day.branch),
    repository.findTwelveQiStage(dayMasterStem, pillars.hour.branch),
    repository.findSixtyJiaziPersona(dayMasterStem, pillars.day.branch),
    repository.findSolarTermBoundaryContext(birthContext.birthAtHongKong),
    repository.findDomainMatrixRows("love"),
    repository.findDomainMatrixRows("work"),
  ]);
  const twelveQiState = {
    yearBranch: yearStage?.stageNameChinese ?? eightChar.getYearDiShi(),
    monthBranch: monthStage?.stageNameChinese ?? eightChar.getMonthDiShi(),
    dayBranch: dayStage?.stageNameChinese ?? eightChar.getDayDiShi(),
    hourBranch: hourStage?.stageNameChinese ?? eightChar.getTimeDiShi(),
  };
  const interactionResolution = resolveBranchInteractionEffects(pillars);
  const elementAnalysis = buildElementAnalysis(pillars);
  const seasonalInteraction = buildSeasonalInteraction(dayMasterStem, pillars.month.branch);
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
    seasonalInteraction,
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