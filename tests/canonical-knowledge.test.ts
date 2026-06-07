import { existsSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { buildCanonicalKnowledgeDataset } from "@/lib/bazi/canonical-knowledge";
import { resolveDistilledCorpusRoot } from "../scripts/compile-knowledge";

// corpus ต้นทาง (../../.tmp/p-pol/Mootech AI/all_distilled) ไม่ ship มากับ repo → skip เมื่อไม่มี
const corpusMissing = !existsSync(resolveDistilledCorpusRoot());

let cachedDataset: ReturnType<typeof buildCanonicalKnowledgeDataset> | null = null;

function getDataset() {
  cachedDataset ??= buildCanonicalKnowledgeDataset();

  return cachedDataset;
}

describe.skipIf(corpusMissing)("buildCanonicalKnowledgeDataset", () => {
  test("extracts canonical records from the current Mootech corpus", () => {
    const dataset = getDataset();

    expect(dataset.sources.length).toBeGreaterThanOrEqual(180);
    expect(dataset.referenceDocuments.length).toBeGreaterThanOrEqual(19);
    expect(dataset.canonicalRawRows.length).toBeGreaterThan(1000);
    expect(dataset.timeSolarTerms.length).toBe(4824);
    expect(dataset.faqTaxonomies.length).toBeGreaterThan(30);
    expect(dataset.elementInteractions.length).toBeGreaterThan(200);
    expect(dataset.twelveQiStages.length).toBeGreaterThanOrEqual(120);
    expect(dataset.dayMasterProfiles.length).toBeGreaterThan(50);
    expect(dataset.dayMasterStrengthStates.length).toBeGreaterThan(200);
    expect(dataset.sixtyJiaziNarratives.length).toBe(60);
    expect(dataset.domainMatrices.length).toBeGreaterThan(500);
  }, 20_000);

  test("preserves important source coverage and replaces the missing solar-term warning with generated truth", () => {
    const dataset = getDataset();

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