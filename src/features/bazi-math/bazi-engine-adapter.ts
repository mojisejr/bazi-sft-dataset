import { ZodError } from "zod";

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

/**
 * Public payload type returned by the engine adapter. Aliased to the
 * canonical {@link CalculatedStateValue} so downstream consumers
 * (truth packet, chat runner, calculate route) share one truth surface.
 */
export type BaziStatePayload = CalculatedStateValue;

/** Re-export of {@link CalculatedStateSchema} for convenience at the adapter boundary. */
export const BaziStatePayloadSchema = CalculatedStateSchema;

export type BaziEngineAdapterErrorCode =
  | "bazi_engine_invalid_input"
  | "bazi_engine_calculation_failed";

export class BaziEngineAdapterError extends Error {
  constructor(readonly code: BaziEngineAdapterErrorCode, message: string) {
    super(message);
    this.name = "BaziEngineAdapterError";
  }
}

export interface CalculateBaziStateOptions {
  gender: "male" | "female";
  repository?: BaziKnowledgeRepository;
}

export interface CalculateBaziStateFromRawInputOptions {
  repository?: BaziKnowledgeRepository;
}

const BANGKOK_TIMEZONE = "Asia/Bangkok";

function formatBangkokDate(birthAt: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(birthAt);
}

function formatBangkokTime(birthAt: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(birthAt);
}

/**
 * Normalize a JS `Date` plus location into a canonical {@link RawInputValue}
 * anchored in Asia/Bangkok local clock time.
 */
export function buildRawInputFromBirthDate(
  birthAt: Date,
  location: string,
  options: { gender: string },
): RawInputValue {
  if (!(birthAt instanceof Date) || Number.isNaN(birthAt.getTime())) {
    throw new BaziEngineAdapterError(
      "bazi_engine_invalid_input",
      "buildRawInputFromBirthDate requires a valid Date instance.",
    );
  }

  return RawInputSchema.parse({
    birthDate: formatBangkokDate(birthAt),
    birthTime: formatBangkokTime(birthAt),
    gender: options.gender,
    province: location,
    calendarSystem: "solar" as const,
    timezone: BANGKOK_TIMEZONE,
  });
}

/**
 * Run the orthodox math engine ({@link calculateBaziChart}) over a validated
 * {@link RawInputValue}. Input parse failures map to `bazi_engine_invalid_input`;
 * any real-engine computation failure maps to `bazi_engine_calculation_failed`.
 *
 * When no `repository` is provided, a {@link createDbKnowledgeRepository} is
 * constructed lazily here — never at module import time — so importing this
 * module does not eagerly open a DB client.
 */
export async function calculateBaziStateFromRawInput(
  payload: unknown,
  options: CalculateBaziStateFromRawInputOptions = {},
): Promise<BaziStatePayload> {
  let rawInput: RawInputValue;
  try {
    rawInput = RawInputSchema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      throw error;
    }
    throw new BaziEngineAdapterError(
      "bazi_engine_invalid_input",
      error instanceof Error ? error.message : "Invalid raw input.",
    );
  }

  const repository = options.repository ?? createDbKnowledgeRepository();

  try {
    return await calculateBaziChart(rawInput, repository);
  } catch (error) {
    throw new BaziEngineAdapterError(
      "bazi_engine_calculation_failed",
      error instanceof Error ? error.message : "Bazi engine failed.",
    );
  }
}

/**
 * Convenience overload accepting a JS `Date` + location. Normalizes to the
 * canonical {@link RawInputValue} via {@link buildRawInputFromBirthDate}
 * before delegating to {@link calculateBaziStateFromRawInput}.
 */
export async function calculateBaziState(
  birthAt: Date,
  location: string,
  options: CalculateBaziStateOptions,
): Promise<BaziStatePayload> {
  const rawInput = buildRawInputFromBirthDate(birthAt, location, {
    gender: options.gender,
  });
  return calculateBaziStateFromRawInput(rawInput, {
    repository: options.repository,
  });
}
