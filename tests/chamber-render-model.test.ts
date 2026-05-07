import { describe, expect, test } from "vitest";

import { buildBaseChartReading } from "@/lib/bazi/symbolic-engine.base-chart";
import { resolveBranchInteractionEffects } from "@/lib/bazi/symbolic-engine.interactions";
import { assignChamberGraphLayout } from "@/lib/bazi/chamber-layout";
import { buildSemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";
import { buildChamberRenderModel } from "@/components/bazi/reaction-chamber/chamber-render-model";
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

  test("maps reaction edges into bezier edge types with arrow markers", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());
    const positions = assignChamberGraphLayout(graph);
    const renderModel = buildChamberRenderModel(graph, positions);

    const reactionEdge = renderModel.edges.find((edge) => edge.data?.layer === "inter-pillar-reaction");
    expect(reactionEdge?.type).toBe("chamberBezier");
    expect(reactionEdge?.markerEnd).toBeDefined();
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
});
