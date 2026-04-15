import { createRequire } from "node:module";

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
  type CalculatedStateValue,
  type CalculationTraceValue,
  type CompatibilityMatrixProfileValue,
  type ExplainableValue,
  type PillarValue,
  RawInputSchema,
  type RawInputValue,
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

const require = createRequire(import.meta.url);

type JieQiSolarLike = {
  toYmdHms(): string;
};

type MatrixDomain = "love" | "work";

type LunarLike = {
  getEightChar(): EightCharLike;
  getJieQiTable(): Record<string, JieQiSolarLike>;
  getYearGanIndexExact(): number;
};

type EightCharLike = {
  getYear(): string;
  getMonth(): string;
  getDay(): string;
  getTime(): string;
  getMingGong(): string;
  getYearHideGan(): string[] | string;
  getMonthHideGan(): string[] | string;
  getDayHideGan(): string[] | string;
  getTimeHideGan(): string[] | string;
  getYearShiShenGan(): string;
  getMonthShiShenGan(): string;
  getDayShiShenGan(): string;
  getTimeShiShenGan(): string;
  getYearShiShenZhi(): string[] | string;
  getMonthShiShenZhi(): string[] | string;
  getDayShiShenZhi(): string[] | string;
  getTimeShiShenZhi(): string[] | string;
  getYearDiShi(): string;
  getMonthDiShi(): string;
  getDayDiShi(): string;
  getTimeDiShi(): string;
  getYun(gender: number, sect?: number): YunLike;
};

type LiuNianLike = {
  getYear(): number;
  getAge(): number;
  getGanZhi(): string;
};

type DaYunLike = {
  getIndex(): number;
  getStartAge(): number;
  getEndAge(): number;
  getGanZhi(): string;
  getLiuNian(count?: number): LiuNianLike[];
};

type YunLike = {
  getStartYear(): number;
  getStartMonth(): number;
  getStartDay(): number;
  getDaYun(count?: number): DaYunLike[];
};

type SolarInstance = {
  getLunar(): {
    getEightChar(): EightCharLike;
  };
  getYear(): number;
  getMonth(): number;
  getDay(): number;
  getHour(): number;
  getMinute(): number;
};

type SolarConstructor = {
  fromYmdHms(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
  ): SolarInstance;
};

type LunarConstructor = {
  fromYmdHms(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
  ): {
    getSolar(): SolarInstance;
  };
};

const { Lunar, Solar, LunarUtil } = require("lunar-javascript") as {
  Lunar: LunarConstructor;
  Solar: SolarConstructor;
  LunarUtil: {
    GAN: string[];
    MONTH_ZHI: string[];
  };
};

export const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";
const DEFAULT_INPUT_TIMEZONE = "Asia/Bangkok";
const NEAR_BOUNDARY_WINDOW_HOURS = 24;

const MING_GONG_ZHONG_QI_BY_MONTH_BRANCH = {
  寅: "雨水",
  卯: "春分",
  辰: "谷雨",
  巳: "小满",
  午: "夏至",
  未: "大暑",
  申: "处暑",
  酉: "秋分",
  戌: "霜降",
  亥: "小雪",
  子: "冬至",
  丑: "大寒",
} as const;

const BRANCH_ORDER = [
  "子",
  "丑",
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
] as const;

const STEM_TO_ELEMENT = {
  甲: "wood",
  乙: "wood",
  丙: "fire",
  丁: "fire",
  戊: "earth",
  己: "earth",
  庚: "metal",
  辛: "metal",
  壬: "water",
  癸: "water",
} as const;

const GENERATES = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
} as const;

const CONTROLS = {
  wood: "earth",
  earth: "water",
  water: "fire",
  fire: "metal",
  metal: "wood",
} as const;

const STEM_METAPHORS = {
  甲: "a tall tree that grows straight when the environment is clear",
  乙: "a living vine that survives by adapting and finding support",
  丙: "the sun that projects warmth and direction outward",
  丁: "a candle flame that refines, warms, and reveals details",
  戊: "a mountain ridge that stabilizes pressure and holds structure",
  己: "fertile cultivated soil that nurtures, absorbs, and organizes",
  庚: "forged metal that cuts through chaos with discipline",
  辛: "polished metal that turns precision into beauty and judgment",
  壬: "a wide river that moves power through flow and scale",
  癸: "rainfall and mist that nourish quietly and penetrate deeply",
} as const;

