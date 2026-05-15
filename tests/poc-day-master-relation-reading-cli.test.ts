import { describe, expect, test } from "vitest";

import { parseCliExecutionOptions } from "../scripts/poc-day-master-relation-reading";

describe("relation reading cli argv", () => {
  test("merges raw input flags onto the default test case", () => {
    const options = parseCliExecutionOptions([
      "--dry-run",
      "--model=gemini-test",
      "--birth-date=1989-01-03",
      "--birth-time=08:40",
      "--gender=male",
      "--province=Chiang Mai",
      "--calendar-system=lunar",
      "--timezone=Asia/Chiang_Mai",
    ]);

    expect(options.dryRun).toBe(true);
    expect(options.model).toBe("gemini-test");
    expect(options.rawInput).toMatchObject({
      birthDate: "1989-01-03",
      birthTime: "08:40",
      gender: "male",
      province: "Chiang Mai",
      calendarSystem: "lunar",
      timezone: "Asia/Chiang_Mai",
    });
  });

  test("fails through raw input validation for invalid calendar system", () => {
    expect(() => parseCliExecutionOptions([
      "--calendar-system=moon",
    ])).toThrow();
  });

  test("rejects unknown cli flags instead of silently drifting", () => {
    expect(() => parseCliExecutionOptions([
      "--relation=wealth",
    ])).toThrow("Unknown CLI option");
  });

  test("parses --max-step and clamps to valid range", () => {
    const three = parseCliExecutionOptions(["--max-step=3"]);
    expect(three.maxStep).toBe(3);

    const clampedLow = parseCliExecutionOptions(["--max-step=0"]);
    expect(clampedLow.maxStep).toBe(1);

    const clampedHigh = parseCliExecutionOptions(["--max-step=99"]);
    expect(clampedHigh.maxStep).toBe(6);

    const invalid = parseCliExecutionOptions(["--max-step=abc"]);
    expect(invalid.maxStep).toBe(6);

    const defaultVal = parseCliExecutionOptions([]);
    expect(defaultVal.maxStep).toBe(6);
  });
});
