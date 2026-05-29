import { describe, expect, test } from "vitest";

import {
  BaziStatePayloadSchema,
  buildRawInputFromBirthDate,
  calculateBaziState,
} from "@/features/bazi-math/bazi-engine-adapter";

import { createTestKnowledgeRepository } from "../../helpers/bazi-test-knowledge-repository";

const CANONICAL_ADAPTER_CASE = {
  birthAt: new Date("1993-11-24T15:09:00+07:00"),
  location: "Chiang Rai",
  options: {
    gender: "male" as const,
  },
  expectedRawInput: {
    birthDate: "1993-11-24",
    birthTime: "15:09",
    gender: "male" as const,
    province: "Chiang Rai",
    calendarSystem: "solar" as const,
    timezone: "Asia/Bangkok",
  },
  expectedContract: {
    fourPillars: {
      year: { stem: "癸", branch: "酉" },
      month: { stem: "癸", branch: "亥" },
      day: { stem: "己", branch: "酉" },
      hour: { stem: "壬", branch: "申" },
    },
    dayMaster: "己",
  },
};

describe("bazi engine adapter", () => {
  test("normalizes a plain date and location into canonical raw input", () => {
    const rawInput = buildRawInputFromBirthDate(
      CANONICAL_ADAPTER_CASE.birthAt,
      CANONICAL_ADAPTER_CASE.location,
      CANONICAL_ADAPTER_CASE.options,
    );

    expect(rawInput).toEqual(CANONICAL_ADAPTER_CASE.expectedRawInput);
  });

  test("returns the exact pillar and day master contract for the canonical birth case", async () => {
    const calculatedState = await calculateBaziState(
      CANONICAL_ADAPTER_CASE.birthAt,
      CANONICAL_ADAPTER_CASE.location,
      {
        ...CANONICAL_ADAPTER_CASE.options,
        repository: createTestKnowledgeRepository(),
      },
    );

    expect(() => BaziStatePayloadSchema.parse(calculatedState)).not.toThrow();
    expect({
      fourPillars: {
        year: {
          stem: calculatedState.fourPillars.year.stem,
          branch: calculatedState.fourPillars.year.branch,
        },
        month: {
          stem: calculatedState.fourPillars.month.stem,
          branch: calculatedState.fourPillars.month.branch,
        },
        day: {
          stem: calculatedState.fourPillars.day.stem,
          branch: calculatedState.fourPillars.day.branch,
        },
        hour: {
          stem: calculatedState.fourPillars.hour.stem,
          branch: calculatedState.fourPillars.hour.branch,
        },
      },
      dayMaster: calculatedState.dayMaster,
    }).toEqual(CANONICAL_ADAPTER_CASE.expectedContract);
  });
});