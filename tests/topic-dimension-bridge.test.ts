import { describe, expect, test } from "vitest";

import {
  ANNOTATION_DIMENSION_TO_TOPIC_IDS,
  SHARED_ANNOTATION_DIMENSIONS,
  TOPIC_TO_ANNOTATION_DIMENSION,
  UNMAPPED_ANNOTATION_DIMENSIONS,
  getAnnotationDimensionForTopic,
  getTopicIdsForAnnotationDimension,
} from "@/lib/bazi/knowledge/topic-dimension-bridge";
import { BAZI_TOPIC_IDS } from "@/lib/bazi/knowledge/topic-types";
import { REQUIRED_ANNOTATION_DIMENSION_NAMES } from "@/lib/bazi/schema-types";

describe("topic dimension bridge", () => {
  test("maps every step-3 topic id onto a valid legacy annotation dimension", () => {
    expect(Object.keys(TOPIC_TO_ANNOTATION_DIMENSION)).toEqual(BAZI_TOPIC_IDS);

    for (const topicId of BAZI_TOPIC_IDS) {
      expect(REQUIRED_ANNOTATION_DIMENSION_NAMES).toContain(
        getAnnotationDimensionForTopic(topicId),
      );
    }
  });

  test("documents the current schema drift without mutating legacy proof dimensions", () => {
    expect(UNMAPPED_ANNOTATION_DIMENSIONS).toEqual([
      "twelve_qi_cycle",
      "annual_star_energy",
      "red_flags",
    ]);

    expect(SHARED_ANNOTATION_DIMENSIONS).toEqual([
      "pillar_relations",
      "career_potential",
      "love_and_family",
    ]);

    expect(getTopicIdsForAnnotationDimension("career_potential")).toEqual([
      "suitable_career",
      "partnerships",
    ]);
    expect(getTopicIdsForAnnotationDimension("love_and_family")).toEqual([
      "family_dynamics",
      "love_life",
    ]);
    expect(getTopicIdsForAnnotationDimension("pillar_relations")).toEqual([
      "allies_and_rivals",
      "subordinates",
    ]);
  });

  test("keeps reverse lookup complete for all legacy annotation dimensions", () => {
    expect(Object.keys(ANNOTATION_DIMENSION_TO_TOPIC_IDS)).toEqual(
      REQUIRED_ANNOTATION_DIMENSION_NAMES,
    );
    expect(getTopicIdsForAnnotationDimension("chart_foundation")).toEqual([
      "patrons_support",
    ]);
    expect(getTopicIdsForAnnotationDimension("twelve_qi_cycle")).toEqual([]);
  });
});