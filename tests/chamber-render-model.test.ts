import { describe, expect, test } from "vitest";

import { buildBaseChartReading } from "@/lib/bazi/symbolic-engine.base-chart";
import { buildGeneralizedInteractionState, resolveBranchInteractionEffects } from "@/lib/bazi/symbolic-engine.interactions";
import { assignChamberGraphLayout } from "@/lib/bazi/chamber-layout";
import { buildChamberSelectionState } from "@/lib/bazi/chamber-selection-grammar";
import { resolveChamberRelationBundle } from "@/lib/bazi/chamber-relation-bundle";
import { buildSemanticChamberGraph, resolveSemanticEdgeBadgeContract, type SemanticEdge } from "@/lib/bazi/semantic-chamber-graph";
import { buildChamberRenderModel } from "@/components/bazi/reaction-chamber/chamber-render-model";
import { CHAMBER_NODE_TYPES } from "@/components/bazi/reaction-chamber/ReactionChamberCanvas";
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
  const interactionState = buildGeneralizedInteractionState({
    pillars: samplePillars,
    dayMasterStem: "己",
    twelveQiByBranch: {
      year: "长生",
      month: "病",
      day: "帝旺",
      hour: "养",
    },
    resolution,
  });
  const reading = buildBaseChartReading({
    dayMasterStem: "己",
    pillars: samplePillars,
    shenSha: sampleMarkers,
    resolution,
    precedenceSignals: resolution.precedenceSignals,
    interactionState,
  });

  return {
    fourPillars: samplePillars,
    interactionState,
    baseChartReading: reading,
  } as unknown as CalculatedStateValue;
}

