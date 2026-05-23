import { describe, expect, test } from "vitest";

import { BAZI_TOPIC_IDS } from "@/lib/bazi/knowledge/topic-types";
import {
  composeProofDimensions,
  getUnmappedLegacyDimensions,
} from "@/lib/bazi/orchestrator/proof-dimension-composer";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { REQUIRED_ANNOTATION_DIMENSION_NAMES } from "@/lib/bazi/schema-types";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

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

  test("writes proof-facing reasoning for direct, shared, and unmapped dimensions", async () => {
    const draftByTopic = Object.fromEntries(
      BAZI_TOPIC_IDS.map((topicId) => [topicId, `${topicId}:draft`]),
    );
    const calculatedState = await calculateBaziChart(
      {
        birthDate: "1992-08-21",
        birthTime: "14:35",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Hong_Kong",
      },
      createTestKnowledgeRepository(),
    );

    const result = composeProofDimensions({ draftByTopic, calculatedState });
    const personalityDimension = result.dimensions.find(
      (dimension) => dimension.dimension_name === "personality_psychology",
    );
    const careerDimension = result.dimensions.find(
      (dimension) => dimension.dimension_name === "career_potential",
    );
    const annualStarDimension = result.dimensions.find(
      (dimension) => dimension.dimension_name === "annual_star_energy",
    );

    expect(personalityDimension?.thought_process).toContain("ยึดดิถี");
    expect(personalityDimension?.thought_process).toContain("นิสัย/บุคลิกพื้นฐาน");
    expect(personalityDimension?.thought_process).toContain("personality_baseline:draft");
    expect(personalityDimension?.thought_process).not.toContain("Generated via Chunked Orchestrator");

    expect(careerDimension?.thought_process).toContain("อาชีพที่เหมาะสม");
    expect(careerDimension?.thought_process).toContain("หุ้นส่วน");
    expect(careerDimension?.thought_process).toContain("ต้องผสานทั้งสองหัวข้อ");
    expect(careerDimension?.thought_process).not.toContain("Mapped from Step 3 topics");

    expect(annualStarDimension?.thought_process).toContain("ยังไม่มีหัวข้อ Step 3");
    expect(annualStarDimension?.thought_process).toContain("explicit gap");
    expect(annualStarDimension?.thought_process).not.toContain("Generated via Chunked Orchestrator");
  });
});