import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type SolarTableValue = {
  toYmdHms(): string;
};

type SolarLike = {
  getLunar(): {
    getJieQiTable(): Record<string, SolarTableValue>;
  };
};

type SolarConstructor = {
  fromYmd(year: number, month: number, day: number): SolarLike;
};

const { Solar } = require("lunar-javascript") as {
  Solar: SolarConstructor;
};

export const SOLAR_TERM_ORDER = [
  "小寒",
  "大寒",
  "立春",
  "雨水",
  "惊蛰",
  "春分",
  "清明",
  "谷雨",
  "立夏",
  "小满",
  "芒种",
  "夏至",
  "小暑",
  "大暑",
  "立秋",
  "处暑",
  "白露",
  "秋分",
  "寒露",
  "霜降",
  "立冬",
  "小雪",
  "大雪",
  "冬至",
] as const;

export const SOLAR_TERM_ENGLISH_NAMES: Record<(typeof SOLAR_TERM_ORDER)[number], string> = {
  小寒: "Minor Cold",
  大寒: "Major Cold",
  立春: "Start of Spring",
  雨水: "Rain Water",
  惊蛰: "Awakening of Insects",
  春分: "Spring Equinox",
  清明: "Pure Brightness",
  谷雨: "Grain Rain",
  立夏: "Start of Summer",
  小满: "Grain Full",
  芒种: "Grain in Ear",
  夏至: "Summer Solstice",
  小暑: "Minor Heat",
  大暑: "Major Heat",
  立秋: "Start of Autumn",
  处暑: "Limit of Heat",
  白露: "White Dew",
  秋分: "Autumn Equinox",
  寒露: "Cold Dew",
  霜降: "Frost Descent",
  立冬: "Start of Winter",
  小雪: "Minor Snow",
  大雪: "Major Snow",
  冬至: "Winter Solstice",
};

export const SOLAR_TERM_SOURCE_PATH = "generated:lunar-javascript";
export const SOLAR_TERM_TIMEZONE = "Asia/Hong_Kong";
export const SOLAR_TERM_UTC_OFFSET_MINUTES = 8 * 60;
export const SOLAR_TERM_REFERENCE_URL =
  "https://www.hko.gov.hk/en/gts/astronomy/Solar_Term.htm";

type SolarTermName = (typeof SOLAR_TERM_ORDER)[number];

export type GeneratedSolarTermRow = {
  sourcePath: string;
  label: string;
  solarTermName: string;
  boundaryAt: string;
  notes: string;
  metadata: {
    sourceType: "generated";
    sourceLibrary: "lunar-javascript";
    gregorianYear: number;
    order: number;
    englishName: string;
    slug: string;
    timezone: string;
    utcOffsetMinutes: number;
    boundaryAtUtc: string;
    verificationReference: string;
  };
};

export type SolarTermSnapshot = {
  year: number;
  values: Partial<Record<SolarTermName, string>>;
};

type YearScopedSolarTerm = {
  name: SolarTermName;
  boundaryAtLocal: string;
};

function isSolarTermName(value: string): value is SolarTermName {
  return SOLAR_TERM_ORDER.includes(value as SolarTermName);
}

function isSolarTermEntry(entry: [string, SolarTableValue]): entry is [SolarTermName, SolarTableValue] {
  return isSolarTermName(entry[0]);
}

function toUtcIso(boundaryAtLocal: string) {
  return new Date(boundaryAtLocal.replace(" ", "T") + "+08:00").toISOString();
}

function slugifyEnglishName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function getAnchorYearEntries(anchorYear: number): YearScopedSolarTerm[] {
  const table = Solar.fromYmd(anchorYear, 1, 1).getLunar().getJieQiTable();

  return Object.entries(table)
    .filter(isSolarTermEntry)
    .map(([name, solar]) => ({
      name,
      boundaryAtLocal: solar.toYmdHms(),
    }));
}

export function buildGregorianYearSolarTerms(year: number): YearScopedSolarTerm[] {
  const deduped = [...getAnchorYearEntries(year), ...getAnchorYearEntries(year + 1)]
    .filter((entry) => entry.boundaryAtLocal.startsWith(`${year}-`))
    .filter(
      (entry, index, collection) =>
        collection.findIndex(
          (candidate) =>
            candidate.name === entry.name && candidate.boundaryAtLocal === entry.boundaryAtLocal,
        ) === index,
    )
    .sort((left, right) => left.boundaryAtLocal.localeCompare(right.boundaryAtLocal));

  if (deduped.length !== SOLAR_TERM_ORDER.length) {
    throw new Error(
      `Expected 24 solar terms for ${year}, received ${deduped.length}.`,
    );
  }

  const names = deduped.map((entry) => entry.name);
  const missing = SOLAR_TERM_ORDER.filter((name) => !names.includes(name));

  if (missing.length > 0) {
    throw new Error(`Solar terms missing for ${year}: ${missing.join(", ")}`);
  }

  return deduped;
}

export function buildSolarTermSnapshots(years: number[], names: SolarTermName[]): SolarTermSnapshot[] {
  return years.map((year) => {
    const terms = buildGregorianYearSolarTerms(year);

    return {
      year,
      values: Object.fromEntries(
        names.map((name) => [name, terms.find((entry) => entry.name === name)?.boundaryAtLocal]),
      ),
    };
  });
}

export function buildGeneratedSolarTermRows(startYear = 1900, endYear = 2100): GeneratedSolarTermRow[] {
  if (endYear < startYear) {
    throw new Error(`Invalid year range: ${startYear}..${endYear}`);
  }

  const rows: GeneratedSolarTermRow[] = [];

  for (let year = startYear; year <= endYear; year += 1) {
    const solarTerms = buildGregorianYearSolarTerms(year);

    for (const [index, entry] of solarTerms.entries()) {
      const englishName = SOLAR_TERM_ENGLISH_NAMES[entry.name];
      const slug = slugifyEnglishName(englishName);

      rows.push({
        sourcePath: SOLAR_TERM_SOURCE_PATH,
        label: `${year}-${String(index + 1).padStart(2, "0")}-${slug}`,
        solarTermName: entry.name,
        boundaryAt: entry.boundaryAtLocal,
        notes:
          "Generated with lunar-javascript and stored in Hong Kong Time (UTC+08:00) for deterministic Bazi boundary checks.",
        metadata: {
          sourceType: "generated",
          sourceLibrary: "lunar-javascript",
          gregorianYear: year,
          order: index + 1,
          englishName,
          slug,
          timezone: SOLAR_TERM_TIMEZONE,
          utcOffsetMinutes: SOLAR_TERM_UTC_OFFSET_MINUTES,
          boundaryAtUtc: toUtcIso(entry.boundaryAtLocal),
          verificationReference: SOLAR_TERM_REFERENCE_URL,
        },
      });
    }
  }

  return rows;
}