/**
 * Drift guardrail — artifact ที่ commit ต้องตรงกับ rebuild จาก source เป๊ะ ๆ
 * ถ้าใครแก้ constant/ตาราง/JSON แล้วลืม `npm run build:knowledge-graph` เทสนี้จะ fail
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { buildKnowledgeGraphArtifact } from "../scripts/compile-knowledge-graph";
import { KnowledgeGraphArtifactSchema } from "../src/lib/bazi/knowledge-graph/graph-types";

const COMMITTED_PATH = path.resolve(
  process.cwd(),
  "src/lib/bazi/knowledge-graph/knowledge-graph.json",
);

function stripGeneratedAt<T extends { generatedAt: string }>(artifact: T) {
  const { generatedAt: _ignored, ...rest } = artifact;
  return rest;
}

describe("knowledge-graph drift guardrail", () => {
  test("committed artifact equals a fresh rebuild (run build:knowledge-graph if this fails)", () => {
    const committed = KnowledgeGraphArtifactSchema.parse(
      JSON.parse(readFileSync(COMMITTED_PATH, "utf8")),
    );
    const { artifact: rebuilt } = buildKnowledgeGraphArtifact();

    expect(JSON.stringify(stripGeneratedAt(rebuilt))).toBe(
      JSON.stringify(stripGeneratedAt(committed)),
    );
  });

  test("committed artifact passes schema validation", () => {
    expect(() =>
      KnowledgeGraphArtifactSchema.parse(JSON.parse(readFileSync(COMMITTED_PATH, "utf8"))),
    ).not.toThrow();
  });
});
