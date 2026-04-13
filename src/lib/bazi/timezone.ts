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

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((entry) => entry.type === type)?.value;
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