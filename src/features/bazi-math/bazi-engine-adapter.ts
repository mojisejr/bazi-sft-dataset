import {
  CalculatedStateSchema,
  RawInputSchema,
  type CalculatedStateValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import {
  calculateBaziChart,
  type BaziKnowledgeRepository,
} from "@/lib/bazi/symbolic-engine";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";

export const BaziStatePayloadSchema = CalculatedStateSchema;

export type BaziStatePayload = CalculatedStateValue;

type BaziAdapterOptions = {
  repository?: BaziKnowledgeRepository;
  gender?: RawInputValue["gender"];
  timezone?: string;
  calendarSystem?: RawInputValue["calendarSystem"];
};

const DEFAULT_GENDER: RawInputValue["gender"] = "female";
const DEFAULT_TIMEZONE = "Asia/Bangkok";
const DEFAULT_CALENDAR_SYSTEM: NonNullable<RawInputValue["calendarSystem"]> = "solar";

function formatBirthDateTime(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    birthDate: `${lookup.year}-${lookup.month}-${lookup.day}`,
    birthTime: `${lookup.hour}:${lookup.minute}`,
  };
}

export function buildRawInputFromBirthDate(
  date: Date,
  location: string,
  options: Omit<BaziAdapterOptions, "repository"> = {},
): RawInputValue {
  const timezone = options.timezone ?? DEFAULT_TIMEZONE;
  const { birthDate, birthTime } = formatBirthDateTime(date, timezone);

  return RawInputSchema.parse({
    birthDate,
    birthTime,
    gender: options.gender ?? DEFAULT_GENDER,
    province: location,
    calendarSystem: options.calendarSystem ?? DEFAULT_CALENDAR_SYSTEM,
    timezone,
  });
}

export async function calculateBaziStateFromRawInput(
  payload: RawInputValue,
  options: Pick<BaziAdapterOptions, "repository"> = {},
): Promise<BaziStatePayload> {
  const repository = options.repository ?? createDbKnowledgeRepository();
  const calculatedState = await calculateBaziChart(payload, repository);

  return BaziStatePayloadSchema.parse(calculatedState);
}

export async function calculateBaziState(
  date: Date,
  location: string,
  options: BaziAdapterOptions = {},
): Promise<BaziStatePayload> {
  const rawInput = buildRawInputFromBirthDate(date, location, options);

  return calculateBaziStateFromRawInput(rawInput, options);
}