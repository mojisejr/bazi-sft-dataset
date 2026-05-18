import { existsSync } from "node:fs";

import { describe, expect, test } from "vitest";

import {
  getHybridRetrievalRegistryEntry,
  HYBRID_RETRIEVAL_REGISTRY,
} from "@/lib/bazi/hybrid-retrieval-registry";
import { resolveAllDistilledFile } from "@/lib/bazi/hybrid-retrieval";
import { REQUIRED_ANNOTATION_DIMENSION_NAMES } from "@/lib/bazi/schema-types";

describe("hybrid retrieval registry", () => {
  test("covers all 15 required annotation dimensions", () => {
    expect(Object.keys(HYBRID_RETRIEVAL_REGISTRY).sort()).toEqual(
      [...REQUIRED_ANNOTATION_DIMENSION_NAMES].sort(),
    );
  });

  test("keeps the plan-aligned tier strategy for direct, merge, and fallback dimensions", () => {
    expect(getHybridRetrievalRegistryEntry("personality_psychology")).toEqual(
      expect.objectContaining({
        tier: "TierA",
        strategy: "dictionary-first",
        fallbackRequired: false,
      }),
    );

    expect(getHybridRetrievalRegistryEntry("chart_foundation")).toEqual(
      expect.objectContaining({
        tier: "TierB",
        strategy: "folder-merge",
        fallbackRequired: true,
      }),
    );

    expect(getHybridRetrievalRegistryEntry("ten_gods_reaction")).toEqual(
      expect.objectContaining({
        tier: "TierC",
        strategy: "ai-fallback",
        fallbackRequired: true,
      }),
    );
  });

  test("binds all configured source files back to the real all_distilled corpus", () => {
    const sourcePaths = Object.values(HYBRID_RETRIEVAL_REGISTRY)
      .flatMap((entry) => entry.sourceRelativePaths)
      .filter((value, index, collection) => collection.indexOf(value) === index);

    expect(sourcePaths.length).toBeGreaterThan(0);
    expect(sourcePaths.every((relativePath) => existsSync(resolveAllDistilledFile(relativePath)))).toBe(true);
  });
});
