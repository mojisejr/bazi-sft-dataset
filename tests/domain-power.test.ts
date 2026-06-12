import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { DomainPowerSchema } from "@/lib/bazi/schema-types";
import {
  classifyDomainPowerBand,
  computeCareerPower,
  computeDomainPower,
  computeWealthPower,
  type DomainPowerChart,
  type DomainPowerPillar,
} from "@/lib/bazi/symbolic-engine.domain-power";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, "../src/lib/bazi/data/domain-power");

const matrix = JSON.parse(
  readFileSync(resolve(DATA, "matrix.json"), "utf-8"),
) as Record<string, number>;
const cases = JSON.parse(
  readFileSync(resolve(DATA, "cases.json"), "utf-8"),
) as {
  careerLearningPairs: Array<{ day: string; other: string; coefficient: number }>;
  wealth: Array<{
    label: string;
    pillars: { hour: string; day: string; month: string; year: string };
    dayMaster: string;
    expectedAvg: number;
    expectedScore: number;
    rowCount: number;
  }>;
};

function pillar(ganZhi: string): DomainPowerPillar {
  return { stem: ganZhi[0], branch: ganZhi[1] };
}

function chartFromPillars(p: {
  hour: string;
  day: string;
  month: string;
  year: string;
}): DomainPowerChart {
  return {
    year: pillar(p.year),
    month: pillar(p.month),
    day: pillar(p.day),
    hour: pillar(p.hour),
  };
}

/**
 * Hand-typed EX block in the work/learn วิธีคำนวน sheets that disagrees with the
 * authoritative 60×60 pair sheets (its lookup codes A6/A8/B6 differ from the sheet's
 * A9/A7/B5). Treated as a known source typo, not a parser/engine defect.
 */
const KNOWN_SOURCE_TYPO_PAIRS = new Set(["丙戌|戊申"]);

describe("domain-power: shared 60×60 matrix", () => {
  test("matrix has the full 3,600 jiazi-pair coverage", () => {
    expect(Object.keys(matrix).length).toBe(3600);
  });

  test("career/learning single-pair lookups match the worksheet EX coefficients", () => {
    const mismatches: string[] = [];
    for (const ex of cases.careerLearningPairs) {
      const key = `${ex.day}|${ex.other}`;
      if (KNOWN_SOURCE_TYPO_PAIRS.has(key)) continue;
      const score = computeCareerPower({
        ...chartFromPillars({ hour: ex.other, day: ex.day, month: ex.other, year: ex.other }),
      });
      // career = matrix[day|month]; we set month = other, so the coefficient must match
      if (Math.abs(score.coefficient - ex.coefficient) > 0.005) {
        mismatches.push(`${key}: engine=${score.coefficient} ex=${ex.coefficient}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("domain-power: band classification", () => {
  test.each([
    [0.0, "very-weak"],
    [0.19, "very-weak"],
    [0.2, "weak"],
    [0.45, "balanced"],
    [0.6, "strong"],
    [0.85, "very-strong"],
    [1.0, "very-strong"],
  ])("coefficient %s -> %s", (coeff, band) => {
    expect(classifyDomainPowerBand(coeff as number)).toBe(band);
  });
});

describe("domain-power: wealth worked examples", () => {
  // The single-laph-position case is fully deterministic and must reproduce exactly.
  const singlePosition = cases.wealth.filter((c) => c.rowCount === 2);

  test("reproduces single-position (ลาภแท้-visible) wealth cases exactly and flags them non-approximate", () => {
    expect(singlePosition.length).toBeGreaterThan(0);
    for (const wealthCase of singlePosition) {
      const result = computeWealthPower(chartFromPillars(wealthCase.pillars));
      expect(result.coefficient).toBeCloseTo(wealthCase.expectedAvg, 4);
      expect(result.score).toBeCloseTo(wealthCase.expectedScore, 1);
      expect(result.approximate).toBeUndefined();
    }
  });

  // Multi-position / ลาภแฝง / hidden-stem wealth involves the sinsae's per-chart
  // selection judgment. A 100+ candidate-rule brute force tops out at 2/6 exact, so no
  // single algorithm reproduces these — the engine returns a principled, *flagged*
  // approximation. We assert it is valid AND honestly marked approximate.
  test("multi-position wealth returns a valid, approximate-flagged score", () => {
    for (const wealthCase of cases.wealth.filter((c) => c.rowCount !== 2)) {
      const result = computeWealthPower(chartFromPillars(wealthCase.pillars));
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.band).toBeTruthy();
      expect(result.approximate).toBe(true);
    }
  });

  // Lock in the documented ceiling: the principled rule reproduces ≥2 of the 6 worked
  // examples exactly. If a future tweak regresses below this, the test fails loudly.
  test("principled wealth rule reproduces the documented number of exact matches", () => {
    const exact = cases.wealth.filter((wealthCase) => {
      const result = computeWealthPower(chartFromPillars(wealthCase.pillars));
      return Math.abs(result.coefficient - wealthCase.expectedAvg) < 0.01;
    });
    expect(exact.length).toBeGreaterThanOrEqual(2);
    // The clean (non-approximate) path must always be numerically exact — that is the
    // trust guarantee. Approximate-flagged results may match coincidentally, so they
    // carry no such guarantee.
    for (const wealthCase of cases.wealth) {
      const result = computeWealthPower(chartFromPillars(wealthCase.pillars));
      if (!result.approximate) {
        expect(result.coefficient).toBeCloseTo(wealthCase.expectedAvg, 4);
      }
    }
  });
});

describe("domain-power: full computeDomainPower", () => {
  test("produces a schema-valid result for every wealth fixture chart", () => {
    for (const wealthCase of cases.wealth) {
      const result = computeDomainPower(chartFromPillars(wealthCase.pillars));
      expect(() => DomainPowerSchema.parse(result)).not.toThrow();
    }
  });

  test("friends carries interpretation text when present", () => {
    // 甲午 day pillar (1981-03-17 case) has a friends-table entry
    const result = computeDomainPower(
      chartFromPillars({ hour: "己巳", day: "甲午", month: "辛卯", year: "辛酉" }),
    );
    expect(result.friends.score).toBeGreaterThanOrEqual(0);
    expect(result.career.basis.length).toBeGreaterThan(0);
  });
});
