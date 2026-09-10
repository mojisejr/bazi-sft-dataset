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
// ── perf: memoize การคำนวณดวงต่อ rawInput (in-flight dedup + TTL สั้น) ──────────────────────────────
// หน้า "ดวงของฉัน" ยิง ~6-8 endpoint พร้อมกัน (element-summary/life-timeline/strength-score/domain-power/
// calculate/man-vs-day/reading-essence/career-finance) และแต่ละอันเดิม "คำนวณดวงใหม่จาก rawInput ตั้งแต่ต้น"
// (lunar + 20-yr LiuNian + DaYun + strength/interaction + 5-6 SELECT static) = ซ้ำ 6-8 รอบ/โหลด.
// cache นี้ทำให้ทั้ง fan-out รอ "compute เดียวกัน" — เก็บ Promise ไว้เลย (dedup ระหว่างที่ยังคำนวณอยู่).
// deterministic ต่อ rawInput เท่านั้น (repository อ่าน static knowledge เหมือนกันทุก instance) จึง cache ปลอดภัย.
// ⚠️ cache เฉพาะ default DB path — ถ้า caller ส่ง repository เอง (เทส) ให้ bypass เพื่อคงพฤติกรรมเทส.
const STATE_TTL_MS = 60_000;
const STATE_MAX_ENTRIES = 200;
type StateCacheEntry = { at: number; promise: Promise<BaziStatePayload> };
const stateCache = new Map<string, StateCacheEntry>();

function stateCacheKey(rawInput: RawInputValue): string {
  return JSON.stringify([
    rawInput.birthDate,
    rawInput.birthTime,
    rawInput.gender,
    rawInput.province,
    rawInput.calendarSystem,
    rawInput.timezone,
  ]);
}

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

  // caller ส่ง repository เอง → ไม่ใช้ cache (เทส/เส้นทางพิเศษ)
  if (options.repository) {
    try {
      return await calculateBaziChart(rawInput, options.repository);
    } catch (error) {
      throw new BaziEngineAdapterError(
        "bazi_engine_calculation_failed",
        error instanceof Error ? error.message : "Bazi engine failed.",
      );
    }
  }

  const key = stateCacheKey(rawInput);
  const now = Date.now();
  const hit = stateCache.get(key);
  if (hit && now - hit.at < STATE_TTL_MS) return hit.promise;

  const promise = calculateBaziChart(rawInput, createDbKnowledgeRepository()).catch((error) => {
    stateCache.delete(key); // อย่า cache ผลที่ error — ให้ครั้งถัดไปคำนวณใหม่
    throw new BaziEngineAdapterError(
      "bazi_engine_calculation_failed",
      error instanceof Error ? error.message : "Bazi engine failed.",
    );
  });
  stateCache.set(key, { at: now, promise });
  // gc คร่าว ๆ: เกินเพดาน → ตัดตัวเก่าสุด (Map รักษาลำดับ insert)
  if (stateCache.size > STATE_MAX_ENTRIES) {
    const oldest = stateCache.keys().next().value;
    if (oldest !== undefined) stateCache.delete(oldest);
  }
  return promise;
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
