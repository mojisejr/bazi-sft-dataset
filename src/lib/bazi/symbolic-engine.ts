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

type EightCharLike = {
  getYear(): string;
  getMonth(): string;
  getDay(): string;
  getTime(): string;
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

const { Lunar, Solar } = require("lunar-javascript") as {
  Lunar: LunarConstructor;
  Solar: SolarConstructor;
};

export const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";
const DEFAULT_INPUT_TIMEZONE = "Asia/Bangkok";
const NEAR_BOUNDARY_WINDOW_HOURS = 24;

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

type SupportedElement = (typeof STEM_TO_ELEMENT)[keyof typeof STEM_TO_ELEMENT];

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
      hongKongParts.year,
      hongKongParts.month,
      hongKongParts.day,
      hongKongParts.hour,
      hongKongParts.minute,
      hongKongParts.second,
    ),
    birthAtHongKong: formatDateTimeParts(hongKongParts),
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

  const pillars = {
    year: buildPillarValue(eightChar.getYear(), eightChar.getYearHideGan()),
    month: buildPillarValue(eightChar.getMonth(), eightChar.getMonthHideGan()),
    day: buildPillarValue(eightChar.getDay(), eightChar.getDayHideGan()),
    hour: buildPillarValue(eightChar.getTime(), eightChar.getTimeHideGan()),
  };
  const dayMasterStem = pillars.day.stem;
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