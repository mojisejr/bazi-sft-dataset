import { describe, expect, test } from "vitest";

import {
  buildDayMasterStrengthVocabulary,
  resolveCanonicalDayMasterStrengthState,
} from "@/lib/bazi/strength-state-vocabulary";

describe("resolveCanonicalDayMasterStrengthState", () => {
  test.each([
    ["อ่อนเกินไป", "อ่อนแอ"],
    ["ดวงอ่อน", "อ่อนแอ"],
    ["ต่ำกว่า 3 ทุกรูปแบบ ดิถีอ่อน", "อ่อนแอ"],
    ["3.5", "อ่อนแอ"],
    ["4.5", "แข็งแรง/สมดุล"],
    ["แข็งเกือบอ่อน", "แข็งแรง/สมดุล"],
    ["6.5", "แข็งแรง/สมดุล"],
    ["แข็งมากเกินไป", "แข็งแรงมากเกินไป"],
    ["8", "แข็งแรงมากเกินไป"],
  ])("maps %s to %s", (rawState, expected) => {
    expect(resolveCanonicalDayMasterStrengthState(rawState)?.lookupState).toBe(expected);
  });

  test("ignores header-like blanks and summary rows", () => {
    expect(resolveCanonicalDayMasterStrengthState(" ")).toBeNull();
    expect(resolveCanonicalDayMasterStrengthState("รูปแบบโดยสังเขป")).toBeNull();
  });

  test("keeps exact band coverage and explicit semantic coverage separate from compiled lookup state", () => {
    expect(resolveCanonicalDayMasterStrengthState("ดวงแข็ง")).toMatchObject({
      lookupState: "แข็งแรง/สมดุล",
      repositoryLookupState: "แข็งแรง/สมดุล",
      bandCoverage: ["strong"],
      semanticCoverage: ["channel"],
    });

    expect(resolveCanonicalDayMasterStrengthState("แข็งแรง/สมดุล")).toMatchObject({
      lookupState: "แข็งแรง/สมดุล",
      bandCoverage: ["balanced", "strong"],
      semanticCoverage: ["circulate", "channel"],
    });
  });
});

describe("buildDayMasterStrengthVocabulary", () => {
  test("keeps display band and canonical lookup state separate", () => {
    expect(buildDayMasterStrengthVocabulary(3.75)).toEqual({
      bandId: "weak",
      semanticId: "reinforce",
      displayBand: "ดวงอ่อน",
      displayLabel: "ดิถีอ่อน",
      lookupState: "อ่อนแอ",
      repositoryLookupState: "อ่อนแอ",
      sourceState: "ดวงอ่อน",
    });
  });
});