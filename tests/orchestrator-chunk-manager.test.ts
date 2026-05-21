import { describe, expect, test } from "vitest";

import { BAZI_TOPIC_REGISTRY } from "@/lib/bazi/knowledge/topic-registry";
import {
  BAZI_TOPIC_CHUNKS,
  FullTopicDraftSchema,
  getChunkForTopic,
  getTopicChunk,
  getTopicChunkDraftSchema,
} from "@/lib/bazi/orchestrator/chunk-manager";

describe("orchestrator chunk manager", () => {
  test("covers all 15 topics exactly once in stable semantic chunks", () => {
    const flattenedTopicIds = BAZI_TOPIC_CHUNKS.flatMap((chunk) => chunk.topicIds);
    const registryTopicIds = BAZI_TOPIC_REGISTRY.map((topic) => topic.id);

    expect(BAZI_TOPIC_CHUNKS.map((chunk) => chunk.id)).toEqual([
      "core_profile",
      "life_path",
      "relationships",
      "wellbeing_balance",
    ]);
    expect([...flattenedTopicIds].sort()).toEqual([...registryTopicIds].sort());
    expect(new Set(flattenedTopicIds).size).toBe(BAZI_TOPIC_REGISTRY.length);
    expect(getTopicChunk("life_path").topicIds).toEqual([
      "suitable_career",
      "wealth_luck",
      "solo_vs_teamwork",
      "study_path",
      "major_luck_cycles",
    ]);
  });

  test("returns the owning chunk for any topic id", () => {
    expect(getChunkForTopic("love_life")?.id).toBe("relationships");
    expect(getChunkForTopic("fortune_enhancement")?.id).toBe("wellbeing_balance");
    expect(getChunkForTopic("patrons_support")?.id).toBe("core_profile");
  });

  test("builds strict draft schemas for chunk payloads and the full 15-topic object", () => {
    const lifePathSchema = getTopicChunkDraftSchema("life_path");

    expect(
      lifePathSchema.parse({
        suitable_career: "career",
        wealth_luck: "wealth",
        solo_vs_teamwork: "solo vs team",
        study_path: "study",
        major_luck_cycles: "cycles",
      }),
    ).toMatchObject({
      suitable_career: "career",
      major_luck_cycles: "cycles",
    });

    expect(() =>
      lifePathSchema.parse({
        suitable_career: "career",
        wealth_luck: "wealth",
        solo_vs_teamwork: "solo vs team",
        study_path: "study",
      }),
    ).toThrow();

    expect(() =>
      lifePathSchema.parse({
        suitable_career: "career",
        wealth_luck: "wealth",
        solo_vs_teamwork: "solo vs team",
        study_path: "study",
        major_luck_cycles: "cycles",
        extra: "noise",
      }),
    ).toThrow();

    expect(
      FullTopicDraftSchema.parse(
        Object.fromEntries(
          BAZI_TOPIC_REGISTRY.map((topic) => [topic.id, `${topic.sequence}:${topic.thaiLabel}`]),
        ),
      ),
    ).toBeTruthy();
  });
});