const SUPPORT_ELEMENT_METAPHORS = {
  wood: "living timber and roots that keep growth moving upward",
  fire: "fire that bakes the soil into useful ground",
  earth: "earth that condenses pressure into ore and tools",
  metal: "metal that channels water into clean and directed flow",
  water: "water that feeds root systems and keeps growth flexible",
} as const;

const STAGE_WEIGHTS = {
  长生: 1.75,
  沐浴: 1.35,
  冠带: 1.5,
  临官: 1.65,
  帝旺: 1.85,
  衰: 0.95,
  病: 0.75,
  死: 0.55,
  墓: 0.7,
  绝: 0.35,
  胎: 0.9,
  养: 1.1,
} as const;

const BRANCH_HIDDEN_STEMS = {
  子: ["癸"],
  丑: ["己", "癸", "辛"],
  寅: ["甲", "丙", "戊"],
  卯: ["乙"],
  辰: ["戊", "乙", "癸"],
  巳: ["丙", "庚", "戊"],
  午: ["丁", "己"],
  未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"],
  酉: ["辛"],
  戌: ["戊", "辛", "丁"],
  亥: ["壬", "甲"],
} as const;

const NOBLEMAN_BRANCHES_BY_DAY_STEM = {
  甲: ["丑", "未"],
  戊: ["丑", "未"],
  乙: ["子", "申"],
  己: ["子", "申"],
  丙: ["亥", "酉"],
  丁: ["亥", "酉"],
  庚: ["午", "寅"],
  辛: ["午", "寅"],
  壬: ["卯", "巳"],
  癸: ["卯", "巳"],
} as const;

const WEN_CHANG_BRANCH_BY_DAY_STEM = {
  甲: "巳",
  乙: "午",
  丙: "申",
  丁: "酉",
  戊: "申",
  己: "酉",
  庚: "亥",
  辛: "子",
  壬: "寅",
  癸: "卯",
} as const;

const PEACH_BLOSSOM_BRANCH_BY_GROUP = {
  申: "酉",
  子: "酉",
  辰: "酉",
  寅: "卯",
  午: "卯",
  戌: "卯",
  巳: "午",
  酉: "午",
  丑: "午",
  亥: "子",
  卯: "子",
  未: "子",
} as const;

const TRAVELING_HORSE_BRANCH_BY_GROUP = {
  申: "寅",
  子: "寅",
  辰: "寅",
  寅: "申",
  午: "申",
  戌: "申",
  巳: "亥",
  酉: "亥",
  丑: "亥",
  亥: "巳",
  卯: "巳",
  未: "巳",
} as const;

const SIX_COMBINATION_PAIRS = new Set([
  "子|丑",
  "寅|亥",
  "卯|戌",
  "辰|酉",
  "巳|申",
  "午|未",
]);

const CLASH_PAIRS = new Set([
  "子|午",
  "丑|未",
  "寅|申",
  "卯|酉",
  "辰|戌",
  "巳|亥",
]);

const HARM_PAIRS = new Set([
  "子|未",
  "丑|午",
  "寅|巳",
  "卯|辰",
  "申|亥",
  "酉|戌",
]);

const DESTRUCTION_PAIRS = new Set([
  "子|酉",
  "卯|午",
  "辰|丑",
  "未|戌",
  "寅|亥",
]);

const PUNISHMENT_PAIR_KEYS = new Set(["子|卯"]);

const PUNISHMENT_TRIOS = [
  ["丑", "未", "戌"],
  ["寅", "巳", "申"],
] as const;

const SELF_PUNISHMENT_BRANCHES = new Set(["辰", "午", "酉", "亥"]);

const STAGE_POSITION_WEIGHTS = {
  year: 0.75,
  month: 1.75,
  day: 1,
  hour: 0.75,
} as const;

const STAGE_WEIGHT_NORMALIZER = 2.5;
const BASE_STRENGTH_OFFSET = 0.75;
const MONTH_SEASONAL_CLASH_FACTOR = 0.6;

type PillarKey = keyof CalculatedStateValue["fourPillars"];

type PairInteraction = {
  leftPillar: PillarKey;
  rightPillar: PillarKey;
  leftBranch: string;
  rightBranch: string;
  label: string;
};

type MultiBranchInteraction = {
  pillars: PillarKey[];
  branches: string[];
  label: string;
};

export type BranchInteractionResolution = {
  activeCombinations: string[];
  neutralizedClashes: string[];
  activeClashes: string[];
  activePunishments: string[];
  activeHarms: string[];
  activeDestructions: string[];
  monthBranchSeasonalFactor: number;
  precedenceNotes: string[];
};

