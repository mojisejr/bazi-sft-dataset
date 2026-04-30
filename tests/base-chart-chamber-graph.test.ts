import { describe, expect, test } from "vitest";

import { buildBaseChartReading } from "@/lib/bazi/symbolic-engine.base-chart";
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
  const reading = buildBaseChartReading({
    dayMasterStem: "己",
    pillars: samplePillars,
    shenSha: sampleMarkers,
    precedenceSignals: [],
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

  test("emits radial pillar nodes with outer full display and the day pillar as reduced focal anchor", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    const pillarNodes = graph.nodes.filter((node) => node.type === "chamberPillar");
    expect(pillarNodes).toHaveLength(4);

    const focal = pillarNodes.find((node) => node.data.kind === "pillar" && node.data.isFocal);
    expect(focal).toBeDefined();
    expect(focal?.id).toBe("pillar:day");
    expect(focal?.data.kind === "pillar" ? focal.data.displayMode : null).toBe("day-anchor");
    expect(focal?.data.kind === "pillar" ? focal.data.stageSlots.map((slot) => slot.source) : []).toEqual(["lower"]);

    const hour = pillarNodes.find((node) => node.id === "pillar:hour");
    expect(hour?.data.kind === "pillar" ? hour.data.displayMode : null).toBe("outer-full");
    expect(hour?.data.kind === "pillar" ? hour.data.stageSlots.map((slot) => slot.source) : []).toEqual(["upper", "sitting", "lower"]);
    expect(hour?.position.x).not.toBe(0);
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
    expect(daymasterEdges[0].source).toBe("pillar:day");
    expect(daymasterEdges[0].className).toContain("chamber-edge--daymaster");
  });

  test("produces doctrine-layer interaction edges connecting at least two pillar nodes", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());

    expect(graph.edges.length).toBeGreaterThan(0);

    const edgeTouchesPillars = graph.edges.some(
      (edge) => edge.data.layer === "inter-pillar-reaction"
        && edge.source.startsWith("pillar:")
        && edge.target.startsWith("pillar:"),
    );
    expect(edgeTouchesPillars).toBe(true);
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
    expect(reactionEdge?.data.sourceDetail).toContain("ราศีล่าง");
    expect(reactionEdge?.data.targetDetail).toContain("ราศีล่าง");
  });
});
