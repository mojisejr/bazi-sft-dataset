import { parse } from "csv-parse/sync";

import { RawInputSchema, type RawInputValue } from "@/lib/bazi/schema-types";

const DEFAULT_PROVINCE = "Bangkok";
const DEFAULT_TIMEZONE = "Asia/Bangkok";

const CSV_HEADERS = {
  name: "ชื่อ",
  birthDay: "วันที่เกิด",
  birthMonth: "เดือนเกิด",
  birthYearBe: "ปีเกิด",
  birthTime: "เวลาที่เกิด",
  gender: "เพศ",
} as const;

const THAI_MONTH_TO_NUMBER = new Map([
  ["มกราคม", 1],
  ["กุมภาพันธ์", 2],
  ["มีนาคม", 3],
  ["เมษายน", 4],
  ["พฤษภาคม", 5],
  ["มิถุนายน", 6],
  ["กรกฎาคม", 7],
  ["สิงหาคม", 8],
  ["กันยายน", 9],
  ["ตุลาคม", 10],
  ["พฤศจิกายน", 11],
  ["ธันวาคม", 12],
]);

const GENDER_TO_CANONICAL = new Map([
  ["ชาย", "male"],
  ["หญิง", "female"],
  ["male", "male"],
  ["female", "female"],
  ["m", "male"],
  ["f", "female"],
]);

type CsvCaseLoaderOptions = {
  province?: string;
  timezone?: string;
};

export type ImportedBaziCase = {
  sourceRow: number;
  name: string;
  rawInput: RawInputValue;
};

function getRequiredField(record: Record<string, unknown>, header: string, rowNumber: number) {
  const rawValue = record[header];

  if (typeof rawValue !== "string") {
    throw new Error(`CSV row ${rowNumber} is missing the required column \"${header}\".`);
  }

  const value = rawValue.trim();

  if (value.length === 0) {
    throw new Error(`CSV row ${rowNumber} has an empty value for \"${header}\".`);
  }

  return value;
}

function parsePositiveInteger(value: string, fieldName: string, rowNumber: number) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`CSV row ${rowNumber} has an invalid ${fieldName}: \"${value}\".`);
  }

  return Number.parseInt(value, 10);
}

export function normalizeThaiMonth(monthLabel: string, rowNumber = 0) {
  const month = THAI_MONTH_TO_NUMBER.get(monthLabel.trim());

  if (!month) {
    const rowContext = rowNumber > 0 ? `CSV row ${rowNumber}` : "CSV input";
    throw new Error(`${rowContext} has an unknown Thai month label: \"${monthLabel}\".`);
  }

  return month;
}

export function normalizeBuddhistEraYear(yearBe: string, rowNumber = 0) {
  const parsedYear = parsePositiveInteger(yearBe.trim(), "Buddhist Era year", rowNumber || 1);
  const gregorianYear = parsedYear - 543;

  if (gregorianYear < 1) {
    const rowContext = rowNumber > 0 ? `CSV row ${rowNumber}` : "CSV input";
    throw new Error(`${rowContext} produced an invalid Gregorian year from \"${yearBe}\".`);
  }

  return gregorianYear;
}

export function normalizeCsvGender(genderLabel: string, rowNumber = 0) {
  const canonicalGender = GENDER_TO_CANONICAL.get(genderLabel.trim().toLowerCase());

  if (!canonicalGender) {
    const rowContext = rowNumber > 0 ? `CSV row ${rowNumber}` : "CSV input";
    throw new Error(`${rowContext} has an unsupported gender label: \"${genderLabel}\".`);
  }

  return canonicalGender;
}

export function normalizeBirthTime(birthTime: string, rowNumber = 0) {
  const match = birthTime.trim().match(/^(\d{1,2})[:.](\d{1,2})$/);

  if (!match) {
    const rowContext = rowNumber > 0 ? `CSV row ${rowNumber}` : "CSV input";
    throw new Error(`${rowContext} has an invalid birth time: \"${birthTime}\".`);
  }

  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    const rowContext = rowNumber > 0 ? `CSV row ${rowNumber}` : "CSV input";
    throw new Error(`${rowContext} has an out-of-range birth time: \"${birthTime}\".`);
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function buildImportedCase(
  record: Record<string, unknown>,
  rowNumber: number,
  options: Required<CsvCaseLoaderOptions>,
): ImportedBaziCase {
  const name = getRequiredField(record, CSV_HEADERS.name, rowNumber);
  const dayText = getRequiredField(record, CSV_HEADERS.birthDay, rowNumber);
  const monthLabel = getRequiredField(record, CSV_HEADERS.birthMonth, rowNumber);
  const yearBe = getRequiredField(record, CSV_HEADERS.birthYearBe, rowNumber);
  const birthTime = getRequiredField(record, CSV_HEADERS.birthTime, rowNumber);
  const genderLabel = getRequiredField(record, CSV_HEADERS.gender, rowNumber);

  const day = parsePositiveInteger(dayText, "birth day", rowNumber);
  const month = normalizeThaiMonth(monthLabel, rowNumber);
  const year = normalizeBuddhistEraYear(yearBe, rowNumber);
  const maxDay = getDaysInMonth(year, month);

  if (day < 1 || day > maxDay) {
    throw new Error(
      `CSV row ${rowNumber} has an invalid day \"${dayText}\" for ${monthLabel} ${yearBe}.`,
    );
  }

  return {
    sourceRow: rowNumber,
    name,
    rawInput: RawInputSchema.parse({
      birthDate: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      birthTime: normalizeBirthTime(birthTime, rowNumber),
      gender: normalizeCsvGender(genderLabel, rowNumber),
      province: options.province,
      calendarSystem: "solar",
      timezone: options.timezone,
    }),
  };
}

export function parseThaiBaziCasesCsv(
  csvText: string,
  options: CsvCaseLoaderOptions = {},
): ImportedBaziCase[] {
  const resolvedOptions = {
    province: options.province?.trim() || DEFAULT_PROVINCE,
    timezone: options.timezone?.trim() || DEFAULT_TIMEZONE,
  };

  const records = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, unknown>>;

  return records.map((record, index) => buildImportedCase(record, index + 2, resolvedOptions));
}