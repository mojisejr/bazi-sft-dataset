import { ZodError } from "zod";

import {
  CalculatedStateSchema,
  RawInputSchema,
  type CalculatedStateValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import type { BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine";

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
 * Phase 8 will replace this with the real lunar-js / orthodox math engine.
 *
 * For Phase 2 we return a deterministic mock payload that satisfies
 * {@link CalculatedStateSchema} so downstream consumers can wire up against
 * the real type surface without needing the actual ephemeris yet.
 */
function buildMockBaziStatePayload(_rawInput: RawInputValue): BaziStatePayload {
  return CalculatedStateSchema.parse({
    fourPillars: {
      year: { stem: "癸", branch: "酉" },
      month: { stem: "癸", branch: "亥" },
      day: { stem: "己", branch: "酉" },
      hour: { stem: "壬", branch: "申" },
    },
    dayMaster: "己",
    strengthScore: 0,
    tenGods: {},
    twelveQi: {},
    daYun: [],
    shenSha: [],
    elementMetaphors: [],
    compatibilityMatrixProfiles: [],
  });
}

/**
 * Phase 8 will replace this with the real lunar-js / orthodox math engine.
 *
 * Validates `payload` against {@link RawInputSchema} and returns a mock
 * {@link BaziStatePayload}. Repository is accepted for forward compatibility
 * with the real engine but is unused in the Phase 2 stub.
 */
export async function calculateBaziStateFromRawInput(
  payload: unknown,
  _options: CalculateBaziStateFromRawInputOptions = {},
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

  try {
    return buildMockBaziStatePayload(rawInput);
  } catch (error) {
    throw new BaziEngineAdapterError(
      "bazi_engine_calculation_failed",
      error instanceof Error ? error.message : "Mock engine failed.",
    );
  }
}

/**
 * Phase 8 will replace this with the real lunar-js / orthodox math engine.
 *
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
