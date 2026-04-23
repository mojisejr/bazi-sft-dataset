import { createRequire } from "node:module";

import type {
  CalculationTraceValue,
  ExplainableValue,
  PillarValue,
  RawInputValue,
} from "@/lib/bazi/schema-types";
import {
  formatDateTimeParts,
  getDateTimePartsInTimeZone,
  parseDateTimeParts,
  zonedDateTimeToUtc,
} from "@/lib/bazi/timezone";
import {
  TRACE_RULE_NAMES,
  TRACE_STEP_KEYS,
} from "@/lib/bazi/trace-keys";

import {
  BRANCH_HIDDEN_STEMS,
  DEFAULT_INPUT_TIMEZONE,
  HONG_KONG_TIMEZONE,
  MING_GONG_ZHONG_QI_BY_MONTH_BRANCH,
} from "@/lib/bazi/symbolic-engine.constants";
import {
  OPERATOR_LAGNA_BRANCH_NUMBERS,
  lookupOperatorLagnaPillar,
  resolveOperatorLagnaTermBase,
} from "@/lib/bazi/constants";
import type {
  DaYunLike,
  EightCharLike,
  JieQiSolarLike,
  LunarConstructor,
  MingGongMonthAdjustment,
  NormalizedBirthContext,
  SolarConstructor,
} from "@/lib/bazi/symbolic-engine.types";

const require = createRequire(import.meta.url);

const { Lunar, Solar, LunarUtil } = require("lunar-javascript") as {
  Lunar: LunarConstructor;
  Solar: SolarConstructor;
  LunarUtil: {
    GAN: string[];
    MONTH_ZHI: string[];
  };
};

type LunarLike = {
  getEightChar(): EightCharLike;
  getJieQiTable(): Record<string, JieQiSolarLike>;
  getYearGanIndexExact(): number;
};

export function splitGanZhi(value: string) {
  const [stem = "", branch = ""] = Array.from(value);

  if (!stem || !branch) {
    throw new Error(`Invalid GanZhi value: ${value}`);
  }

  return { stem, branch };
}

