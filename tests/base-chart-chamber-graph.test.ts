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

  test("emits stem and branch nodes with the day stem as focal center", () => {
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

    const yearStem = stemNodes.find((node) => node.id === "stem:year");
    const monthStem = stemNodes.find((node) => node.id === "stem:month");
    expect(focalStem && yearStem ? Math.abs(focalStem.position.y - yearStem.position.y) : 0).toBeGreaterThan(0);
    expect(hourStem && monthStem ? Math.abs(hourStem.position.x - monthStem.position.x) : 0).toBeGreaterThan(0);
  });

  test("promotes visible-tier shen-sha and keeps secondary overlays hidden by default", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const markerNodes = graph.nodes.filter((node) => node.type === "chamberMarker");
    expect(markerNodes).toHaveLength(1);
    expect(markerNodes[0].data.kind).toBe("marker");
    expect(markerNodes[0].data.kind === "marker" ? markerNodes[0].data.displayLabel : "").toContain("กุ้ยนั้ง");
    expect(graph.hiddenSecondaryOverlays.map((badge) => badge.label)).toContain("ดอกท้อ (桃花)");
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

  test("groups doctrine reactions into school clusters without losing source provenance", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    expect(graph.schoolClusters.length).toBeGreaterThan(0);

    const reactionEdge = graph.edges.find((edge) => edge.data.layer === "inter-pillar-reaction");
    expect(reactionEdge?.data.schoolCluster?.schoolLabel).toBeTruthy();
    expect(reactionEdge?.data.sourceDetail).toMatch(/ราศี(ล่าง|บน)/);
    expect(reactionEdge?.data.targetDetail).toMatch(/ราศี(ล่าง|บน)/);
  });
});
