import { describe, expect, test } from "vitest";

import { filterEdgesBySchoolRevealPolicy } from "@/lib/bazi/school-reveal-policy";
import type { SemanticEdge } from "@/lib/bazi/semantic-chamber-graph";

function makeEdge(partial: Partial<SemanticEdge>): SemanticEdge {
  const partialData = partial.data ?? {};

  return {
    id: partial.id ?? "edge",
    source: partial.source ?? "stem:day",
    target: partial.target ?? "stem:month",
    data: {
      layer: "element-interaction",
      badge: {
        id: partial.id ?? "badge",
        label: "test",
        shortLabel: "test",
        priority: "secondary",
        status: "active",
        tier: "secondary",
        schoolLabel: "เซียงแซ",
        semanticKind: "element-generate",
        doctrineKey: "test",
        participants: [],
        modal: {
          title: "test",
          family: "interaction",
          summary: "test",
          explanation: "test",
          details: [],
        },
      } as SemanticEdge["data"]["badge"],
      readingOrder: 1,
      schoolCluster: null,
      flowCycleType: "generating",
      flowDirection: "outward",
      ...partialData,
    },
    ...partial,
    data: {
      layer: "element-interaction",
      badge: {
        id: partial.id ?? "badge",
        label: "test",
        shortLabel: "test",
        priority: "secondary",
        status: "active",
        tier: "secondary",
        schoolLabel: "เซียงแซ",
        semanticKind: "element-generate",
        doctrineKey: "test",
        participants: [],
        modal: {
          title: "test",
          family: "interaction",
          summary: "test",
          explanation: "test",
          details: [],
        },
      } as SemanticEdge["data"]["badge"],
      readingOrder: 1,
      schoolCluster: null,
      flowCycleType: "generating",
      flowDirection: "outward",
      ...partialData,
    },
  };
}

describe("filterEdgesBySchoolRevealPolicy", () => {
  test("keeps tong-gen same-pillar generating edges", () => {
    const edges = [
      makeEdge({ id: "tong-gen", source: "branch:hour", target: "stem:hour", data: { flowCycleType: "generating" } }),
    ];

    expect(filterEdgesBySchoolRevealPolicy(edges)).toHaveLength(1);
  });

  test("drops non-adjacent controlling edges but keeps non-adjacent generating flow", () => {
    const edges = [
      makeEdge({ id: "control", source: "branch:hour", target: "stem:year", data: { flowCycleType: "controlling", badge: { semanticKind: "element-control" } as SemanticEdge["data"]["badge"] } }),
      makeEdge({ id: "generate", source: "branch:day", target: "stem:month", data: { flowCycleType: "generating" } }),
    ];

    const filtered = filterEdgesBySchoolRevealPolicy(edges);
    expect(filtered.map((edge) => edge.id)).toEqual(["generate"]);
  });
});
