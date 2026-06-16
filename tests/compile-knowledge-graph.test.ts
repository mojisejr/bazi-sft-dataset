import { describe, expect, test } from "vitest";

import { buildKnowledgeGraphArtifact } from "../scripts/compile-knowledge-graph";
import * as pairMatching from "../src/lib/bazi/pair-matching";
import * as domainPower from "../src/lib/bazi/symbolic-engine.domain-power";

const { artifact, stats } = buildKnowledgeGraphArtifact();
const nodeIds = new Set(artifact.nodes.map((node) => node.id));

const RESOLVER_MODULES: Record<string, Record<string, unknown>> = {
  computePairMatch: pairMatching,
  computeCareerPower: domainPower,
  computeLearningPower: domainPower,
  computeFriendsPower: domainPower,
  computeWealthPower: domainPower,
};

describe("compile-knowledge-graph", () => {
  test("artifact counts are self-consistent", () => {
    expect(artifact.version).toBe("1.0.0");
    expect(artifact.nodeCount).toBe(artifact.nodes.length);
    expect(artifact.edgeCount).toBe(artifact.edges.length);
    expect(artifact.edgeProviderCount).toBe(artifact.edgeProviders.length);
    expect(artifact.nodes.length).toBeGreaterThan(0);
    expect(artifact.edges.length).toBeGreaterThan(0);
  });

  test("no edge is dropped during derivation (every endpoint resolves)", () => {
    expect(stats.droppedEdges).toBe(0);
    for (const edge of artifact.edges) {
      expect(nodeIds.has(edge.source), `missing source ${edge.source}`).toBe(true);
      expect(nodeIds.has(edge.target), `missing target ${edge.target}`).toBe(true);
    }
  });

  test("every edge carries a provenance ref + source", () => {
    for (const edge of artifact.edges) {
      expect(edge.provenance.ref.length).toBeGreaterThan(0);
      expect(edge.provenance.sourceTable.length).toBeGreaterThan(0);
      expect(edge.provenance.sourceFile.length).toBeGreaterThan(0);
    }
  });

  test("node ids are unique", () => {
    expect(nodeIds.size).toBe(artifact.nodes.length);
  });

  test("core relation families are present", () => {
    const disciplines = new Set(artifact.edges.map((edge) => edge.discipline));
    for (const family of ["element", "ten-god", "interaction", "hidden-stem"]) {
      expect(disciplines.has(family), `missing family ${family}`).toBe(true);
    }
    // สิบเทพ: 10×10 ก้านครบ
    expect(artifact.edges.filter((edge) => edge.discipline === "ten-god")).toHaveLength(100);
  });

  test("cross-discipline meaning edges exist for flagship topics", () => {
    const disciplines = new Set(artifact.edges.map((edge) => edge.discipline));
    for (const topic of ["career", "wealth", "health", "learning"]) {
      expect(disciplines.has(topic), `missing discipline ${topic}`).toBe(true);
    }
  });

  test("lazy edge providers reference real resolver functions", () => {
    expect(artifact.edgeProviders.length).toBeGreaterThan(0);
    for (const provider of artifact.edgeProviders) {
      const mod = RESOLVER_MODULES[provider.resolverFn];
      expect(mod, `unknown resolver module for ${provider.resolverFn}`).toBeDefined();
      expect(typeof mod[provider.resolverFn], `${provider.resolverFn} not a function`).toBe(
        "function",
      );
    }
  });
});
