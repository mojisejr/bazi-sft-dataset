import { describe, expect, test } from "vitest";

import { buildCanonicalKnowledgeDataset } from "@/lib/bazi/canonical-knowledge";
import {
  buildSource2DayPillarAdviceInput,
  buildSource2RoutingNarrativeInput,
  buildSource2TwelveQiAdviceInput,
} from "@/lib/bazi/source2-knowledge-ownership";

let cachedDataset: ReturnType<typeof buildCanonicalKnowledgeDataset> | null = null;

function getDataset() {
  cachedDataset ??= buildCanonicalKnowledgeDataset();

  return cachedDataset;
}

describe("Source 2 knowledge ownership", () => {
  test("maps the 癸亥 corpus row into deterministic day-pillar and 12 Qi advice inputs", () => {
    const row = getDataset().sixtyJiaziNarratives.find((entry) => (
      entry.dayMasterChinese === "癸" && entry.branchChinese === "亥"
    ));

    expect(row).toBeDefined();

    const dayPillarAdvice = buildSource2DayPillarAdviceInput({
      sourcePath: row?.sourcePath,
      rowGroup: row?.rowGroup,
      combinedNarrative: row?.combinedNarrative ?? null,
      metadata: row?.metadata,
    });
    const twelveQiAdvice = buildSource2TwelveQiAdviceInput({
      sourcePath: row?.sourcePath,
      rowGroup: row?.rowGroup,
      combinedNarrative: row?.combinedNarrative ?? null,
      metadata: row?.metadata,
    });

    expect(dayPillarAdvice).toMatchObject({
      text: row?.combinedNarrative,
      ownership: {
        lane: "refinement",
        ownerTable: "bazi_sixty_jiazi_narratives",
        ownerField: "combined_narrative",
        status: "authored",
      },
    });
    expect(twelveQiAdvice).toMatchObject({
      text: row?.combinedNarrative,
      ownership: {
        lane: "evidence",
        ownerTable: "typed-constant",
        ownerField: "SOURCE2_TWELVE_QI_ADVICE_POLICY",
        status: "shared-granularity",
        gapCode: "no-standalone-twelve-qi-advice",
      },
    });
  });

  test("classifies missing authored Source 2 rows explicitly instead of inferring advice", () => {
    const routingNarrative = buildSource2RoutingNarrativeInput({
      sourcePath: "tests/source2-knowledge-ownership.test.ts",
      rowOrder: 41,
      narrative: null,
    });
    const dayPillarAdvice = buildSource2DayPillarAdviceInput({
      sourcePath: "tests/source2-knowledge-ownership.test.ts",
      rowGroup: 42,
      combinedNarrative: null,
    });
    const twelveQiAdvice = buildSource2TwelveQiAdviceInput({
      sourcePath: "tests/source2-knowledge-ownership.test.ts",
      rowGroup: 42,
      combinedNarrative: null,
    });

    expect(routingNarrative).toMatchObject({
      text: null,
      ownership: {
        status: "classified-gap",
        gapCode: "missing-routing-narrative",
      },
    });
    expect(dayPillarAdvice).toMatchObject({
      text: null,
      ownership: {
        status: "classified-gap",
        gapCode: "missing-day-pillar-advice",
      },
    });
    expect(twelveQiAdvice).toMatchObject({
      text: null,
      ownership: {
        status: "classified-gap",
        gapCode: "missing-shared-twelve-qi-advice",
      },
    });
  });
});