function normalizeHiddenStems(value: string[] | string) {
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function buildPillarValue(
  pillarText: string,
  hiddenStemValue: string[] | string,
): PillarValue {
  const { stem, branch } = splitGanZhi(pillarText);

  return {
    stem,
    branch,
    hiddenStems: normalizeHiddenStems(hiddenStemValue),
  };
}

function buildDerivedPillarValue(pillarText: string): PillarValue {
  const { stem, branch } = splitGanZhi(pillarText);

  return {
    stem,
    branch,
    hiddenStems: [...(BRANCH_HIDDEN_STEMS[branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? [])],
  };
}

function getMonthBranchIndex(branch: string) {
  const index = LunarUtil.MONTH_ZHI.indexOf(branch);

  if (index < 1) {
    throw new Error(`Unsupported month-branch index for Ming Gong: ${branch}`);
  }

  return index;
}

function getNextMonthBranch(branch: string) {
  const currentIndex = getMonthBranchIndex(branch);
  const nextIndex = currentIndex === 12 ? 1 : currentIndex + 1;

  return LunarUtil.MONTH_ZHI[nextIndex] ?? branch;
}

function getOperatorLagnaBranchNumber(branch: string) {
  const branchNumber = OPERATOR_LAGNA_BRANCH_NUMBERS[
    branch as keyof typeof OPERATOR_LAGNA_BRANCH_NUMBERS
  ];

  if (!branchNumber) {
    throw new Error(`Unsupported operator lagna branch number: ${branch}`);
  }

  return branchNumber;
}

function getOperatorLagnaBranchByNumber(branchNumber: number) {
  const normalizedBranchNumber = ((branchNumber - 1 + 12) % 12) + 1;
  const match = Object.entries(OPERATOR_LAGNA_BRANCH_NUMBERS).find(
    ([, value]) => value === normalizedBranchNumber,
  );

  if (!match) {
    throw new Error(`Unsupported operator lagna result number: ${branchNumber}`);
  }

  return match[0];
}

function getAdjustedMingGongMonthAdjustment(
  monthBranch: string,
  birthAtHongKong: string,
  jieQiTable: Record<string, JieQiSolarLike>,
): MingGongMonthAdjustment {
  const zhongQiName = MING_GONG_ZHONG_QI_BY_MONTH_BRANCH[
    monthBranch as keyof typeof MING_GONG_ZHONG_QI_BY_MONTH_BRANCH
  ];

  if (!zhongQiName) {
    return {
      monthBranch,
      adjustedMonthBranch: monthBranch,
      zhongQiName: null,
      boundaryAt: null,
      isPastZhongQi: false,
    };
  }

  const rawBoundaryAt = jieQiTable[zhongQiName]?.toYmdHms?.();
  const boundaryAt = rawBoundaryAt
    ? resolveNearestSolarTermBoundary(rawBoundaryAt, birthAtHongKong)
    : null;
  const isPastZhongQi = Boolean(boundaryAt && birthAtHongKong >= boundaryAt);

  return {
    monthBranch,
    adjustedMonthBranch: isPastZhongQi ? getNextMonthBranch(monthBranch) : monthBranch,
    zhongQiName,
    boundaryAt: boundaryAt ?? null,
    isPastZhongQi,
  };
}

function resolveNearestSolarTermBoundary(boundaryAt: string, birthAtHongKong: string) {
  const [birthDate, birthTime] = birthAtHongKong.split(" ");
  const [boundaryDate, boundaryTime] = boundaryAt.split(" ");

  if (!birthDate || !birthTime || !boundaryDate || !boundaryTime) {
    return boundaryAt;
  }

  const birthParts = parseDateTimeParts(birthDate, birthTime);
  const boundaryParts = parseDateTimeParts(boundaryDate, boundaryTime);
  const candidateYears = [birthParts.year - 1, birthParts.year, birthParts.year + 1];

  const candidates = candidateYears.map((year) => {
    const candidate = formatDateTimeParts({
      year,
      month: boundaryParts.month,
      day: boundaryParts.day,
      hour: boundaryParts.hour,
      minute: boundaryParts.minute,
      second: boundaryParts.second,
    });

    return {
      candidate,
      distance: Math.abs(
        zonedDateTimeToUtc(
          parseDateTimeParts(...candidate.split(" ") as [string, string]),
          HONG_KONG_TIMEZONE,
        ).getTime() - zonedDateTimeToUtc(birthParts, HONG_KONG_TIMEZONE).getTime(),
      ),
    };
  });

  return candidates.sort((left, right) => left.distance - right.distance)[0]?.candidate ?? boundaryAt;
}

export function buildOrthodoxMingGongValue(
  birthContext: NormalizedBirthContext,
): ExplainableValue<PillarValue> {
  const lunar = birthContext.solar.getLunar() as LunarLike;
  const eightChar = lunar.getEightChar();
  const yearStem = splitGanZhi(eightChar.getYear()).stem;
  const monthBranch = splitGanZhi(eightChar.getMonth()).branch;
  const timeBranch = splitGanZhi(eightChar.getTime()).branch;
  const monthAdjustment = getAdjustedMingGongMonthAdjustment(
    monthBranch,
    birthContext.birthAtHongKong,
    lunar.getJieQiTable(),
  );
  const monthZhiIndex = getOperatorLagnaBranchNumber(monthBranch);
  const timeZhiIndex = getOperatorLagnaBranchNumber(timeBranch);
  const total = monthZhiIndex + timeZhiIndex;
  const termBase = resolveOperatorLagnaTermBase(total);

  if (!termBase) {
    throw new Error(`Unsupported operator lagna branch total: ${total}`);
  }

  let offset = termBase - total;

  if (monthAdjustment.isPastZhongQi) {
    offset -= 1;
  }

  const lagnaBranch = getOperatorLagnaBranchByNumber(offset);
  const resultPillar = lookupOperatorLagnaPillar(yearStem, lagnaBranch);
  const value = buildDerivedPillarValue(resultPillar);

  const trace: CalculationTraceValue = {
    engine: "orthodox-override",
    ruleName: TRACE_RULE_NAMES.mingGong,
    steps: [],
    stepKeys: [
      TRACE_STEP_KEYS.mingGong.readBranches,
      TRACE_STEP_KEYS.mingGong.resolveBoundary,
      TRACE_STEP_KEYS.mingGong.finalize,
    ],
    rawVariables: {
      birthAtHongKong: birthContext.birthAtHongKong,
      monthBranch: monthAdjustment.monthBranch,
      adjustedMonthBranch: monthAdjustment.adjustedMonthBranch,
      timeBranch,
      zhongQiName: monthAdjustment.zhongQiName,
      boundaryAt: monthAdjustment.boundaryAt,
      isPastZhongQi: monthAdjustment.isPastZhongQi,
      monthZhiIndex,
      timeZhiIndex,
      total,
      termBase,
      offset,
      yearStem,
      lagnaBranch,
      result: `${value.stem}${value.branch}`,
    },
  };

  return {
    value,
    trace,
  };
}

export function normalizeGenderForYun(gender: string) {
  const normalized = gender.trim().toLowerCase();

  if (
    normalized.startsWith("f") ||
    normalized.includes("woman") ||
    normalized.includes("female") ||
    normalized.includes("หญิง")
  ) {
    return 0;
  }

  return 1;
}

function getCurrentHongKongDateTimeParts(now = new Date()) {
  return getDateTimePartsInTimeZone(now, HONG_KONG_TIMEZONE);
}

export function buildCurrentReferenceSolar(now = new Date()) {
  const parts = getCurrentHongKongDateTimeParts(now);

  return Solar.fromYmdHms(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

export function buildDaYunState(
  eightChar: EightCharLike,
  gender: string,
  currentYear: number,
) {
  return eightChar
    .getYun(normalizeGenderForYun(gender))
    .getDaYun()
    .filter((entry) => entry.getGanZhi().trim().length > 0)
    .map((entry) => {
      const { stem, branch } = splitGanZhi(entry.getGanZhi());
      const currentLiuNian = entry
        .getLiuNian()
        .find((liuNian) => liuNian.getYear() === currentYear);
      const isCurrent = Boolean(currentLiuNian);
      const startAge = entry.getStartAge();
      const endAge = entry.getEndAge();
      const upperPhaseEndAge = Math.min(startAge + 4, endAge);
      const lowerPhaseStartAge = Math.min(upperPhaseEndAge + 1, endAge);
      const currentPhase = currentLiuNian?.getAge() !== undefined
        ? currentLiuNian.getAge() <= upperPhaseEndAge
          ? "upper"
          : "lower"
        : undefined;

      return {
        startAge,
        endAge,
        stem,
        branch,
        isCurrent,
        currentPhase,
        upperPhase: {
          startAge,
          endAge: upperPhaseEndAge,
          symbol: stem,
          source: "stem" as const,
          isCurrent: currentPhase === "upper",
        },
        lowerPhase: {
          startAge: lowerPhaseStartAge,
          endAge,
          symbol: branch,
          source: "branch" as const,
          isCurrent: currentPhase === "lower",
        },
      };
    });
}

export function buildLiuNianState(
  currentDaYun: DaYunLike | undefined,
  currentYear: number,
  currentReferenceEightChar: EightCharLike,
) {
  const currentLiuNian = currentDaYun
    ?.getLiuNian()
    .find((entry) => entry.getYear() === currentYear);

  if (currentLiuNian?.getGanZhi()) {
    return buildPillarValue(
      currentLiuNian.getGanZhi(),
      currentReferenceEightChar.getYearHideGan(),
    );
  }

  return buildPillarValue(
    currentReferenceEightChar.getYear(),
    currentReferenceEightChar.getYearHideGan(),
  );
}

export function normalizeBirthContext(rawInput: RawInputValue): NormalizedBirthContext {
  const localParts = parseDateTimeParts(rawInput.birthDate, rawInput.birthTime);
  const inputTimeZone = rawInput.timezone?.trim() || DEFAULT_INPUT_TIMEZONE;

  const solarLike = rawInput.calendarSystem === "lunar"
    ? Lunar.fromYmdHms(
        localParts.year,
        localParts.month,
        localParts.day,
        localParts.hour,
        localParts.minute,
        localParts.second,
      ).getSolar()
    : Solar.fromYmdHms(
        localParts.year,
        localParts.month,
        localParts.day,
        localParts.hour,
        localParts.minute,
        localParts.second,
      );

  const baseParts = {
    year: solarLike.getYear(),
    month: solarLike.getMonth(),
    day: solarLike.getDay(),
    hour: solarLike.getHour(),
    minute: solarLike.getMinute(),
    second: 0,
  };
  const birthAtUtc = zonedDateTimeToUtc(baseParts, inputTimeZone);
  const hongKongParts = getDateTimePartsInTimeZone(birthAtUtc, HONG_KONG_TIMEZONE);

  return {
    solar: Solar.fromYmdHms(
      baseParts.year,
      baseParts.month,
      baseParts.day,
      baseParts.hour,
      baseParts.minute,
      baseParts.second,
    ),
    birthAtHongKong: formatDateTimeParts(hongKongParts),
  };
}