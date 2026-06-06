import { describe, expect, test } from "vitest";

import { buildCanonicalKnowledgeDataset } from "@/lib/bazi/canonical-knowledge";

let cachedDataset: ReturnType<typeof buildCanonicalKnowledgeDataset> | null = null;

function getDataset() {
  cachedDataset ??= buildCanonicalKnowledgeDataset();

  return cachedDataset;
}

describe("buildCanonicalKnowledgeDataset", () => {
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

  test("annotates day-master strength rows with explicit compiled ownership and typed semantic coverage", () => {
    const dataset = getDataset();
    const row = dataset.dayMasterStrengthStates.find((entry) => (
      Array.isArray(entry.metadata.bandCoverage)
      && entry.metadata.bandCoverage.length > 0
    ));

    expect(row).toBeDefined();
    expect(row?.metadata).toMatchObject({
      knowledgeBoundary: {
        bandSemantics: "constants/operator-strength",
        compiledLookupSemantics: "strength-state-vocabulary",
        compiledCorpusTable: "canonical-knowledge.dayMasterStrengthStates",
        repositoryLookup: "symbolic-engine.repository.findDayMasterStrengthProfile",
      },
      repositoryLookupState: expect.anything(),
      bandCoverage: expect.any(Array),
      semanticCoverage: expect.any(Array),
      source2Knowledge: {
        routingNarrative: expect.objectContaining({
          lane: "routing",
          ownerTable: "bazi_day_master_strength_states",
          ownerField: "narrative_summary",
        }),
      },
    });
  });

  test("classifies 癸亥 Source 2 advice ownership without inventing a standalone 12 Qi advice row", () => {
    const dataset = getDataset();
    const row = dataset.sixtyJiaziNarratives.find((entry) => (
      entry.dayMasterChinese === "癸" && entry.branchChinese === "亥"
    ));

    expect(row).toBeDefined();
    expect(row?.combinedNarrative).toContain("ควร");
    expect(row?.metadata).toMatchObject({
      source2Knowledge: {
        dayPillarAdvice: {
          lane: "refinement",
          ownerTable: "bazi_sixty_jiazi_narratives",
          ownerField: "combined_narrative",
          status: "authored",
        },
        twelveQiAdvice: {
          lane: "evidence",
          ownerTable: "typed-constant",
          ownerField: "SOURCE2_TWELVE_QI_ADVICE_POLICY",
          status: "shared-granularity",
          fallbackOwnerTable: "bazi_sixty_jiazi_narratives",
          fallbackOwnerField: "combined_narrative",
          gapCode: "no-standalone-twelve-qi-advice",
        },
      },
    });
  });
});