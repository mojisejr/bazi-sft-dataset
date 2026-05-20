import { describe, expect, test } from "vitest";

import {
  BAZI_TOPIC_REGISTRY,
  BAZI_TOPIC_REGISTRY_BY_ID,
  getBaziTopicDefinition,
} from "@/lib/bazi/knowledge/topic-registry";
import { BAZI_TOPIC_IDS } from "@/lib/bazi/knowledge/topic-types";

describe("bazi topic registry", () => {
  test("defines all 15 phase-1 topics exactly once", () => {
    expect(BAZI_TOPIC_REGISTRY).toHaveLength(15);
    expect(BAZI_TOPIC_REGISTRY.map((entry) => entry.id)).toEqual(BAZI_TOPIC_IDS);
    expect(new Set(BAZI_TOPIC_REGISTRY.map((entry) => entry.sequence)).size).toBe(15);
  });

  test("keeps every topic grounded in engine deps and source refs", () => {
    for (const topic of BAZI_TOPIC_REGISTRY) {
      expect(topic.engineDependencies.length).toBeGreaterThan(0);
      expect(topic.sinsaeLogicRules.length).toBeGreaterThan(0);
      expect(topic.sourceRefs[0]?.primarySource.length).toBeGreaterThan(0);
      expect(topic.sourceRefs[0]?.reasoningFocus.length).toBeGreaterThan(0);
    }
  });

  test("supports deterministic lookup by topic id", () => {
    expect(getBaziTopicDefinition("wealth_luck")).toBe(
      BAZI_TOPIC_REGISTRY_BY_ID.wealth_luck,
    );
    expect(getBaziTopicDefinition("major_luck_cycles").chunkGroup).toBe("life_path");
  });
});