describe("buildChamberRenderModel", () => {
  test("maps semantic graph nodes into layouted React Flow nodes", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());
    const positions = assignChamberGraphLayout(graph);
    const renderModel = buildChamberRenderModel(graph, positions);

    expect(renderModel.nodes).toHaveLength(graph.nodes.length);

    const stemDay = renderModel.nodes.find((node) => node.id === "stem:day");
    expect(stemDay?.position).toEqual(positions.get("stem:day"));
    expect(stemDay?.selectable).toBe(true);
    expect(stemDay?.draggable).toBe(false);
  });

  test("registers chamber marker nodes so overlay labels and handles render with the custom node", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState(), { quietGraph: false });
    const markerNode = graph.nodes.find((node) => node.type === "chamberMarker");

    expect(markerNode).toBeDefined();
    expect(CHAMBER_NODE_TYPES.chamberMarker).toBeDefined();
    expect(markerNode?.data.kind).toBe("marker");
    expect(markerNode?.data.kind === "marker" ? markerNode.data.displayLabel : "").toContain("กุ้ยนั้ง");

    const overlayEdge = graph.edges.find((edge) => edge.data.layer === "shen-sha-overlay");
    expect(overlayEdge?.target).toBe(markerNode?.id);
    expect(overlayEdge?.targetHandle).toBe("target-left");
  });

  test("maps reaction edges into bezier edge types without forced one-way markers", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());
    const positions = assignChamberGraphLayout(graph);
    const renderModel = buildChamberRenderModel(graph, positions);

    const reactionEdge = renderModel.edges.find((edge) => edge.data?.layer === "inter-pillar-reaction");
    expect(reactionEdge?.type).toBe("chamberBezier");
    expect(reactionEdge?.markerStart).toBeUndefined();
    expect(reactionEdge?.markerEnd).toBeUndefined();
    expect(reactionEdge?.data?.inlineBadgeMode).toBe("reaction");
  });

  test("preserves selection semantics by id lookup on the semantic graph", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());
    const positions = assignChamberGraphLayout(graph);
    const renderModel = buildChamberRenderModel(graph, positions);

    const reactionEdge = renderModel.edges.find((edge) => edge.data?.layer === "inter-pillar-reaction");
    const matchedSemanticEdge = graph.edges.find((edge) => edge.id === reactionEdge?.id);

    expect(matchedSemanticEdge).toBeDefined();
    expect(matchedSemanticEdge?.data.layer).toBe("inter-pillar-reaction");
  });

  test("marks selected nodes in the render model when selection ids are provided", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());
    const positions = assignChamberGraphLayout(graph);
    const renderModel = buildChamberRenderModel(graph, positions, {
      selectedNodeIds: ["branch:hour"],
    });

    const selectedBranch = renderModel.nodes.find((node) => node.id === "branch:hour");
    const unselectedBranch = renderModel.nodes.find((node) => node.id === "branch:year");

    expect(selectedBranch?.selected).toBe(true);
    expect(unselectedBranch?.selected).toBe(false);
  });

  test("reveals only active compare edges with inline label semantics", () => {
    const calculatedState = buildStubCalculatedState();
    const graph = buildSemanticChamberGraph(calculatedState, { quietGraph: false });
    const positions = assignChamberGraphLayout(graph);
    const selection = buildChamberSelectionState({ graph, nodeIds: ["stem:day", "stem:hour"] });
    const relationBundle = resolveChamberRelationBundle({ selection, graph, calculatedState });
    const renderModel = buildChamberRenderModel(graph, positions, {
      selectedNodeIds: selection.selectedNodes.map((node) => node.id),
      revealedEdgeIds: relationBundle?.visibleEdgeIds ?? [],
      hideUnrevealedEdges: true,
    });

    const revealedFlowEdge = renderModel.edges.find((edge) => edge.id.includes("element-flow") && edge.id.includes("hour"));
    const unrelatedEdge = renderModel.edges.find((edge) => edge.id.includes("year"));

    expect(revealedFlowEdge?.hidden).toBe(false);
    expect(revealedFlowEdge?.data?.showInlineLabel).toBe(true);
    expect(revealedFlowEdge?.data?.inlineLabel).toBe("ส่งเสริม");
    expect(revealedFlowEdge?.data?.inlineDirectionLabel).toBe("รับเข้า");
    expect(revealedFlowEdge?.data?.inlineBadgeMode).toBe("flow");
    expect(revealedFlowEdge?.markerEnd).toBeDefined();
    expect(revealedFlowEdge?.markerStart).toBeUndefined();
    expect(revealedFlowEdge?.ariaLabel).toBeTruthy();
    expect(unrelatedEdge?.hidden).toBe(true);
  });

  test("renders element-interaction edges as bezier edges with inline lane labels", () => {
    const calculatedState = buildStubCalculatedState();
    const graph = buildSemanticChamberGraph(calculatedState, { quietGraph: false });
    const positions = assignChamberGraphLayout(graph);
    const edge = graph.edges.find((candidate) => candidate.data.layer === "element-interaction");
    const selection = buildChamberSelectionState({ graph, edgeIds: edge ? [edge.id] : [] });
    const relationBundle = resolveChamberRelationBundle({ selection, graph, calculatedState });
    const renderModel = buildChamberRenderModel(graph, positions, {
      selectedEdgeIds: selection.selectedEdges.map((selectedEdge) => selectedEdge.id),
      revealedEdgeIds: relationBundle?.visibleEdgeIds ?? [],
      hideUnrevealedEdges: true,
    });

    const renderedEdge = renderModel.edges.find((candidate) => candidate.id === edge?.id);
    expect(renderedEdge?.type).toBe("chamberBezier");
    expect(renderedEdge?.data?.inlineLabel).toMatch(/^(เซียงแซ|พิฆาต)$/);
    expect(renderedEdge?.data?.inlineBadgeMode).toBe("flow");
    expect(renderedEdge?.data?.inlineDirectionLabel).toMatch(/^(เป็นผลดี|เป็นผลร้าย|เป็นกลาง|สองทิศ)$/);
    expect(renderedEdge?.hidden).toBe(false);
  });

  test("suppresses daymaster meaning labels from the main graph inline badge layer", () => {
    const calculatedState = buildStubCalculatedState();
    const graph = buildSemanticChamberGraph(calculatedState, { quietGraph: false });
    const positions = assignChamberGraphLayout(graph);
    const selection = buildChamberSelectionState({ graph, nodeIds: ["stem:day", "stem:year"] });
    const relationBundle = resolveChamberRelationBundle({ selection, graph, calculatedState });
    const renderModel = buildChamberRenderModel(graph, positions, {
      selectedNodeIds: selection.selectedNodes.map((node) => node.id),
      revealedEdgeIds: relationBundle?.visibleEdgeIds ?? [],
      hideUnrevealedEdges: true,
    });

    const daymasterEdge = renderModel.edges.find((candidate) => candidate.data?.layer === "daymaster-meaning");
    expect(daymasterEdge?.data?.inlineLabel).toBeUndefined();
    expect(daymasterEdge?.data?.showInlineLabel).toBe(false);
  });

  test("renders mutual element-interaction edges with markers on both ends", () => {
    const calculatedState = buildStubCalculatedState();
    const graph = buildSemanticChamberGraph(calculatedState, { quietGraph: false });
    const positions = assignChamberGraphLayout(graph);
    const mutualEdge = graph.edges.find(
      (candidate) => candidate.data.layer === "element-interaction" && candidate.data.flowDirection === "both",
    );

    const renderModel = buildChamberRenderModel(graph, positions);
    const renderedEdge = renderModel.edges.find((candidate) => candidate.id === mutualEdge?.id);

    expect(renderedEdge?.markerStart).toBeDefined();
    expect(renderedEdge?.markerEnd).toBeDefined();
  });

  test("renders reaction edges with a compact second-line relation meta", () => {
    const calculatedState = buildStubCalculatedState();
    const graph = buildSemanticChamberGraph(calculatedState, { quietGraph: false });
    const positions = assignChamberGraphLayout(graph);
    const reactionEdge = graph.edges.find(
      (candidate) => candidate.data.layer === "inter-pillar-reaction" && candidate.data.badge.doctrineKey === "interaction:branch-clash",
    );

    const renderModel = buildChamberRenderModel(graph, positions, {
      revealedEdgeIds: reactionEdge ? [reactionEdge.id] : [],
      hideUnrevealedEdges: true,
    });
    const renderedEdge = renderModel.edges.find((candidate) => candidate.id === reactionEdge?.id);

    expect(renderedEdge?.data?.inlineLabel).toBe("ชง");
    expect(renderedEdge?.data?.inlineDirectionLabel).toBe("คู่ปะทะ");
    expect(renderedEdge?.data?.inlineBadgeMode).toBe("reaction");
  });

  test("normalizes stem clash reaction badges to school-facing chong wording", () => {
    const syntheticEdge = {
      id: "reaction:test-stem-clash",
      source: "stem:year",
      target: "stem:month",
      data: {
        layer: "inter-pillar-reaction",
        readingOrder: 1,
        schoolCluster: null,
        schoolLabel: "พิฆาตราศีบน",
        badge: {
          id: "relation-stem-clash-year-month",
          family: "interaction",
          label: "ฟ้าพิฆาต 戊甲",
          shortLabel: "戊甲",
          priority: "primary",
          status: "active",
          meaningShort: "ราศีบนคู่นี้ปะทะกันโดยตรง",
          schoolLabel: "พิฆาตราศีบน",
          doctrineKey: "interaction:heavenly-stem-clash",
          semanticKind: "stem-clash",
          hierarchyLevel: "interaction",
          readingOrder: 3,
          participants: [],
          modal: {
            title: "ฟ้าพิฆาต 戊甲",
            family: "interaction",
            summary: "ราศีบนคู่นี้ปะทะกันโดยตรง",
            explanation: "ราศีบนคู่นี้ปะทะกันโดยตรง",
            readingOrderHint: "อ่านหลังบทบาทต่อดิถี",
            details: [],
          },
        },
        arrowMode: "none",
      },
    } satisfies SemanticEdge;

    const badgeContract = resolveSemanticEdgeBadgeContract(syntheticEdge);

    expect(badgeContract?.relationLabel).toBe("ชง");
    expect(badgeContract?.directionLabel).toBe("คู่ปะทะ");
  });
});
