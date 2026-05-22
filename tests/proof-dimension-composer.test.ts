import { describe, expect, test } from "vitest";

import { BAZI_TOPIC_IDS } from "@/lib/bazi/knowledge/topic-types";
import {
  composeProofDimensions,
  getUnmappedLegacyDimensions,
} from "@/lib/bazi/orchestrator/proof-dimension-composer";
import { REQUIRED_ANNOTATION_DIMENSION_NAMES } from "@/lib/bazi/schema-types";

describe("proof dimension composer", () => {
  test("locks a 15-dimension composition contract with explicit provenance", () => {
    const draftByTopic = Object.fromEntries(
      BAZI_TOPIC_IDS.map((topicId) => [topicId, `${topicId}:draft`]),
    );

    const result = composeProofDimensions({ draftByTopic });

    expect(result.dimensions).toHaveLength(REQUIRED_ANNOTATION_DIMENSION_NAMES.length);
    expect(Object.keys(result.provenance)).toEqual(REQUIRED_ANNOTATION_DIMENSION_NAMES);
    expect(result.provenance.personality_psychology).toMatchObject({
      strategy: "direct-topic-dimension",
      synthesisRationale: "single-topic-direct-map",
      topicIds: ["personality_baseline"],
    });
    expect(result.provenance.career_potential).toMatchObject({
      strategy: "shared-legacy-dimension",
      synthesisRationale: "shared-legacy-dimension-merge",
      topicIds: ["suitable_career", "partnerships"],
    });
    expect(result.provenance.annual_star_energy).toMatchObject({
      strategy: "unmapped-legacy-dimension",
      synthesisRationale: "legacy-dimension-awaits-proof-mapping",
      topicIds: [],
    });
  });

  test("keeps unmapped legacy dimensions explicit in the contract", () => {
    expect(getUnmappedLegacyDimensions()).toEqual([
      "twelve_qi_cycle",
      "annual_star_energy",
      "red_flags",
    ]);
  });
});