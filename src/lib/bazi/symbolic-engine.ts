import { createRequire } from "node:module";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import {
  baziSixtyJiaziNarratives,
  baziTimeSolarTerms,
  baziTwelveQiStages,
} from "@/db/schema";
import {
  CalculatedStateSchema,
  type CalculatedStateValue,
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

const require = createRequire(import.meta.url);

type JieQiSolarLike = {
  toYmdHms(): string;
};

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

export type BaziKnowledgeRepository = {
  findSolarTermBoundaryContext(birthAtHongKong: string): Promise<SolarTermBoundaryContext>;
  findTwelveQiStage(dayMasterChinese: string, branchChinese: string): Promise<TwelveQiStageRecord | null>;
  findSixtyJiaziPersona(dayMasterChinese: string, branchChinese: string): Promise<SixtyJiaziPersonaRecord | null>;
};

type NormalizedBirthContext = {
  solar: SolarInstance;
  birthAtHongKong: string;
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

function getAdjustedMingGongMonthBranch(
  monthBranch: string,
  birthAtHongKong: string,
  jieQiTable: Record<string, JieQiSolarLike>,
) {
  const zhongQiName = MING_GONG_ZHONG_QI_BY_MONTH_BRANCH[
    monthBranch as keyof typeof MING_GONG_ZHONG_QI_BY_MONTH_BRANCH
  ];

  if (!zhongQiName) {
    return monthBranch;
  }

  const boundaryAt = jieQiTable[zhongQiName]?.toYmdHms?.();

  if (!boundaryAt || birthAtHongKong < boundaryAt) {
    return monthBranch;
  }

  return getNextMonthBranch(monthBranch);
}

function buildOrthodoxMingGongValue(birthContext: NormalizedBirthContext) {
  const lunar = birthContext.solar.getLunar() as LunarLike;
  const eightChar = lunar.getEightChar();
  const monthBranch = splitGanZhi(eightChar.getMonth()).branch;
  const timeBranch = splitGanZhi(eightChar.getTime()).branch;
  const adjustedMonthBranch = getAdjustedMingGongMonthBranch(
    monthBranch,
    birthContext.birthAtHongKong,
    lunar.getJieQiTable(),
  );
  const monthZhiIndex = getMonthBranchIndex(adjustedMonthBranch);
  const timeZhiIndex = getMonthBranchIndex(timeBranch);
  let offset = monthZhiIndex + timeZhiIndex;

  offset = (offset >= 14 ? 26 : 14) - offset;

  let ganIndex = (lunar.getYearGanIndexExact() + 1) * 2 + offset;

  while (ganIndex > 10) {
    ganIndex -= 10;
  }

  return buildDerivedPillarValue(
    `${LunarUtil.GAN[ganIndex]}${LunarUtil.MONTH_ZHI[offset]}`,
  );
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

function computeStrengthScore(dayMasterStem: string, pillars: CalculatedStateValue["fourPillars"], monthStage: string) {
  const dayMasterElement = getElement(dayMasterStem);
  let score = 1.5 + (STAGE_WEIGHTS[monthStage as keyof typeof STAGE_WEIGHTS] ?? 1);

  const visibleSupporters = [pillars.year.stem, pillars.month.stem, pillars.hour.stem];

  for (const stem of visibleSupporters) {
    score += relationWeight(dayMasterElement, getElement(stem));
  }

  const allHiddenStems = [
    ...(pillars.year.hiddenStems ?? []),
    ...(pillars.month.hiddenStems ?? []),
    ...(pillars.day.hiddenStems ?? []),
    ...(pillars.hour.hiddenStems ?? []),
  ];

  for (const stem of allHiddenStems) {
    score += relationWeight(dayMasterElement, getElement(stem), true);
  }

  return Number(score.toFixed(2));
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
) {
  const notes = [
    "60 Jiazi narrative supports interpretation but does not override clash-resolution logic.",
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
  const [yearStage, monthStage, dayStage, hourStage, persona, solarTerms] = await Promise.all([
    repository.findTwelveQiStage(dayMasterStem, pillars.year.branch),
    repository.findTwelveQiStage(dayMasterStem, pillars.month.branch),
    repository.findTwelveQiStage(dayMasterStem, pillars.day.branch),
    repository.findTwelveQiStage(dayMasterStem, pillars.hour.branch),
    repository.findSixtyJiaziPersona(dayMasterStem, pillars.day.branch),
    repository.findSolarTermBoundaryContext(birthContext.birthAtHongKong),
  ]);

  const calculatedState = CalculatedStateSchema.parse({
    fourPillars: pillars,
    mingGong,
    daYun: daYunState,
    liuNian,
    shenSha: buildShenShaState({
      pillars,
      dayMasterStem,
      mingGong,
      liuNian,
      currentDaYun: currentDaYunPillar,
    }),
    dayMaster: dayMasterStem,
    strengthScore: computeStrengthScore(
      dayMasterStem,
      pillars,
      monthStage?.stageNameChinese ?? eightChar.getMonthDiShi(),
    ),
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
    twelveQi: {
      yearBranch: yearStage?.stageNameChinese ?? eightChar.getYearDiShi(),
      monthBranch: monthStage?.stageNameChinese ?? eightChar.getMonthDiShi(),
      dayBranch: dayStage?.stageNameChinese ?? eightChar.getDayDiShi(),
      hourBranch: hourStage?.stageNameChinese ?? eightChar.getTimeDiShi(),
    },
    elementMetaphors: buildElementMetaphors(dayMasterStem),
    sixtyJiaziCorePersona: persona?.combinedNarrative
      ? {
          code: `${pillars.day.stem}${pillars.day.branch}`,
          narrative: persona.combinedNarrative,
          precedenceNotes: buildPrecedenceNotes(
            birthContext.birthAtHongKong,
            solarTerms,
            persona,
          ),
        }
      : undefined,
  });

  return calculatedState;
}