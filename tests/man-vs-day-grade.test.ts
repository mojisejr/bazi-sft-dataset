import { describe, expect, it } from "vitest";

import { gradeForPercent } from "@/lib/bazi/pair-matching";
// B-6/R3: gradeOf ย้ายจาก route → lib (เทสต์ไม่ import จาก route module อีก = ไม่ลาก DB repo graph)
import { enrichDay, enrichMonth, enrichYear, gradeOf } from "@/lib/bazi/day-grade";

// Locks the grade that man-vs-day exposes. We do NOT own the table (rating-scale.json / gradeForPercent) —
// these tests pin its OBSERVED behaviour so nobody can move the seam without a red test, and pin the ONE
// thing this PR adds: the route's null → null mapping (E1) distinct from gradeForPercent's "-" sentinel.

describe("grade table — boundaries locked (integer edges, NO rounding before compare)", () => {
  // The 6 the dispatch calls out, spanning the whole 13-level scale F … A+.
  const boundaries: Array<[number, string]> = [
    [19, "F"],
    [20, "D-"],
    [80, "A-"],
    [81, "A"],
    [91, "A+"],
    [100, "A+"],
  ];
  for (const [pct, grade] of boundaries) {
    it(`${pct} → ${grade}`, () => {
      expect(gradeForPercent(pct)).toBe(grade);
    });
  }

  // E2 seam: a decimal in the join falls to the UPPER cell (C ends at 49, C+ starts at 50) — 49.16 is NOT
  // rounded down to 49→C. If this ever goes red, someone moved the table or added rounding = แต่งตำรา.
  it("49.16 → C+ (seam: decimals fall to the upper cell, never rounded)", () => {
    expect(gradeForPercent(49.16)).toBe("C+");
  });

  // Reference person (birthDate 1990-05-15 · 12:00 · male · Bangkok · 2026-08) — the exact %→grade the
  // dispatch captured live, so the wire numbers and the table agree.
  const reference: Array<[number, string]> = [
    [40.83, "C-"],
    [61.67, "B"],
    [88.34, "A"],
  ];
  for (const [pct, grade] of reference) {
    it(`reference ${pct} → ${grade}`, () => {
      expect(gradeForPercent(pct)).toBe(grade);
    });
  }
});

describe("gradeOf — the route mapping this PR adds (E1)", () => {
  it("null → null (NOT the '-' sentinel)", () => {
    expect(gradeOf(null)).toBeNull();
  });
  it("undefined → null", () => {
    expect(gradeOf(undefined)).toBeNull();
  });
  it("gradeForPercent(null) still returns '-' — the sentinel is UNCHANGED (we did not touch the table)", () => {
    expect(gradeForPercent(null)).toBe("-");
  });
  it("real value passes straight through the table: 49.16 → C+ · 40.83 → C-", () => {
    expect(gradeOf(49.16)).toBe("C+");
    expect(gradeOf(40.83)).toBe("C-");
  });
});

// B-6/R1 — lock the 3-mode response shape. Before this, tests only pinned the table + gradeOf, so a
// refactor that dropped the รายเดือน/รายปี mapping would still be all-green. These fixtures mirror the
// builder output shape (overallPercent per day) and assert grade lands in every mode. If enrichMonth/
// enrichYear stops adding grade, the matching test goes RED.
describe("grade enrichment — 3 modes locked (B-6/R1)", () => {
  const dayResult = { date: "2026-08-05", dayGanzhi: "辛亥", overallPercent: 40.83, verdict: "caution" };
  const monthResult = {
    year: 2026,
    month: 8,
    days: [
      { date: "2026-08-01", overallPercent: 61.67 },
      { date: "2026-08-02", overallPercent: 88.34 },
      { date: "2026-08-05", overallPercent: null },
    ],
  };
  const yearResult = { year: 2026, months: [monthResult, { year: 2026, month: 9, days: [{ date: "2026-09-01", overallPercent: 20 }] }] };

  it("รายวัน — grade เติมระดับบนสุด, คีย์เดิมครบ", () => {
    const e = enrichDay(dayResult);
    expect(e.grade).toBe("C-");
    expect(e.dayGanzhi).toBe("辛亥"); // คีย์เดิมไม่หาย
    expect(e.verdict).toBe("caution");
  });

  it("รายเดือน — grade เติมทุกวันใน days[] (ลบ mapping นี้ = แดง)", () => {
    const e = enrichMonth(monthResult);
    expect(e.days.map((d) => d.grade)).toEqual(["B", "A", null]); // null overallPercent → grade null
    expect(e.days.every((d) => "grade" in d)).toBe(true);
    expect(e.year).toBe(2026); // คีย์เดิมครบ
  });

  it("รายปี — grade เติมทุกวันในทุกเดือน months[].days[] (ห้ามลืม — PDF ขาย)", () => {
    const e = enrichYear(yearResult);
    const allDays = e.months.flatMap((m) => m.days);
    expect(allDays.every((d) => "grade" in d)).toBe(true);
    expect(allDays.map((d) => d.grade)).toEqual(["B", "A", null, "D-"]); // 20 → D-
  });
});
