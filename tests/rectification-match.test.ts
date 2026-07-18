// Hour Rectification — match.ts (#hour-rectification-engine, v1). The scorer is the heart of v1:
// given accumulated signature evidence, pick the best-matching ยาม among the user's OWN 12 real
// hour signatures. These tests pin down the two properties everything else leans on: it NEVER
// returns empty when a hour exists, and its argmax + tie-break are fully deterministic.
import { describe, expect, test } from "vitest";
import {
  accumulateEvidence,
  matchSignature,
  scoreHour,
  type TargetSignature,
} from "@/lib/bazi/hour-rectification/domain/match";
import type {
  HourBranch,
  HourSignature,
  SignatureVote,
  StructuralSignature,
} from "@/lib/bazi/hour-rectification/domain/types";

function sig(partial: Partial<StructuralSignature>): StructuralSignature {
  return {
    stemElement: "water",
    stemRole: "same",
    branchRole: "same",
    strengthBucket: "balanced",
    ...partial,
  };
}

function hour(
  hourBranch: HourBranch,
  partial: Partial<StructuralSignature>,
  strengthScore = 5,
): HourSignature {
  return { hourBranch, signature: sig(partial), strengthScore };
}

describe("accumulateEvidence", () => {
  test("sums weights per dimension/value across votes", () => {
    const votes: SignatureVote[] = [
      { dimension: "stemElement", value: "metal", weight: 2 },
      { dimension: "stemElement", value: "metal", weight: 1 },
      { dimension: "stemElement", value: "water", weight: 1 },
      { dimension: "stemRole", value: "power", weight: 3 },
    ];
    const target = accumulateEvidence(votes);
    expect(target.stemElement.metal).toBe(3);
    expect(target.stemElement.water).toBe(1);
    expect(target.stemRole.power).toBe(3);
    expect(target.branchRole).toEqual({});
  });

  test("ignores votes on an unknown dimension (defensive)", () => {
    const target = accumulateEvidence([
      { dimension: "nonsense" as SignatureVote["dimension"], value: "x", weight: 5 },
      { dimension: "stemElement", value: "fire", weight: 2 },
    ]);
    expect(target.stemElement.fire).toBe(2);
    expect(Object.keys(target).sort()).toEqual([
      "branchRole",
      "stemElement",
      "stemRole",
      "strengthBucket",
    ]);
  });
});

describe("scoreHour", () => {
  test("adds target weight for each dimension the hour's value matches", () => {
    const target = accumulateEvidence([
      { dimension: "stemElement", value: "metal", weight: 2 },
      { dimension: "stemRole", value: "power", weight: 3 },
      { dimension: "branchRole", value: "wealth", weight: 1 },
    ]);
    // matches stemElement(metal) + stemRole(power) = 5, branchRole is "same" not "wealth" → +0
    expect(scoreHour(target, sig({ stemElement: "metal", stemRole: "power" }))).toBe(5);
    // matches nothing
    expect(scoreHour(target, sig({ stemElement: "water", stemRole: "same" }))).toBe(0);
  });
});

describe("matchSignature", () => {
  test("returns null only when there are no hours", () => {
    expect(matchSignature(accumulateEvidence([]), [])).toBeNull();
  });

  test("never returns empty with ≥1 hour, even with zero evidence", () => {
    const hours = [hour("午", {}), hour("子", {}), hour("酉", {})];
    const match = matchSignature(accumulateEvidence([]), hours);
    expect(match).not.toBeNull();
    // zero evidence → all score 0 → tie-break falls to HOUR_BRANCHES order: 子 precedes 午/酉.
    expect(match!.hourBranch).toBe("子");
    expect(match!.score).toBe(0);
  });

  test("picks the highest-scoring hour", () => {
    const target = accumulateEvidence([
      { dimension: "stemElement", value: "metal", weight: 2 },
      { dimension: "stemRole", value: "power", weight: 2 },
    ]);
    const hours: HourSignature[] = [
      hour("子", { stemElement: "water", stemRole: "same" }), // 0
      hour("酉", { stemElement: "metal", stemRole: "same" }), // 2
      hour("午", { stemElement: "metal", stemRole: "power" }), // 4
    ];
    const match = matchSignature(target, hours)!;
    expect(match.hourBranch).toBe("午");
    expect(match.score).toBe(4);
    expect(match.margin).toBe(2); // 4 - 2
    expect(match.ranked.map((r) => r.hourBranch)).toEqual(["午", "酉", "子"]);
  });

  test("tie on score is broken by more dimensions matched", () => {
    // Both score 3, but 酉 matches 2 dimensions (2 lighter votes) vs 午 one heavy vote.
    const target = accumulateEvidence([
      { dimension: "stemElement", value: "metal", weight: 3 }, // 午 gets this
      { dimension: "stemRole", value: "power", weight: 1.5 }, // 酉 gets both these
      { dimension: "branchRole", value: "wealth", weight: 1.5 },
    ]);
    const hours: HourSignature[] = [
      hour("午", { stemElement: "metal", stemRole: "same", branchRole: "same" }), // 3, 1 dim
      hour("酉", { stemElement: "water", stemRole: "power", branchRole: "wealth" }), // 3, 2 dims
    ];
    const match = matchSignature(target, hours)!;
    expect(match.score).toBe(3);
    expect(match.hourBranch).toBe("酉"); // more dimensions matched wins the tie
  });

  test("full tie (score + dims) is broken deterministically by HOUR_BRANCHES order", () => {
    const target = accumulateEvidence([{ dimension: "stemElement", value: "metal", weight: 2 }]);
    const hours: HourSignature[] = [
      hour("酉", { stemElement: "metal" }),
      hour("巳", { stemElement: "metal" }),
      hour("寅", { stemElement: "metal" }),
    ];
    const match = matchSignature(target, hours)!;
    // 寅(index2) < 巳(5) < 酉(9) → 寅 wins. Stable regardless of input order.
    expect(match.hourBranch).toBe("寅");
    expect(matchSignature(target, [...hours].reverse())!.hourBranch).toBe("寅");
  });

  test("PERSONAL: identical evidence yields a different hour for a different chart", () => {
    // Same answers (target), two people whose 12 hours carry the properties on different branches.
    const target = accumulateEvidence([
      { dimension: "stemElement", value: "fire", weight: 2 },
      { dimension: "strengthBucket", value: "strong", weight: 2 },
    ]);
    const personA: HourSignature[] = [
      hour("午", { stemElement: "fire", strengthBucket: "strong" }),
      hour("子", { stemElement: "water", strengthBucket: "weak" }),
    ];
    const personB: HourSignature[] = [
      hour("午", { stemElement: "water", strengthBucket: "weak" }),
      hour("子", { stemElement: "fire", strengthBucket: "strong" }),
    ];
    expect(matchSignature(target, personA)!.hourBranch).toBe("午");
    expect(matchSignature(target, personB)!.hourBranch).toBe("子");
  });

  test("is deterministic across repeated calls", () => {
    const target: TargetSignature = accumulateEvidence([
      { dimension: "stemRole", value: "resource", weight: 1 },
    ]);
    const hours = [hour("卯", { stemRole: "resource" }), hour("申", { stemRole: "resource" })];
    const first = matchSignature(target, hours)!;
    const second = matchSignature(target, hours)!;
    expect(second).toEqual(first);
  });
});
