// Hour Rectification — chart-profile-adapter self-check (#hour-rectification-engine, v1). A
// DEFENSIVE test: the whole v1 model rests on the claim that the pure element-math role computation
// (computeElementRole over STEM_TO_ELEMENT) agrees with the main engine's own tenGod field. If they
// ever diverge, match.ts would score hours against a signature that doesn't reflect the real chart.
// So we compute the 12 real hour charts for a known birth and assert, hour by hour, that our
// stemRole equals the role the engine's Chinese tenGod string implies. No mock — this is a genuine
// end-to-end agreement check against the real calc engine.
import { describe, expect, test } from "vitest";
import {
  buildHourChartProfiles,
  extractHourSignatures,
} from "@/lib/bazi/hour-rectification/adapters/chart-profile-adapter";
import {
  ELEMENT_ROLES,
  ELEMENTS,
  STRENGTH_BUCKETS,
  type ElementRole,
} from "@/lib/bazi/hour-rectification/domain/types";

// The engine emits the classic Ten Gods (十神) in Chinese. Each maps onto exactly one of our 5
// day-master-relative roles — the SAME grouping the doctrine ROLE_KEYS use:
//   比肩/劫财 → same     (peers / self)
//   正印/偏印 → resource (feeds the day master)
//   食神/伤官 → output   (day master feeds it)
//   正财/偏财 → wealth   (day master controls it)
//   正官/七杀 → power    (controls the day master)
const TEN_GOD_TO_ROLE: Record<string, ElementRole> = {
  比肩: "same",
  劫财: "same",
  正印: "resource",
  偏印: "resource",
  食神: "output",
  伤官: "output",
  正财: "wealth",
  偏财: "wealth",
  正官: "power",
  七杀: "power",
};

// A real, computable birth (ฟีม 1989-01-03 ♂ กรุงเทพฯ, 癸 day master) — the same fixture the design
// contract verified 12 distinct signatures against.
const BIRTH = {
  birthDate: "1989-01-03",
  gender: "male",
  province: "กรุงเทพมหานคร",
} as const;

describe("chart-profile-adapter — stemRole agrees with the engine's tenGod", () => {
  test("for every one of the 12 hours, computed stemRole matches what the real chart's tenGod implies", async () => {
    const profiles = await buildHourChartProfiles(BIRTH);
    const signatures = extractHourSignatures(profiles);
    expect(profiles.length).toBe(12);
    expect(signatures.length).toBe(12);

    // Line up each hour's real chart against its computed signature by branch.
    const sigByBranch = new Map(signatures.map((sig) => [sig.hourBranch, sig]));

    for (const profile of profiles) {
      const chart = profile.chart as { fourPillars?: { hour?: { tenGod?: string } } };
      const tenGod = chart.fourPillars?.hour?.tenGod ?? "";
      const expectedRole = TEN_GOD_TO_ROLE[tenGod];
      // The engine should always emit one of the 10 known tenGods for the hour stem.
      expect(expectedRole, `unmapped tenGod "${tenGod}" for hour ${profile.hourBranch}`).toBeTruthy();

      const sig = sigByBranch.get(profile.hourBranch);
      expect(sig).toBeTruthy();
      expect(
        sig!.signature.stemRole,
        `hour ${profile.hourBranch}: element-math role vs engine tenGod ${tenGod}`,
      ).toBe(expectedRole);
    }
  }, 60_000);

  test("all 12 signatures are well-formed — every field is in the shared SIGNATURE vocabulary", async () => {
    const signatures = extractHourSignatures(await buildHourChartProfiles(BIRTH));
    for (const { hourBranch, signature } of signatures) {
      expect((ELEMENTS as readonly string[]).includes(signature.stemElement), `stemElement@${hourBranch}`).toBe(true);
      expect((ELEMENT_ROLES as readonly string[]).includes(signature.stemRole), `stemRole@${hourBranch}`).toBe(true);
      expect((ELEMENT_ROLES as readonly string[]).includes(signature.branchRole), `branchRole@${hourBranch}`).toBe(true);
      expect((STRENGTH_BUCKETS as readonly string[]).includes(signature.strengthBucket), `strengthBucket@${hourBranch}`).toBe(true);
    }
  }, 60_000);

  test("relative strength bucketing discriminates — ≥2 distinct buckets across the 12 hours", async () => {
    // If bucketByRelativeStrength collapsed everything to one bucket, strengthBucket would carry no
    // information for match.ts. Proving ≥2 distinct values shows the relative (per-person) bucketing
    // actually splits this person's own 12 hours.
    const signatures = extractHourSignatures(await buildHourChartProfiles(BIRTH));
    const distinctBuckets = new Set(signatures.map((s) => s.signature.strengthBucket));
    expect(distinctBuckets.size).toBeGreaterThanOrEqual(2);
  }, 60_000);
});
