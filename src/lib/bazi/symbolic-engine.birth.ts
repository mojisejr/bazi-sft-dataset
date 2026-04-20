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

  const boundaryAt = jieQiTable[zhongQiName]?.toYmdHms?.();
  const isPastZhongQi = Boolean(boundaryAt && birthAtHongKong >= boundaryAt);

  return {
    monthBranch,
    adjustedMonthBranch: isPastZhongQi ? getNextMonthBranch(monthBranch) : monthBranch,
    zhongQiName,
    boundaryAt: boundaryAt ?? null,
    isPastZhongQi,
  };
}

export function buildOrthodoxMingGongValue(
  birthContext: NormalizedBirthContext,
): ExplainableValue<PillarValue> {
  const lunar = birthContext.solar.getLunar() as LunarLike;
  const eightChar = lunar.getEightChar();
  const monthBranch = splitGanZhi(eightChar.getMonth()).branch;
  const timeBranch = splitGanZhi(eightChar.getTime()).branch;
  const monthAdjustment = getAdjustedMingGongMonthAdjustment(
    monthBranch,
    birthContext.birthAtHongKong,
    lunar.getJieQiTable(),
  );
  const monthZhiIndex = getMonthBranchIndex(monthAdjustment.adjustedMonthBranch);
  const timeZhiIndex = getMonthBranchIndex(timeBranch);
  let offset = monthZhiIndex + timeZhiIndex;

  offset = (offset >= 14 ? 26 : 14) - offset;

  let ganIndex = (lunar.getYearGanIndexExact() + 1) * 2 + offset;

  while (ganIndex > 10) {
    ganIndex -= 10;
  }

  const value = buildDerivedPillarValue(
    `${LunarUtil.GAN[ganIndex]}${LunarUtil.MONTH_ZHI[offset]}`,
  );

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
      offset,
      ganIndex,
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
      const isCurrent = entry.getLiuNian().some((liuNian) => liuNian.getYear() === currentYear);

      return {
        startAge: entry.getStartAge(),
        endAge: entry.getEndAge(),
        stem,
        branch,
        isCurrent,
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