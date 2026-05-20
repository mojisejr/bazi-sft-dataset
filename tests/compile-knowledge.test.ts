import { describe, expect, test } from "vitest";

import { buildCompiledKnowledgeArtifact } from "../scripts/compile-knowledge";

describe("compile-knowledge", () => {
  test("builds compiled topic knowledge from the distilled corpus", () => {
    const artifact = buildCompiledKnowledgeArtifact();

    expect(artifact.topicCount).toBe(15);
    expect(artifact.topics).toHaveLength(15);

    for (const topic of artifact.topics) {
      expect(topic.sourceBundles.length).toBeGreaterThan(0);
      for (const bundle of topic.sourceBundles) {
        expect(bundle.documents.length).toBeGreaterThan(0);
        expect(bundle.combinedNormalizedContent.length).toBeGreaterThan(0);
      }
    }
  }, 20_000);

  test("resolves the partnership supporting source bundle despite corpus indirection", () => {
    const artifact = buildCompiledKnowledgeArtifact();
    const partnerships = artifact.topics.find((topic) => topic.id === "partnerships");

    expect(partnerships).toBeDefined();
    expect(
      partnerships?.sourceBundles.some((bundle) =>
        bundle.documents.some((document) => document.relativePath.includes("คู่สมพงษ์(การงาน)")),
      ),
    ).toBe(true);
  }, 20_000);
});