import { describe, expect, it } from "vitest";

import { gradeForPercent } from "@/lib/bazi/pair-matching";
import { gradeOf } from "@/app/api/bazi/man-vs-day/route";

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
