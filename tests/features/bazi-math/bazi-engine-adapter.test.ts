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

// Distinct birthdate proving the live engine drives output (not a fixed mock 己).
const SECOND_ADAPTER_CASE = {
  birthAt: new Date("1981-03-17T10:22:00+07:00"),
  location: "Bangkok",
  options: {
    gender: "male" as const,
  },
  expectedContract: {
    fourPillars: {
      year: { stem: "辛", branch: "酉" },
      month: { stem: "辛", branch: "卯" },
      day: { stem: "甲", branch: "午" },
      hour: { stem: "己", branch: "巳" },
    },
    dayMaster: "甲",
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

  test("drives output from the live engine so a different birthdate yields a different day master", async () => {
    const calculatedState = await calculateBaziState(
      SECOND_ADAPTER_CASE.birthAt,
      SECOND_ADAPTER_CASE.location,
      {
        ...SECOND_ADAPTER_CASE.options,
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
    }).toEqual(SECOND_ADAPTER_CASE.expectedContract);

    // The mock always returned 己; the live engine varies per input.
    expect(calculatedState.dayMaster).not.toBe(CANONICAL_ADAPTER_CASE.expectedContract.dayMaster);
  });
});