export type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

const FIXED_TIMEZONE_OFFSETS = {
  "Asia/Bangkok": 7 * 60,
  "Asia/Hong_Kong": 8 * 60,
  "Asia/Shanghai": 8 * 60,
  "Asia/Singapore": 8 * 60,
  "Asia/Taipei": 8 * 60,
} as const;

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((entry) => entry.type === type)?.value;
}

function getFixedTimezoneOffsetMinutes(timeZone: string) {
  return FIXED_TIMEZONE_OFFSETS[timeZone as keyof typeof FIXED_TIMEZONE_OFFSETS] ?? null;
}

function getUtcParts(date: Date): DateTimeParts {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

export function parseDateTimeParts(dateText: string, timeText: string): DateTimeParts {
  const dateMatch = DATE_PATTERN.exec(dateText.trim());
  const timeMatch = TIME_PATTERN.exec(timeText.trim());

  if (!dateMatch || !timeMatch) {
    throw new Error("birthDate must be YYYY-MM-DD and birthTime must be HH:mm or HH:mm:ss.");
  }

  return {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] ?? "0"),
  };
}

export function getDateTimePartsInTimeZone(date: Date, timeZone: string): DateTimeParts {
  const fixedOffsetMinutes = getFixedTimezoneOffsetMinutes(timeZone);

  if (fixedOffsetMinutes !== null) {
    return getUtcParts(new Date(date.getTime() + fixedOffsetMinutes * 60 * 1000));
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);

  return {
    year: Number(getPart(parts, "year")),
    month: Number(getPart(parts, "month")),
    day: Number(getPart(parts, "day")),
    hour: Number(getPart(parts, "hour")),
    minute: Number(getPart(parts, "minute")),
    second: Number(getPart(parts, "second")),
  };
}

export function formatDateTimeParts(parts: DateTimeParts) {
  return [parts.year, String(parts.month).padStart(2, "0"), String(parts.day).padStart(2, "0")].join(
    "-",
  ) + ` ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
}

export function zonedDateTimeToUtc(parts: DateTimeParts, timeZone: string) {
  const fixedOffsetMinutes = getFixedTimezoneOffsetMinutes(timeZone);

  if (fixedOffsetMinutes !== null) {
    return new Date(
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      ) - fixedOffsetMinutes * 60 * 1000,
    );
  }

  let guess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zoned = getDateTimePartsInTimeZone(new Date(guess), timeZone);
    const zonedAsUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    );
    const targetAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const diff = zonedAsUtc - targetAsUtc;

    if (diff === 0) {
      break;
    }

    guess -= diff;
  }

  return new Date(guess);
}