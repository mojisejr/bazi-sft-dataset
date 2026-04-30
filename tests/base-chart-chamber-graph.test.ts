import { describe, expect, test } from "vitest";

import { buildBaseChartReading } from "@/lib/bazi/symbolic-engine.base-chart";
import { buildChamberGraphFromCalculatedState } from "@/lib/bazi/base-chart-chamber-graph";
import type { CalculatedStateValue, PillarValue, ShenShaValue } from "@/lib/bazi/schema-types";

const samplePillars: Record<"year" | "month" | "day" | "hour", PillarValue> = {
  year: {
    stem: "甲",
    branch: "子",
    hiddenStems: ["癸"],
    tenGod: "正官",
    stemTranslation: "ไม้",
    branchTranslation: "ชวด",
  },
  month: {
    stem: "己",
    branch: "丑",
    hiddenStems: ["己", "癸", "辛"],
    tenGod: "比肩",
    stemTranslation: "ดิน",
    branchTranslation: "ฉลู",
  },
  day: {
    stem: "己",
    branch: "午",
    hiddenStems: ["丁", "己"],
    tenGod: "ดิถี",
    stemTranslation: "ดิน",
    branchTranslation: "มะเมีย",
  },
  hour: {
    stem: "丁",
    branch: "未",
    hiddenStems: ["己", "丁", "乙"],
    tenGod: "偏印",
    stemTranslation: "ไฟ",
    branchTranslation: "มะแม",
  },
};

const sampleMarkers: ShenShaValue[] = [{
  starName: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
  relatedPillar: "ปี",
  meaning: "มีผู้ใหญ่เข้ามาช่วยเมื่อจังหวะเปิด",
}];

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

describe("buildChamberGraphFromCalculatedState", () => {
  test("returns empty graph when baseChartReading is missing", () => {
    const graph = buildChamberGraphFromCalculatedState({
      fourPillars: samplePillars,
      baseChartReading: undefined,
    } as unknown as CalculatedStateValue);

    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  test("emits exactly four pillar nodes with the day pillar focal", () => {
    const graph = buildChamberGraphFromCalculatedState(buildStubCalculatedState());

    const pillarNodes = graph.nodes.filter((node) => node.type === "chamberPillar");
    expect(pillarNodes).toHaveLength(4);

    const focal = pillarNodes.find((node) => node.data.kind === "pillar" && node.data.isFocal);
    expect(focal).toBeDefined();
    expect(focal?.id).toBe("pillar:day");
  });

  test("creates marker satellite nodes for shen-sha markers", () => {
    const graph = buildChamberGraphFromCalculatedState(buildStubCalculatedState());

    const markerNodes = graph.nodes.filter((node) => node.type === "chamberMarker");
    expect(markerNodes.length).toBeGreaterThanOrEqual(1);
    expect(markerNodes[0].data.kind).toBe("marker");
  });

  test("produces interaction edges connecting at least two pillar nodes", () => {
    const graph = buildChamberGraphFromCalculatedState(buildStubCalculatedState());

    expect(graph.edges.length).toBeGreaterThan(0);

    const edgeTouchesPillars = graph.edges.some(
      (edge) => edge.source.startsWith("pillar:") && edge.target.startsWith("pillar:"),
    );
    expect(edgeTouchesPillars).toBe(true);
  });

  test("propagates badge family/status into edge className", () => {
    const graph = buildChamberGraphFromCalculatedState(buildStubCalculatedState());

    const matchedEdge = graph.edges.find((edge) => edge.className?.includes("chamber-edge--"));
    expect(matchedEdge?.className).toMatch(/chamber-edge chamber-edge--/);
  });
});