const SHEN_SHA_COPY = {
  nobleman: {
    starName: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
    meaning: "ดาวอุปถัมภ์ ชี้จังหวะที่มีผู้ใหญ่ค้ำชู คนแนะนำ หรือแรงสนับสนุนเข้ามาช่วยเปิดทาง",
  },
  peachBlossom: {
    starName: "ดอกท้อ (桃花)",
    meaning: "ดาวเสน่ห์และแรงดึงดูด ชี้พลังด้านภาพลักษณ์ สังคม ความนิยม และความสัมพันธ์",
  },
  wenChang: {
    starName: "บุ่งเชียง/วิชาการ (文昌)",
    meaning: "ดาววิชาการ การคิดเชิงระบบ การเขียน การเรียนรู้ และงานที่ต้องใช้ปัญญาหรือชื่อเสียงทางความรู้",
  },
  travelingHorse: {
    starName: "ม้าเหิน (驿马)",
    meaning: "ดาวการเคลื่อนไหว การเดินทาง การโยกย้าย และโอกาสที่เกิดจากการเปลี่ยนจังหวะชีวิตหรือสถานที่",
  },
} as const;

type SupportedElement = (typeof STEM_TO_ELEMENT)[keyof typeof STEM_TO_ELEMENT];

type ReferencePillar = {
  label: string;
  pillar: Pick<PillarValue, "stem" | "branch">;
};

type StrengthStageSnapshot = {
  year: string;
  month: string;
  day: string;
  hour: string;
};

type StrengthContribution = {
  label: string;
  stem: string;
  hidden: boolean;
  weight: number;
};

type StrengthScoreBreakdown = {
  score: number;
  stageContribution: number;
  visibleContributions: StrengthContribution[];
  hiddenContributions: StrengthContribution[];
  penalties: {
    clashes: number;
    punishments: number;
    harms: number;
    destructions: number;
  };
};

export type SolarTermBoundaryRecord = {
  label: string;
  solarTermName: string | null;
  boundaryAt: string | null;
};

export type SolarTermBoundaryContext = {
  previous: SolarTermBoundaryRecord | null;
  next: SolarTermBoundaryRecord | null;
};

export type TwelveQiStageRecord = {
  stageNameChinese: string;
  stageNameThai: string;
  dayMaster: string;
  branch: string;
};

export type SixtyJiaziPersonaRecord = {
  dayMasterChinese: string;
  branchChinese: string;
  elementTone: string | null;
  twelveQiLabel: string | null;
  combinedNarrative: string | null;
};

export type DomainMatrixRecord = {
  domain: MatrixDomain;
  sourceVariant: string;
  pairKey: string | null;
  rowOrder: number;
  code: string | null;
  label: string | null;
  scoreText: string | null;
  narrative: string | null;
  rawCells: string[];
};

export type BaziKnowledgeRepository = {
  findSolarTermBoundaryContext(birthAtHongKong: string): Promise<SolarTermBoundaryContext>;
  findTwelveQiStage(dayMasterChinese: string, branchChinese: string): Promise<TwelveQiStageRecord | null>;
  findSixtyJiaziPersona(dayMasterChinese: string, branchChinese: string): Promise<SixtyJiaziPersonaRecord | null>;
  findDomainMatrixRows(domain: MatrixDomain): Promise<DomainMatrixRecord[]>;
};

type NormalizedBirthContext = {
  solar: SolarInstance;
  birthAtHongKong: string;
};

type MingGongMonthAdjustment = {
  monthBranch: string;
  adjustedMonthBranch: string;
  zhongQiName: string | null;
  boundaryAt: string | null;
  isPastZhongQi: boolean;
};

export type BaziStructuralState = Pick<CalculatedStateValue, "fourPillars" | "dayMaster">;

