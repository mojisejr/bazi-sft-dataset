import { describe, expect, test } from "vitest";

import {
  hasAnyBaziProfileField,
  isBaziProfileComplete,
  mergeBaziProfileFields,
  toBaziProfileFields,
} from "@/features/open-webui/profile-service";

describe("profile-service", () => {
  test("mergeBaziProfileFields preserves existing facts when incoming fields are empty", () => {
    const merged = mergeBaziProfileFields(
      {
        birthDate: "1992-08-12",
        birthTime: "09:15",
        gender: "female",
        province: "Bangkok",
      },
      {
        birthDate: "   ",
        birthTime: null,
        gender: undefined,
        province: "",
      },
    );

    expect(merged).toEqual({
      birthDate: "1992-08-12",
      birthTime: "09:15",
      gender: "female",
      province: "Bangkok",
    });
  });

  test("later profile facts override earlier partial values and complete the persisted profile", () => {
    const merged = mergeBaziProfileFields(
      {
        birthDate: "1989-01-03",
        birthTime: null,
        gender: "ชาย",
        province: null,
      },
      toBaziProfileFields({
        birthDate: "1989-01-03",
        birthTime: "08:45",
        gender: "ชาย",
        province: "จันทบุรี",
      }),
    );

    expect(hasAnyBaziProfileField(merged)).toBe(true);
    expect(isBaziProfileComplete(merged)).toBe(true);
    expect(merged).toEqual({
      birthDate: "1989-01-03",
      birthTime: "08:45",
      gender: "ชาย",
      province: "จันทบุรี",
    });
  });
});