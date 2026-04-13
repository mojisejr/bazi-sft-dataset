import { describe, expect, test } from "vitest";

import {
  applyFormFieldChange,
  buildPayload,
  createDefaultFormState,
  getBirthDayOptions,
} from "@/lib/bazi/trainer-workspace";

describe("trainer workspace birth date helpers", () => {
  test("converts Buddhist Era dropdown values into ISO birthDate payload", () => {
    const payload = buildPayload({
      ...createDefaultFormState(),
      birthDay: "12",
      birthMonth: "3",
      birthYearBe: "2524",
      birthTime: "09:15",
      gender: "female",
      province: "Bangkok",
    });

    expect(payload.birthDate).toBe("1981-03-12");
  });

  test("keeps leap-year February day options aligned with Gregorian conversion", () => {
    expect(getBirthDayOptions("2", "2543")).toHaveLength(29);
    expect(getBirthDayOptions("2", "2524")).toHaveLength(28);
  });

  test("clears an out-of-range selected day when month changes", () => {
    const formState = {
      ...createDefaultFormState(),
      birthDay: "31",
      birthMonth: "3",
      birthYearBe: "2524",
    };

    expect(applyFormFieldChange(formState, "birthMonth", "2")).toMatchObject({
      birthDay: "",
      birthMonth: "2",
      birthYearBe: "2524",
    });
  });
});