function splitGanZhi(value: string) {
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

function buildPillarValue(pillarText: string, hiddenStemValue: string[] | string): PillarValue {
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
) : MingGongMonthAdjustment {
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

function buildOrthodoxMingGongValue(
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

function normalizeGenderForYun(gender: string) {
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

function buildCurrentReferenceSolar(now = new Date()) {
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

function buildDaYunState(eightChar: EightCharLike, gender: string, currentYear: number) {
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

function buildLiuNianState(
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

function pushShenSha(
  collection: CalculatedStateValue["shenSha"],
  seen: Set<string>,
  starName: string,
  relatedPillar: string,
  meaning: string,
) {
  const key = `${starName}:${relatedPillar}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  collection.push({
    starName,
    relatedPillar,
    meaning,
  });
}

function findReferenceMatches(referencePillars: ReferencePillar[], targetBranch: string) {
  return referencePillars.filter((entry) => entry.pillar.branch === targetBranch);
}

function buildShenShaState(args: {
  pillars: CalculatedStateValue["fourPillars"];
  dayMasterStem: string;
  mingGong?: PillarValue;
  liuNian?: PillarValue;
  currentDaYun?: { stem: string; branch: string };
}) {
  const { pillars, dayMasterStem, mingGong, liuNian, currentDaYun } = args;
  const referencePillars: ReferencePillar[] = [
    { label: "ปี", pillar: pillars.year },
    { label: "เดือน", pillar: pillars.month },
    { label: "วัน", pillar: pillars.day },
    { label: "ยาม", pillar: pillars.hour },
    ...(mingGong ? [{ label: "ลัคนา", pillar: mingGong }] : []),
    ...(liuNian ? [{ label: "ปีจร", pillar: liuNian }] : []),
    ...(currentDaYun ? [{ label: `วัยจรปัจจุบัน (${currentDaYun.stem}${currentDaYun.branch})`, pillar: currentDaYun }] : []),
  ];
  const shenSha: CalculatedStateValue["shenSha"] = [];
  const seen = new Set<string>();

  const noblemanBranches = NOBLEMAN_BRANCHES_BY_DAY_STEM[
    dayMasterStem as keyof typeof NOBLEMAN_BRANCHES_BY_DAY_STEM
  ] ?? [];
  for (const branch of noblemanBranches) {
    for (const match of findReferenceMatches(referencePillars, branch)) {
      pushShenSha(
        shenSha,
        seen,
        SHEN_SHA_COPY.nobleman.starName,
        match.label,
        SHEN_SHA_COPY.nobleman.meaning,
      );
    }
  }

  const peachBlossomBranch = PEACH_BLOSSOM_BRANCH_BY_GROUP[
    pillars.day.branch as keyof typeof PEACH_BLOSSOM_BRANCH_BY_GROUP
  ];
  if (peachBlossomBranch) {
    for (const match of findReferenceMatches(referencePillars, peachBlossomBranch)) {
      pushShenSha(
        shenSha,
        seen,
        SHEN_SHA_COPY.peachBlossom.starName,
        match.label,
        SHEN_SHA_COPY.peachBlossom.meaning,
      );
    }
  }

  const wenChangBranch = WEN_CHANG_BRANCH_BY_DAY_STEM[
    dayMasterStem as keyof typeof WEN_CHANG_BRANCH_BY_DAY_STEM
  ];
  if (wenChangBranch) {
    for (const match of findReferenceMatches(referencePillars, wenChangBranch)) {
      pushShenSha(
        shenSha,
        seen,
        SHEN_SHA_COPY.wenChang.starName,
        match.label,
        SHEN_SHA_COPY.wenChang.meaning,
      );
    }
  }

  const travelingHorseBranch = TRAVELING_HORSE_BRANCH_BY_GROUP[
    pillars.day.branch as keyof typeof TRAVELING_HORSE_BRANCH_BY_GROUP
  ];
  if (travelingHorseBranch) {
    for (const match of findReferenceMatches(referencePillars, travelingHorseBranch)) {
      pushShenSha(
        shenSha,
        seen,
        SHEN_SHA_COPY.travelingHorse.starName,
        match.label,
        SHEN_SHA_COPY.travelingHorse.meaning,
      );
    }
  }

  return shenSha;
}

function getElement(stem: string): SupportedElement {
  const element = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];

  if (!element) {
    throw new Error(`Unsupported heavenly stem: ${stem}`);
  }

  return element;
}

function normalizeBranchPairKey(left: string, right: string) {
  const leftIndex = BRANCH_ORDER.indexOf(left as (typeof BRANCH_ORDER)[number]);
  const rightIndex = BRANCH_ORDER.indexOf(right as (typeof BRANCH_ORDER)[number]);

  if (leftIndex === -1 || rightIndex === -1) {
    return [left, right].sort().join("|");
  }

  return leftIndex <= rightIndex ? `${left}|${right}` : `${right}|${left}`;
}

function buildNormalizedBranchPairLabel(left: string, right: string) {
  return normalizeBranchPairKey(left, right).replace("|", "");
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeCorpusBranchSymbol(value: string) {
  return value.replaceAll("辰", "辰").trim();
}

function buildSixtyJiaziSemanticNotes(persona: SixtyJiaziPersonaRecord | null) {
  if (!persona) {
    return [];
  }

  const notes: string[] = [];

  if (persona.elementTone) {
    notes.push(`โทนธาตุของ 60 กะจื่อวันนี้คือ ${persona.elementTone}`);
  }

  if (persona.twelveQiLabel) {
    notes.push(
      `ชั้น 12 เชี่ยงแซของกะจื่อวันอยู่ที่ ${normalizeCorpusBranchSymbol(persona.twelveQiLabel)}`,
    );
  }

  return notes;
}

function buildMatrixStemColumnLookup(rows: DomainMatrixRecord[]) {
  const lookup = new Map<string, { codeIndex: number; branchIndex: number }>();
  const headerRow = rows.find((row) =>
    row.rawCells.some((cell) =>
      ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"].includes(cell.trim()),
    ),
  );

  if (!headerRow) {
    return lookup;
  }

  headerRow.rawCells.forEach((cell, index) => {
    const stem = cell.trim();

    if (
      !["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"].includes(stem) ||
      index < 1
    ) {
      return;
    }

    lookup.set(stem, {
      codeIndex: index - 1,
      branchIndex: index,
    });
  });

  return lookup;
}

export function buildCompatibilityMatrixProfiles(
  dayMasterStem: string,
  rows: DomainMatrixRecord[],
): CompatibilityMatrixProfileValue[] {
  const rowsByPairKey = new Map<string, DomainMatrixRecord[]>();

  for (const row of rows) {
    const pairKey = row.pairKey?.trim() || row.sourceVariant.trim();
    const existing = rowsByPairKey.get(pairKey);

    if (existing) {
      existing.push(row);
      continue;
    }

    rowsByPairKey.set(pairKey, [row]);
  }

  return Array.from(rowsByPairKey.entries()).flatMap(([pairKey, pairRows]) => {
    const stemColumns = buildMatrixStemColumnLookup(pairRows);
    const stemColumn = stemColumns.get(dayMasterStem);

    if (!stemColumn) {
      return [];
    }

    const entries = pairRows
      .filter((row) => row.scoreText || row.narrative)
      .map((row) => {
        const counterpartBranch = normalizeCorpusBranchSymbol(
          row.rawCells[stemColumn.branchIndex] ?? "",
        );

        if (!row.code || !row.label || !counterpartBranch) {
          return null;
        }

        const counterpartCode = row.rawCells[stemColumn.codeIndex]?.trim() || undefined;

        return {
          code: row.code,
          label: row.label,
          scoreText: row.scoreText ?? undefined,
          narrative: row.narrative ?? undefined,
          counterpartCode,
          counterpartBranch,
        };
      })
      .filter((entry) => entry !== null);

    if (entries.length === 0) {
      return [];
    }

    return [
      {
        domain: pairRows[0].domain,
        pairKey,
        entries,
      },
    ];
  });
}

function buildPairInteractions(
  pillars: CalculatedStateValue["fourPillars"],
  relationKeys: Set<string>,
) {
  const entries = Object.entries(pillars) as Array<[PillarKey, PillarValue]>;
  const interactions: PairInteraction[] = [];

  for (let leftIndex = 0; leftIndex < entries.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const [leftPillar, leftValue] = entries[leftIndex];
      const [rightPillar, rightValue] = entries[rightIndex];
      const pairKey = normalizeBranchPairKey(leftValue.branch, rightValue.branch);

      if (!relationKeys.has(pairKey)) {
        continue;
      }

      interactions.push({
        leftPillar,
        rightPillar,
        leftBranch: leftValue.branch,
        rightBranch: rightValue.branch,
        label: buildNormalizedBranchPairLabel(leftValue.branch, rightValue.branch),
      });
    }
  }

  return interactions;
}

function buildPunishmentInteractions(pillars: CalculatedStateValue["fourPillars"]) {
  const entries = Object.entries(pillars) as Array<[PillarKey, PillarValue]>;
  const interactions: MultiBranchInteraction[] = [];

  for (const interaction of buildPairInteractions(pillars, PUNISHMENT_PAIR_KEYS)) {
    interactions.push({
      pillars: [interaction.leftPillar, interaction.rightPillar],
      branches: [interaction.leftBranch, interaction.rightBranch],
      label: interaction.label,
    });
  }

  for (const trio of PUNISHMENT_TRIOS) {
    const matches = entries.filter(([, value]) =>
      trio.some((branch) => branch === value.branch),
    );

    if (matches.length === trio.length) {
      interactions.push({
        pillars: matches.map(([pillarKey]) => pillarKey),
        branches: [...trio],
        label: trio.join(""),
      });
    }
  }

  for (const branch of SELF_PUNISHMENT_BRANCHES) {
    const matches = entries.filter(([, value]) => value.branch === branch);

    if (matches.length >= 2) {
      interactions.push({
        pillars: matches.map(([pillarKey]) => pillarKey),
        branches: matches.map(([, value]) => value.branch),
        label: `${branch}${branch}`,
      });
    }
  }

  return interactions;
}

export function resolveBranchInteractionEffects(
  pillars: CalculatedStateValue["fourPillars"],
): BranchInteractionResolution {
  const combinations = buildPairInteractions(pillars, SIX_COMBINATION_PAIRS);
  const clashes = buildPairInteractions(pillars, CLASH_PAIRS);
  const harms = buildPairInteractions(pillars, HARM_PAIRS);
  const destructions = buildPairInteractions(pillars, DESTRUCTION_PAIRS);
  const punishments = buildPunishmentInteractions(pillars);
  const combinationPillars = new Set(
    combinations.flatMap((interaction) => [interaction.leftPillar, interaction.rightPillar]),
  );
  const neutralizedClashes = clashes.filter(
    (interaction) =>
      combinationPillars.has(interaction.leftPillar) ||
      combinationPillars.has(interaction.rightPillar),
  );
  const activeClashes = clashes.filter(
    (interaction) => !neutralizedClashes.includes(interaction),
  );
  const activeClashPillars = new Set(
    activeClashes.flatMap((interaction) => [interaction.leftPillar, interaction.rightPillar]),
  );
  const activePunishments = punishments.filter(
    (interaction) =>
      !interaction.pillars.some((pillarKey) => combinationPillars.has(pillarKey)) &&
      !interaction.pillars.some((pillarKey) => activeClashPillars.has(pillarKey)),
  );
  const majorConflictPillars = new Set([
    ...combinationPillars,
    ...activeClashPillars,
  ]);
  const monthBranchSeasonalFactor = activeClashes.some(
    (interaction) =>
      interaction.leftPillar === "month" || interaction.rightPillar === "month",
  )
    ? MONTH_SEASONAL_CLASH_FACTOR
    : 1;
  const precedenceNotes = uniqueStrings([
    ...combinations.map(
      (interaction) =>
        `Active combination ${interaction.label} takes precedence over clashes touching the same branches.`,
    ),
    ...neutralizedClashes.map(
      (interaction) =>
        `Clash ${interaction.label} is neutralized because one of its branches first enters a combination.`,
    ),
    ...activeClashes.map(
      (interaction) =>
        `Active clash ${interaction.label} remains in force and should outrank punishment-level interpretations.`,
    ),
    ...activePunishments.map(
      (interaction) =>
        `Punishment pattern ${interaction.label} remains active after higher-precedence interactions were resolved.`,
    ),
    ...harms.map((interaction) => {
      const supplementary =
        majorConflictPillars.has(interaction.leftPillar) ||
        majorConflictPillars.has(interaction.rightPillar);

      return supplementary
        ? `Harm ${interaction.label} is present but treated as a supplementary detail because a higher-precedence interaction exists.`
        : `Harm ${interaction.label} is active as a secondary relational signal.`;
    }),
    ...destructions.map((interaction) => {
      const supplementary =
        majorConflictPillars.has(interaction.leftPillar) ||
        majorConflictPillars.has(interaction.rightPillar);

      return supplementary
        ? `Destruction ${interaction.label} is present but remains a supplementary note under higher-precedence interactions.`
        : `Destruction ${interaction.label} is active as a secondary relational signal.`;
    }),
    ...(monthBranchSeasonalFactor < 1
      ? [
          `Month-branch clash reduces seasonal support weighting to ${monthBranchSeasonalFactor.toFixed(2)} until a higher-precedence combination resolves it.`,
        ]
      : []),
  ]);

  return {
    activeCombinations: uniqueStrings(combinations.map((interaction) => interaction.label)),
    neutralizedClashes: uniqueStrings(neutralizedClashes.map((interaction) => interaction.label)),
    activeClashes: uniqueStrings(activeClashes.map((interaction) => interaction.label)),
    activePunishments: uniqueStrings(activePunishments.map((interaction) => interaction.label)),
    activeHarms: uniqueStrings(harms.map((interaction) => interaction.label)),
    activeDestructions: uniqueStrings(destructions.map((interaction) => interaction.label)),
    monthBranchSeasonalFactor,
    precedenceNotes,
  };
}

function relationWeight(dayMasterElement: SupportedElement, candidateElement: SupportedElement, hidden = false) {
  const supportWeight = hidden ? 0.12 : 0.35;
  const resourceWeight = hidden ? 0.1 : 0.3;
  const outputWeight = hidden ? -0.06 : -0.15;
  const wealthWeight = hidden ? -0.08 : -0.2;
  const officerWeight = hidden ? -0.12 : -0.35;

  if (candidateElement === dayMasterElement) {
    return supportWeight;
  }

  if (GENERATES[candidateElement] === dayMasterElement) {
    return resourceWeight;
  }

  if (GENERATES[dayMasterElement] === candidateElement) {
    return outputWeight;
  }

  if (CONTROLS[dayMasterElement] === candidateElement) {
    return wealthWeight;
  }

  if (CONTROLS[candidateElement] === dayMasterElement) {
    return officerWeight;
  }

  return 0;
}

function computeStrengthScoreBreakdown(
  dayMasterStem: string,
  pillars: CalculatedStateValue["fourPillars"],
  stages: StrengthStageSnapshot,
  interactionResolution: BranchInteractionResolution,
): StrengthScoreBreakdown {
  const dayMasterElement = getElement(dayMasterStem);
  const stageContribution =
    (getStageStrengthWeight(stages.year) * STAGE_POSITION_WEIGHTS.year +
      getStageStrengthWeight(stages.month) *
        STAGE_POSITION_WEIGHTS.month *
        interactionResolution.monthBranchSeasonalFactor +
      getStageStrengthWeight(stages.day) * STAGE_POSITION_WEIGHTS.day +
      getStageStrengthWeight(stages.hour) * STAGE_POSITION_WEIGHTS.hour) /
    STAGE_WEIGHT_NORMALIZER;
  let score = BASE_STRENGTH_OFFSET + stageContribution;

  const visibleContributions: StrengthContribution[] = [
    {
      label: "yearStem",
      stem: pillars.year.stem,
      hidden: false,
      weight: relationWeight(dayMasterElement, getElement(pillars.year.stem)),
    },
    {
      label: "monthStem",
      stem: pillars.month.stem,
      hidden: false,
      weight: relationWeight(dayMasterElement, getElement(pillars.month.stem)),
    },
    {
      label: "hourStem",
      stem: pillars.hour.stem,
      hidden: false,
      weight: relationWeight(dayMasterElement, getElement(pillars.hour.stem)),
    },
  ];

  for (const contribution of visibleContributions) {
    score += contribution.weight;
  }

  const hiddenContributions: StrengthContribution[] = [
    ...((pillars.year.hiddenStems ?? []).map((stem, index) => ({
      label: `yearHiddenStem${index + 1}`,
      stem,
      hidden: true,
      weight: relationWeight(dayMasterElement, getElement(stem), true),
    }))),
    ...((pillars.month.hiddenStems ?? []).map((stem, index) => ({
      label: `monthHiddenStem${index + 1}`,
      stem,
      hidden: true,
      weight: relationWeight(dayMasterElement, getElement(stem), true),
    }))),
    ...((pillars.day.hiddenStems ?? []).map((stem, index) => ({
      label: `dayHiddenStem${index + 1}`,
      stem,
      hidden: true,
      weight: relationWeight(dayMasterElement, getElement(stem), true),
    }))),
    ...((pillars.hour.hiddenStems ?? []).map((stem, index) => ({
      label: `hourHiddenStem${index + 1}`,
      stem,
      hidden: true,
      weight: relationWeight(dayMasterElement, getElement(stem), true),
    }))),
  ];

  for (const contribution of hiddenContributions) {
    score += contribution.weight;
  }

  const penalties = {
    clashes: interactionResolution.activeClashes.length * 0.18,
    punishments: interactionResolution.activePunishments.length * 0.08,
    harms:
      interactionResolution.activeCombinations.length === 0 &&
      interactionResolution.activeClashes.length === 0
        ? interactionResolution.activeHarms.length * 0.05
        : 0,
    destructions:
      interactionResolution.activeCombinations.length === 0 &&
      interactionResolution.activeClashes.length === 0
        ? interactionResolution.activeDestructions.length * 0.05
        : 0,
  };

  score -= penalties.clashes;
  score -= penalties.punishments;
  score -= penalties.harms;
  score -= penalties.destructions;

  return {
    score: Number(score.toFixed(2)),
    stageContribution,
    visibleContributions,
    hiddenContributions,
    penalties,
  };
}

function getStageStrengthWeight(stageName: string) {
  return STAGE_WEIGHTS[stageName as keyof typeof STAGE_WEIGHTS] ?? 1;
}

function buildStrengthScoreExplainable(
  dayMasterStem: string,
  pillars: CalculatedStateValue["fourPillars"],
  stages: StrengthStageSnapshot,
  interactionResolution: BranchInteractionResolution,
): ExplainableValue<number> {
  const breakdown = computeStrengthScoreBreakdown(
    dayMasterStem,
    pillars,
    stages,
    interactionResolution,
  );

  return {
    value: breakdown.score,
    trace: {
      engine: "orthodox-override",
      ruleName: TRACE_RULE_NAMES.strengthScore,
      steps: [],
      stepKeys: [
        TRACE_STEP_KEYS.strengthScore.weightStages,
        TRACE_STEP_KEYS.strengthScore.addRelations,
        TRACE_STEP_KEYS.strengthScore.applyPenalties,
      ],
      rawVariables: {
        dayMasterStem,
        stages,
        stageContribution: Number(breakdown.stageContribution.toFixed(4)),
        monthBranchSeasonalFactor: interactionResolution.monthBranchSeasonalFactor,
        activeCombinations: interactionResolution.activeCombinations,
        activeClashes: interactionResolution.activeClashes,
        activePunishments: interactionResolution.activePunishments,
        activeHarms: interactionResolution.activeHarms,
        activeDestructions: interactionResolution.activeDestructions,
        visibleContributions: breakdown.visibleContributions,
        hiddenContributions: breakdown.hiddenContributions,
        penalties: breakdown.penalties,
        result: breakdown.score,
      },
    },
  };
}

function buildElementMetaphors(dayMasterStem: string) {
  const dayMasterElement = getElement(dayMasterStem);
  const resourceElement = Object.entries(GENERATES).find(([, produced]) => produced === dayMasterElement)?.[0];

  return [
    {
      element: dayMasterElement,
      metaphor: STEM_METAPHORS[dayMasterStem as keyof typeof STEM_METAPHORS],
    },
    ...(resourceElement
      ? [
          {
            element: resourceElement,
            metaphor:
              SUPPORT_ELEMENT_METAPHORS[
                resourceElement as keyof typeof SUPPORT_ELEMENT_METAPHORS
              ],
          },
        ]
      : []),
  ];
}

function hoursBetween(left: string, right: string) {
  const leftDate = new Date(left.replace(" ", "T") + "+08:00");
  const rightDate = new Date(right.replace(" ", "T") + "+08:00");

  return Math.abs(leftDate.getTime() - rightDate.getTime()) / (1000 * 60 * 60);
}

function buildPrecedenceNotes(
  birthAtHongKong: string,
  solarTerms: SolarTermBoundaryContext,
  persona: SixtyJiaziPersonaRecord | null,
  interactionResolution: BranchInteractionResolution,
) {
  const notes = [
    "60 Jiazi narrative supports interpretation but does not override clash-resolution logic.",
    ...interactionResolution.precedenceNotes,
  ];

  if (persona?.twelveQiLabel) {
    notes.push(`Canonical persona source labels this chart with twelve-qi tone ${persona.twelveQiLabel}.`);
  }

  const candidates = [solarTerms.previous, solarTerms.next]
    .filter((entry): entry is SolarTermBoundaryRecord => Boolean(entry?.boundaryAt))
    .map((entry) => ({ entry, hours: hoursBetween(birthAtHongKong, entry.boundaryAt ?? birthAtHongKong) }))
    .filter(({ hours }) => hours <= NEAR_BOUNDARY_WINDOW_HOURS)
    .sort((left, right) => left.hours - right.hours);

  const nearest = candidates[0];

  if (nearest?.entry.boundaryAt) {
    notes.push(
      `Birth occurs ${nearest.hours.toFixed(2)} hours from solar-term boundary ${nearest.entry.solarTermName ?? nearest.entry.label} (${nearest.entry.boundaryAt} HKT); review edge-case interpretations manually when needed.`,
    );
  }

  return notes;
}

function normalizeBirthContext(rawInput: RawInputValue): NormalizedBirthContext {
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

  const calculatedState = CalculatedStateSchema.parse({
    fourPillars: pillars,
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
          precedenceNotes: buildPrecedenceNotes(
            birthContext.birthAtHongKong,
            solarTerms,
            persona,
            interactionResolution,
          ),
        }
      : undefined,
    compatibilityMatrixProfiles,
  });

  return calculatedState;
}