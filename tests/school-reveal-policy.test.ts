import { describe, expect, test } from "vitest";

import {
  filterEdgesBySchoolRevealPolicy,
  resolveSchoolRevealPolicyConfig,
} from "@/lib/bazi/school-reveal-policy";
import type { SemanticEdge, SemanticEdgeData } from "@/lib/bazi/semantic-chamber-graph";

function makeEdge(
  partial: Omit<Partial<SemanticEdge>, "data"> & { data?: Partial<SemanticEdgeData> },
): SemanticEdge {
  const partialData = partial.data ?? {};

  return {
    id: partial.id ?? "edge",
    source: partial.source ?? "stem:day",
    target: partial.target ?? "stem:month",
    sourceHandle: partial.sourceHandle,
    targetHandle: partial.targetHandle,
    label: partial.label,
    className: partial.className,
    data: {
      layer: "element-interaction",
      badge: {
        id: partial.id ?? "badge",
        family: "interaction",
        label: "test",
        shortLabel: "test",
        priority: "secondary",
        status: "active",
        tier: "secondary",
        schoolLabel: "เซียงแซ",
        semanticKind: "element-generate",
        doctrineKey: "test",
        meaningShort: "test",
        participants: [],
        modal: {
          title: "test",
          family: "interaction",
          summary: "test",
          explanation: "test",
          details: [],
        },
      } as unknown as SemanticEdgeData["badge"],
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

  test("drops structural guide edges when the structure layer is disabled", () => {
    const edges = [
      makeEdge({ id: "daymaster", data: { layer: "daymaster-meaning" } }),
      makeEdge({ id: "reaction", data: { layer: "inter-pillar-reaction" } }),
    ];

    const filtered = filterEdgesBySchoolRevealPolicy(edges, { showStructure: false, quietGraph: false });

    expect(filtered.map((edge) => edge.id)).toEqual(["reaction"]);
  });

  test("drops energy edges when the energy layer is disabled", () => {
    const edges = [
      makeEdge({ id: "flow", data: { layer: "element-flow" } }),
      makeEdge({ id: "interaction", data: { layer: "element-interaction" } }),
      makeEdge({ id: "reaction", data: { layer: "inter-pillar-reaction" } }),
    ];

    const filtered = filterEdgesBySchoolRevealPolicy(edges, { showEnergy: false, quietGraph: false });

    expect(filtered.map((edge) => edge.id)).toEqual(["reaction"]);
  });

  test("drops reaction edges when the reaction layer is disabled", () => {
    const edges = [
      makeEdge({ id: "reaction", data: { layer: "inter-pillar-reaction" } }),
      makeEdge({ id: "flow", data: { layer: "element-flow" } }),
    ];

    const filtered = filterEdgesBySchoolRevealPolicy(edges, { showReaction: false, quietGraph: false });

    expect(filtered.map((edge) => edge.id)).toEqual(["flow"]);
  });

  test("drops overlay edges when the overlay layer is disabled", () => {
    const edges = [
      makeEdge({ id: "overlay", data: { layer: "shen-sha-overlay" } }),
      makeEdge({ id: "reaction", data: { layer: "inter-pillar-reaction" } }),
    ];

    const filtered = filterEdgesBySchoolRevealPolicy(edges, { showOverlay: false, quietGraph: false });

    expect(filtered.map((edge) => edge.id)).toEqual(["reaction"]);
  });

  test("focused role family keeps only matching element-flow lanes", () => {
    const edges = [
      makeEdge({ id: "output", data: { layer: "element-flow", flowCategory: "output" } }),
      makeEdge({ id: "wealth", data: { layer: "element-flow", flowCategory: "wealth" } }),
      makeEdge({ id: "reaction", data: { layer: "inter-pillar-reaction" } }),
    ];

    const filtered = filterEdgesBySchoolRevealPolicy(edges, {
      quietGraph: false,
      showStructure: false,
      showEnergy: true,
      showReaction: false,
      showOverlay: false,
      focusedRoleFamily: "output",
    });

    expect(filtered.map((edge) => edge.id)).toEqual(["output"]);
  });

  test("normalizes reveal policy defaults before filtering", () => {
    expect(resolveSchoolRevealPolicyConfig({ quietGraph: false })).toEqual({
      quietGraph: false,
      showStructure: true,
      showEnergy: true,
      showReaction: true,
      showOverlay: true,
      focusedRoleFamily: "all",
    });
  });
});
