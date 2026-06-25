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
});

describe("buildDayMasterStrengthVocabulary", () => {
  test("keeps display band and canonical lookup state separate", () => {
    expect(buildDayMasterStrengthVocabulary(2.5)).toEqual({
      displayBand: "ดวงอ่อน",
      displayLabel: "ดิถีอ่อน",
      lookupState: "อ่อนแอ",
    });
  });
});