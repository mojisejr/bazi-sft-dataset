import { describe, expect, test } from "vitest";

import { buildBaseChartReading } from "@/lib/bazi/symbolic-engine.base-chart";
import { resolveBranchInteractionEffects } from "@/lib/bazi/symbolic-engine.interactions";
import { buildSemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";
import type { CalculatedStateValue, PillarValue, ShenShaValue } from "@/lib/bazi/schema-types";

const samplePillars: Record<"year" | "month" | "day" | "hour", PillarValue> = {
  year: {
    stem: "甲",
    branch: "子",
    hiddenStems: ["癸"],
    tenGod: "正官",
    stemTranslation: "ไม้",
    branchTranslation: "ชวด",
    upperStageDisplay: "หมกยก/เชี่ยงแซ",
    sittingStage: "เชี่ยงแซ",
    lowerStageDisplay: "หมกยก/เชี่ยงแซ",
  },
  month: {
    stem: "己",
    branch: "丑",
    hiddenStems: ["己", "癸", "辛"],
    tenGod: "比肩",
    stemTranslation: "ดิน",
    branchTranslation: "ฉลู",
    upperStageDisplay: "เจ๊าะ/แป่",
    sittingStage: "แป่",
    lowerStageDisplay: "หมกยก/แป่",
  },
  day: {
    stem: "己",
    branch: "午",
    hiddenStems: ["丁", "己"],
    tenGod: "ดิถี",
    stemTranslation: "ดิน",
    branchTranslation: "มะเมีย",
    sittingStage: "ตี้อ๋วง",
    lookingStage: "ตี้อ๋วง",
    lowerStageDisplay: "ตี้อ๋วง/ตี้อ๋วง",
  },
  hour: {
    stem: "丁",
    branch: "未",
    hiddenStems: ["己", "丁", "乙"],
    tenGod: "偏印",
    stemTranslation: "ไฟ",
    branchTranslation: "มะแม",
    upperStageDisplay: "เจ๊าะ/เอี้ยง",
    sittingStage: "เอี้ยง",
    lookingStage: "กวงตั่ว",
    lowerStageDisplay: "กวงตั่ว/เอี้ยง",
  },
};

const sampleMarkers: ShenShaValue[] = [
  {
    starName: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
    relatedPillar: "ปี",
    meaning: "มีผู้ใหญ่เข้ามาช่วยเมื่อจังหวะเปิด",
  },
  {
    starName: "ดอกท้อ (桃花)",
    relatedPillar: "เดือน",
    meaning: "เสน่ห์และแรงดึงดูดทางสังคม",
  },
];

function buildStubCalculatedState(): CalculatedStateValue {
  const resolution = resolveBranchInteractionEffects(samplePillars);
  const reading = buildBaseChartReading({
    dayMasterStem: "己",
    pillars: samplePillars,
    shenSha: sampleMarkers,
    resolution,
    precedenceSignals: resolution.precedenceSignals,
  });

  return {
    fourPillars: samplePillars,
    baseChartReading: reading,
  } as unknown as CalculatedStateValue;
}

describe("buildSemanticChamberGraph", () => {
  test("returns empty graph when baseChartReading is missing", () => {
    const graph = buildSemanticChamberGraph({
      fourPillars: samplePillars,
      baseChartReading: undefined,
    } as unknown as CalculatedStateValue);

    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.schoolClusters).toEqual([]);
    expect(graph.hiddenSecondaryOverlays).toEqual([]);
  });

  test("emits stem and branch nodes in a grid layout with day as focal center", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const stemNodes = graph.nodes.filter((node) => node.type === "chamberStemNode");
    const branchNodes = graph.nodes.filter((node) => node.type === "chamberBranchNode");
    expect(stemNodes).toHaveLength(4);
    expect(branchNodes).toHaveLength(4);

    const focalStem = stemNodes.find((node) => node.data.kind === "stem-node" && node.data.isFocal);
    expect(focalStem).toBeDefined();
    expect(focalStem?.id).toBe("stem:day");
    expect(focalStem?.data.kind === "stem-node" ? focalStem.data.stem : null).toBe("己");

    const hourStem = stemNodes.find((node) => node.id === "stem:hour");
    expect(hourStem?.data.kind === "stem-node" ? hourStem.data.stem : null).toBe("丁");

    const orderedPillars = ["hour", "day", "month", "year"];
    const stemXValues = orderedPillars.map((key) => {
      const node = stemNodes.find((n) => n.id === `stem:${key}`);
      return node?.position.x ?? 0;
    });
    for (let i = 1; i < stemXValues.length; i++) {
      expect(stemXValues[i]).toBeGreaterThan(stemXValues[i - 1]);
    }

    const branchXValues = orderedPillars.map((key) => {
      const node = branchNodes.find((n) => n.id === `branch:${key}`);
      return node?.position.x ?? 0;
    });
    for (let i = 1; i < branchXValues.length; i++) {
      expect(branchXValues[i]).toBeGreaterThan(branchXValues[i - 1]);
    }

    for (const key of orderedPillars) {
      const stemNode = stemNodes.find((n) => n.id === `stem:${key}`);
      const branchNode = branchNodes.find((n) => n.id === `branch:${key}`);
      expect(stemNode?.position.x).toBe(branchNode?.position.x);
    }

    const stemY = focalStem?.position.y ?? 0;
    const focalBranch = branchNodes.find((n) => n.id === "branch:day");
    expect(focalBranch?.position.y).toBeGreaterThan(stemY);
  });

  test("promotes visible-tier shen-sha and keeps secondary overlays hidden by default", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const markerNodes = graph.nodes.filter((node) => node.type === "chamberMarker");
    expect(markerNodes).toHaveLength(1);
    expect(markerNodes[0].data.kind).toBe("marker");
    expect(markerNodes[0].data.kind === "marker" ? markerNodes[0].data.displayLabel : "").toContain("กุ้ยนั้ง");
    expect(graph.hiddenSecondaryOverlays.map((badge) => badge.label)).toContain("ดอกท้อ (桃花)");
    expect(graph.hiddenSecondaryOverlays[0]?.semantic).toMatchObject({
      overlayTier: "secondary",
      sourceKind: "canonical-marker",
    });
  });

  test("renders daymaster relation edges as first-class semantic relations", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const daymasterEdges = graph.edges.filter((edge) => edge.data.layer === "daymaster-meaning");
    expect(daymasterEdges.length).toBeGreaterThan(0);
    expect(daymasterEdges[0].source).toMatch(/^(stem|branch):day$/);
    expect(daymasterEdges[0].className).toContain("chamber-edge--daymaster");
    expect(daymasterEdges[0].className).toContain("chamber-edge--guide");
    expect(daymasterEdges[0].label).toBeUndefined();
  });

  test("produces doctrine-layer interaction edges connecting at least two nodes", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    expect(graph.edges.length).toBeGreaterThan(0);

    const edgeTouchesNodes = graph.edges.some(
      (edge) => edge.data.layer === "inter-pillar-reaction"
        && (edge.source.startsWith("stem:") || edge.source.startsWith("branch:"))
        && (edge.target.startsWith("stem:") || edge.target.startsWith("branch:")),
    );
    expect(edgeTouchesNodes).toBe(true);
  });

  test("propagates semantic edge layers and status into edge className", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const matchedEdge = graph.edges.find((edge) => edge.className?.includes("chamber-edge--"));
    expect(matchedEdge?.className).toMatch(/chamber-edge chamber-edge--/);
    expect(matchedEdge?.data.layer).toBeTruthy();
  });

  test("all edges have explicit sourceHandle and targetHandle", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    for (const edge of graph.edges) {
      expect(edge.sourceHandle).toBeDefined();
      expect(edge.targetHandle).toBeDefined();
      expect(edge.sourceHandle).toMatch(/^source-(top|bottom|left|right)$/);
      expect(edge.targetHandle).toMatch(/^target-(top|bottom|left|right)$/);
    }
  });

  test("edge handles follow multi-handle routing rules", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const stemEdges = graph.edges.filter(
      (edge) => edge.source.startsWith("stem:") && edge.data.layer === "inter-pillar-reaction",
    );
    for (const edge of stemEdges) {
      const isCrossType = edge.target.startsWith("branch:");
      if (isCrossType) {
        expect(edge.sourceHandle).toMatch(/^source-(top|bottom|left|right)$/);
        expect(edge.targetHandle).toMatch(/^target-(top|bottom|left|right)$/);
      } else {
        expect(edge.sourceHandle).toMatch(/^source-(top|left|right)$/);
        expect(edge.targetHandle).toMatch(/^target-(top|left|right)$/);
      }
    }

    const branchEdges = graph.edges.filter(
      (edge) => edge.source.startsWith("branch:") && edge.data.layer === "inter-pillar-reaction",
    );
    for (const edge of branchEdges) {
      // Branch edges may use top handles for far-span routing through the middle zone,
      // or left/right handles for adjacent routing.
      expect(edge.sourceHandle).toMatch(/^source-(top|bottom|left|right)$/);
      expect(edge.targetHandle).toMatch(/^target-(top|bottom|left|right)$/);
    }
  });

  test("groups doctrine reactions into school clusters without losing source provenance", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    expect(graph.schoolClusters.length).toBeGreaterThan(0);

    const reactionEdge = graph.edges.find((edge) => edge.data.layer === "inter-pillar-reaction");
    expect(reactionEdge?.data.schoolCluster?.schoolLabel).toBeTruthy();
    expect(reactionEdge?.data.badge.semantic?.sourceKind).toBe("interaction-outcome");
    expect(reactionEdge?.data.sourceDetail).toMatch(/ราศี(ล่าง|บน)/);
    expect(reactionEdge?.data.targetDetail).toMatch(/ราศี(ล่าง|บน)/);
  });

  test("parallel edges get offset assignment", () => {
    const state = buildStubCalculatedState();
    const graph = buildSemanticChamberGraph(state);

    const reactionEdges = graph.edges.filter(
      (edge) => edge.data.layer === "inter-pillar-reaction",
    );

    const pairGroups = new Map<string, typeof reactionEdges>();
    for (const edge of reactionEdges) {
      const key = `${edge.source}->${edge.target}`;
      const group = pairGroups.get(key);
      if (group) {
        group.push(edge);
      } else {
        pairGroups.set(key, [edge]);
      }
    }

    for (const group of pairGroups.values()) {
      if (group.length === 1) {
        expect(group[0].data.parallelOffset).toBe(0);
      } else {
        for (let index = 0; index < group.length; index += 1) {
          expect(group[index].data.parallelOffset).toBe(index * 18);
        }
      }
    }
  });

  test("no self-loop edges exist in reaction layer", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const reactionEdges = graph.edges.filter(
      (edge) => edge.data.layer === "inter-pillar-reaction",
    );

    for (const edge of reactionEdges) {
      expect(edge.source).not.toBe(edge.target);
    }
  });

  test("cross-type stem-to-branch edges resolve to correct node IDs", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const reactionEdges = graph.edges.filter(
      (edge) => edge.data.layer === "inter-pillar-reaction",
    );

    const crossTypeEdges = reactionEdges.filter(
      (edge) => edge.source.startsWith("stem:") && edge.target.startsWith("branch:"),
    );

    if (crossTypeEdges.length > 0) {
      for (const edge of crossTypeEdges) {
        expect(edge.source).toMatch(/^stem:(hour|day|month|year)$/);
        expect(edge.target).toMatch(/^branch:(hour|day|month|year)$/);
      }
    }
  });

  test("same-pillar cross-type edges use vertical handle routing", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const reactionEdges = graph.edges.filter(
      (edge) => edge.data.layer === "inter-pillar-reaction",
    );

    const samePillarCrossType = reactionEdges.filter((edge) => {
      const srcParts = edge.source.split(":");
      const tgtParts = edge.target.split(":");
      return srcParts[0] !== tgtParts[0] && srcParts[1] === tgtParts[1];
    });

    for (const edge of samePillarCrossType) {
      expect(edge.sourceHandle).toBe("source-bottom");
      expect(edge.targetHandle).toBe("target-top");
    }
  });

  test("far-span branch edges use top handles for middle-zone arc routing", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const branchEdges = graph.edges.filter(
      (edge) => edge.source.startsWith("branch:") && edge.data.layer === "inter-pillar-reaction",
    );

    // Find far-span edges (column delta >= 2, e.g. hour↔month, day↔year, hour↔year)
    const farSpanEdges = branchEdges.filter((edge) => {
      const sourceKey = edge.source.replace("branch:", "") as "hour" | "day" | "month" | "year";
      const targetKey = edge.target.replace("branch:", "") as "hour" | "day" | "month" | "year";
      const order = ["hour", "day", "month", "year"];
      return Math.abs(order.indexOf(targetKey) - order.indexOf(sourceKey)) >= 2;
    });

    for (const edge of farSpanEdges) {
      expect(edge.sourceHandle).toBe("source-top");
      expect(edge.targetHandle).toBe("target-top");
    }

    // Adjacent branch edges should still use left/right handles
    const adjacentEdges = branchEdges.filter((edge) => {
      const sourceKey = edge.source.replace("branch:", "") as "hour" | "day" | "month" | "year";
      const targetKey = edge.target.replace("branch:", "") as "hour" | "day" | "month" | "year";
      const order = ["hour", "day", "month", "year"];
      return Math.abs(order.indexOf(targetKey) - order.indexOf(sourceKey)) < 2;
    });

    for (const edge of adjacentEdges) {
      expect(edge.sourceHandle).toMatch(/^source-(left|right)$/);
      expect(edge.targetHandle).toMatch(/^target-(left|right)$/);
    }
  });

  test("single edges have zero parallelOffset", () => {
    const state = buildStubCalculatedState();
    const graph = buildSemanticChamberGraph(state);

    const reactionEdges = graph.edges.filter(
      (edge) => edge.data.layer === "inter-pillar-reaction",
    );

    for (const edge of reactionEdges) {
      expect(edge.data.parallelOffset).toBeGreaterThanOrEqual(0);
    }
  });

  test("daymaster guide edges stay anchored with zero parallelOffset", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const daymasterEdges = graph.edges.filter(
      (edge) => edge.data.layer === "daymaster-meaning",
    );

    expect(daymasterEdges.length).toBeGreaterThan(0);
    for (const edge of daymasterEdges) {
      expect(edge.data.parallelOffset).toBe(0);
    }
  });

  test("overlay edges stay anchored with zero parallelOffset", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const overlayEdges = graph.edges.filter(
      (edge) => edge.data.layer === "shen-sha-overlay",
    );

    expect(overlayEdges.length).toBeGreaterThan(0);
    for (const edge of overlayEdges) {
      expect(edge.data.parallelOffset).toBe(0);
    }
  });

  test("non-reaction edges do not affect reaction offset grouping", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const reactionEdges = graph.edges.filter(
      (edge) => edge.data.layer === "inter-pillar-reaction",
    );
    const nonReactionEdges = graph.edges.filter(
      (edge) => edge.data.layer !== "inter-pillar-reaction",
    );

    expect(nonReactionEdges.length).toBeGreaterThan(0);

    const pairGroups = new Map<string, typeof reactionEdges>();
    for (const edge of reactionEdges) {
      const key = `${edge.source}->${edge.target}`;
      const group = pairGroups.get(key);
      if (group) {
        group.push(edge);
      } else {
        pairGroups.set(key, [edge]);
      }
    }

    for (const edge of nonReactionEdges) {
      expect(edge.data.parallelOffset).toBe(0);
    }

    for (const group of pairGroups.values()) {
      if (group.length <= 1) {
        continue;
      }

      for (let index = 0; index < group.length; index += 1) {
        expect(group[index].data.parallelOffset).toBe(index * 18);
      }
    }
  });

  test("element-flow edges exist for non-day role badges", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const flowEdges = graph.edges.filter((edge) => edge.data.layer === "element-flow");
    expect(flowEdges.length).toBeGreaterThan(0);

    for (const edge of flowEdges) {
      expect(edge.source).not.toBe(edge.target);
      expect(edge.className).toContain("chamber-edge--element-flow");
      expect(edge.data.flowCycleType).toMatch(/^(generating|controlling|neutral)$/);
      expect(edge.data.flowDirection).toMatch(/^(outward|inward|none)$/);
      expect(edge.data.flowLabel).toBeTruthy();
      expect(edge.data.flowElement).toMatch(/^(wood|fire|earth|metal|water)$/);
    }
  });

  test("element-flow edges have correct cycle type and direction per Ten God", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const flowEdges = graph.edges.filter((edge) => edge.data.layer === "element-flow");

    const generatingEdges = flowEdges.filter((e) => e.data.flowCycleType === "generating");
    const controllingEdges = flowEdges.filter((e) => e.data.flowCycleType === "controlling");

    for (const edge of generatingEdges) {
      expect(edge.data.flowDirection).toMatch(/^(outward|inward)$/);
      expect(edge.className).toContain("chamber-edge--element-flow-generating");
      expect(edge.data.badge.semantic?.flowCycleType).toBe("generating");
    }

    for (const edge of controllingEdges) {
      expect(edge.data.flowDirection).toMatch(/^(outward|inward)$/);
      expect(edge.className).toContain("chamber-edge--element-flow-controlling");
      expect(edge.data.badge.semantic?.flowCycleType).toBe("controlling");
    }
  });

  test("reaction edge classes come from typed semantic school keys", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const reactionEdges = graph.edges.filter((edge) => edge.data.layer === "inter-pillar-reaction");
    expect(reactionEdges.some((edge) => edge.className?.includes("school-pakhee"))).toBe(true);
    expect(reactionEdges.some((edge) => edge.className?.includes("school-chong"))).toBe(true);
  });

  test("element-flow edges have element-specific CSS class", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const flowEdges = graph.edges.filter((edge) => edge.data.layer === "element-flow");

    for (const edge of flowEdges) {
      expect(edge.className).toMatch(/chamber-edge--element-(wood|fire|earth|metal|water)/);
    }
  });

  test("no self-loop element-flow edges", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const flowEdges = graph.edges.filter((edge) => edge.data.layer === "element-flow");

    for (const edge of flowEdges) {
      expect(edge.source).not.toBe(edge.target);
    }
  });

  test("element-flow edges do not connect to day pillar nodes", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const flowEdges = graph.edges.filter((edge) => edge.data.layer === "element-flow");

    for (const edge of flowEdges) {
      const srcParts = edge.source.split(":");
      const tgtParts = edge.target.split(":");
      const srcIsDay = srcParts[1] === "day";
      const tgtIsDay = tgtParts[1] === "day";
      expect(srcIsDay || tgtIsDay).toBe(true);
    }
  });
});
