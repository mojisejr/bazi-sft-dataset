import { describe, expect, test } from "vitest";

import { BAZI_TOPIC_IDS } from "@/lib/bazi/knowledge/topic-types";
import {
  getUnmappedLegacyDimensions,
  mapTopicDraftToDraftAnnotationData,
} from "@/lib/bazi/orchestrator/draft-mapper";
import { DraftAnnotationDataSchema } from "@/lib/bazi/schema-types";

describe("orchestrator draft mapper", () => {
  test("maps a full Step 3 topic draft into the legacy 15-dimension draft payload", () => {
    const draftByTopic = Object.fromEntries(
      BAZI_TOPIC_IDS.map((topicId) => [topicId, `${topicId}:draft`]),
    ) as Record<(typeof BAZI_TOPIC_IDS)[number], string>;

    const result = mapTopicDraftToDraftAnnotationData(draftByTopic);
    const parsed = DraftAnnotationDataSchema.parse(result);

    expect(parsed.dimensions).toHaveLength(15);
    expect(parsed.reviewSummary).toContain("Step 3 chunked orchestrator");
    expect(
      parsed.dimensions.find((dimension) => dimension.dimension_name === "personality_psychology")
        ?.final_prediction,
    ).toBe("personality_baseline:draft");
    expect(
      parsed.dimensions.find((dimension) => dimension.dimension_name === "personality_psychology")
        ?.thought_process,
    ).not.toContain("Generated via Chunked Orchestrator");
  });

  test("merges shared legacy dimensions from multiple topic outputs", () => {
    const draftByTopic = Object.fromEntries(
      BAZI_TOPIC_IDS.map((topicId) => [topicId, `${topicId}:draft`]),
    ) as Record<(typeof BAZI_TOPIC_IDS)[number], string>;

    const result = mapTopicDraftToDraftAnnotationData(draftByTopic);
    const careerDimension = result.dimensions.find(
      (dimension) => dimension.dimension_name === "career_potential",
    );
    const loveDimension = result.dimensions.find(
      (dimension) => dimension.dimension_name === "love_and_family",
    );

    expect(careerDimension?.final_prediction).toContain("suitable_career:draft");
    expect(careerDimension?.final_prediction).toContain("partnerships:draft");
    expect(careerDimension?.supporting_signals).toContain("mapping=shared-legacy-dimension");
    expect(careerDimension?.thought_process).toContain("ต้องผสานทั้งสองหัวข้อ");
    expect(loveDimension?.final_prediction).toContain("family_dynamics:draft");
    expect(loveDimension?.final_prediction).toContain("love_life:draft");
  });

  test("fills unmapped legacy dimensions with explicit proof placeholders instead of dropping them", () => {
    const draftByTopic = Object.fromEntries(
      BAZI_TOPIC_IDS.map((topicId) => [topicId, `${topicId}:draft`]),
    ) as Record<(typeof BAZI_TOPIC_IDS)[number], string>;

    const result = mapTopicDraftToDraftAnnotationData(draftByTopic);
    const annualStarDimension = result.dimensions.find(
      (dimension) => dimension.dimension_name === "annual_star_energy",
    );

    expect(getUnmappedLegacyDimensions()).toEqual([
      "twelve_qi_cycle",
      "annual_star_energy",
      "red_flags",
    ]);
    expect(annualStarDimension?.thought_process).toContain("explicit gap");
    expect(annualStarDimension?.final_prediction).toContain("ยังไม่มี topic ตรงจาก Step 3");
    expect(annualStarDimension?.confidence_note).toBe("awaiting-manual-proof-mapping");
  });
});