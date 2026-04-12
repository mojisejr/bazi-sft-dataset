import { describe, expect, test } from "vitest";

import { buildCanonicalKnowledgeDataset } from "@/lib/bazi/canonical-knowledge";

describe("buildCanonicalKnowledgeDataset", () => {
  test("extracts canonical records from the current Mootech corpus", () => {
    const dataset = buildCanonicalKnowledgeDataset();

    expect(dataset.sources.length).toBeGreaterThanOrEqual(180);
    expect(dataset.referenceDocuments.length).toBeGreaterThanOrEqual(19);
    expect(dataset.canonicalRawRows.length).toBeGreaterThan(1000);
    expect(dataset.timeSolarTerms.length).toBe(4824);
    expect(dataset.faqTaxonomies.length).toBeGreaterThan(30);
    expect(dataset.elementInteractions.length).toBeGreaterThan(200);
    expect(dataset.twelveQiStages.length).toBeGreaterThanOrEqual(120);
    expect(dataset.dayMasterProfiles.length).toBeGreaterThan(50);
    expect(dataset.dayMasterStrengthStates.length).toBeGreaterThan(200);
    expect(dataset.sixtyJiaziNarratives.length).toBeGreaterThan(50);
    expect(dataset.domainMatrices.length).toBeGreaterThan(500);
  });

  test("preserves important source coverage and replaces the missing solar-term warning with generated truth", () => {
    const dataset = buildCanonicalKnowledgeDataset();

    expect(
      dataset.referenceDocuments.some((entry) =>
        entry.sourcePath.endsWith("Source6_ การงานและธุรกิจ/Source6_ การงานและธุรกิจ.md"),
      ),
    ).toBe(true);

    expect(
      dataset.canonicalRawRows.some((entry) =>
        entry.sourcePath.endsWith("FAQ by Mootech AI/FAQ by Mootech AI - Sheet1.csv"),
      ),
    ).toBe(true);

    expect(dataset.warnings).not.toContain("time-solar-term-source-missing");
    expect(dataset.warnings).toEqual([]);
  });
});