import { describe, expect, test } from "vitest";

import {
  normalizeBirthTime,
  normalizeBuddhistEraYear,
  normalizeCsvGender,
  normalizeThaiMonth,
  parseThaiBaziCasesCsv,
} from "@/lib/bazi/csv-case-loader";

const SAMPLE_CSV = `ชื่อ,วันที่เกิด,เดือนเกิด,ปีเกิด,เวลาที่เกิด,เพศ
สมบัติ,17,มกราคม,2524,23:58,ชาย
KD,12,พฤศจิกายน,2522,6:00,หญิง
`;

describe("csv case loader helpers", () => {
  test("normalizes Thai month labels and Buddhist Era years", () => {
    expect(normalizeThaiMonth("มกราคม")).toBe(1);
    expect(normalizeBuddhistEraYear("2524")).toBe(1981);
  });

  test("normalizes Thai gender labels and short hour timestamps", () => {
    expect(normalizeCsvGender("ชาย")).toBe("male");
    expect(normalizeCsvGender("หญิง")).toBe("female");
    expect(normalizeBirthTime("6:00")).toBe("06:00");
  });

  test("throws a row-aware error when the month label is unsupported", () => {
    expect(() => normalizeThaiMonth("เดือนไม่มีจริง", 7)).toThrow(
      'CSV row 7 has an unknown Thai month label: "เดือนไม่มีจริง".',
    );
  });
});

describe("parseThaiBaziCasesCsv", () => {
  test("converts Thai CSV rows into canonical raw inputs", () => {
    const cases = parseThaiBaziCasesCsv(SAMPLE_CSV);

    expect(cases).toHaveLength(2);
    expect(cases[0]).toMatchObject({
      sourceRow: 2,
      name: "สมบัติ",
      rawInput: {
        birthDate: "1981-01-17",
        birthTime: "23:58",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      },
    });
    expect(cases[1]).toMatchObject({
      sourceRow: 3,
      name: "KD",
      rawInput: {
        birthDate: "1979-11-12",
        birthTime: "06:00",
        gender: "female",
      },
    });
  });

  test("supports custom province and timezone defaults", () => {
    const [entry] = parseThaiBaziCasesCsv(SAMPLE_CSV, {
      province: "Chiang Mai",
      timezone: "Asia/Hong_Kong",
    });

    expect(entry?.rawInput.province).toBe("Chiang Mai");
    expect(entry?.rawInput.timezone).toBe("Asia/Hong_Kong");
  });

  test("throws when the day does not exist in the converted Gregorian month", () => {
    const invalidCsv = `ชื่อ,วันที่เกิด,เดือนเกิด,ปีเกิด,เวลาที่เกิด,เพศ\nผิดวัน,31,กุมภาพันธ์,2524,14:05,หญิง\n`;

    expect(() => parseThaiBaziCasesCsv(invalidCsv)).toThrow(
      'CSV row 2 has an invalid day "31" for กุมภาพันธ์ 2524.',
    );
  });
});