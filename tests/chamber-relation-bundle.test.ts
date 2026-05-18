import { describe, expect, test } from "vitest";

import { buildBaseChartReading } from "@/lib/bazi/symbolic-engine.base-chart";
import { buildGeneralizedInteractionState, resolveBranchInteractionEffects } from "@/lib/bazi/symbolic-engine.interactions";
import { buildChamberSelectionState } from "@/lib/bazi/chamber-selection-grammar";
import { resolveChamberRelationBundle } from "@/lib/bazi/chamber-relation-bundle";
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

describe("chamber relation bundle resolver", () => {
  test("returns null in quiet base state", () => {
    const calculatedState = buildStubCalculatedState();
    const graph = buildSemanticChamberGraph(calculatedState, { quietGraph: false });
    const selection = buildChamberSelectionState({ graph });

    expect(resolveChamberRelationBundle({ selection, graph, calculatedState })).toBeNull();
  });

  test("reveals only relevant ten-god flow relations for day-master compare", () => {
    const calculatedState = buildStubCalculatedState();
    const graph = buildSemanticChamberGraph(calculatedState, { quietGraph: false });
    const selection = buildChamberSelectionState({ graph, nodeIds: ["stem:day", "stem:month"] });

    const bundle = resolveChamberRelationBundle({ selection, graph, calculatedState });

    expect(bundle?.pairDoctrine?.doctrine).toBe("day-master-compare");
    expect(bundle?.visibleNodeIds).toEqual(["stem:day", "stem:month"]);
    expect(bundle?.relations.map((relation) => relation.displayLabel)).toEqual(["ปี่เกียง", "คู่ธาตุ"]);
    expect(bundle?.relations.map((relation) => relation.relationType)).toEqual(["day-master-role", "ten-god-flow"]);
    expect(bundle?.relations.map((relation) => relation.direction)).toEqual(["outward", "none"]);
    expect(bundle?.relations.map((relation) => relation.strength)).toEqual(["secondary", "secondary"]);
    expect(bundle?.visibleEdgeIds.every((edgeId) => !edgeId.includes("hour") && !edgeId.includes("year"))).toBe(true);
  });

  test("keeps direction and flow family stable across repeated resolution", () => {
    const calculatedState = buildStubCalculatedState();
    const graph = buildSemanticChamberGraph(calculatedState, { quietGraph: false });
    const selection = buildChamberSelectionState({ graph, nodeIds: ["stem:day", "stem:hour"] });

    const firstBundle = resolveChamberRelationBundle({ selection, graph, calculatedState });
    const secondBundle = resolveChamberRelationBundle({ selection, graph, calculatedState });

    expect(firstBundle).toEqual(secondBundle);
    expect(firstBundle?.relations.map((relation) => relation.displayLabel)).toEqual(["เพียงอิ่ง", "ส่งเสริม", "เซียงแซ"]);
    expect(firstBundle?.relations.map((relation) => relation.direction)).toEqual(["outward", "inward", "mutual"]);
  });

  test("reuses the graph badge contract for reaction relation detail labels", () => {
    const calculatedState = buildStubCalculatedState();
    const graph = buildSemanticChamberGraph(calculatedState, { quietGraph: false });
    const reactionEdge = graph.edges.find(
      (edge) => edge.data.layer === "inter-pillar-reaction" && edge.data.badge.doctrineKey === "interaction:branch-clash",
    );

    expect(reactionEdge).toBeDefined();

    const selection = buildChamberSelectionState({ graph, edgeIds: reactionEdge ? [reactionEdge.id] : [] });
    const bundle = resolveChamberRelationBundle({ selection, graph, calculatedState });

    expect(bundle?.relations).toEqual([
      expect.objectContaining({
        displayLabel: "ชง",
        detailLabel: "คู่ปะทะ",
        relationType: "interaction",
      }),
    ]);
  });

  test("returns hidden stem cues only for visible pillars in the active bundle", () => {
    const calculatedState = buildStubCalculatedState();
    const graph = buildSemanticChamberGraph(calculatedState, { quietGraph: false });
    const selection = buildChamberSelectionState({ graph, nodeIds: ["stem:day", "stem:month"] });

    const bundle = resolveChamberRelationBundle({ selection, graph, calculatedState });

    expect(bundle?.hiddenStemCues).toEqual([
      { pillarKey: "day", pillarLabel: "ดิถี", hiddenStems: ["丁", "己"] },
      { pillarKey: "month", pillarLabel: "เดือน", hiddenStems: ["己", "癸", "辛"] },
    ]);
  });

  test("returns dedicated element-interaction relations when selecting a generated elemental edge", () => {
    const calculatedState = buildStubCalculatedState();
    const graph = buildSemanticChamberGraph(calculatedState, { quietGraph: false });
    const elementEdge = graph.edges.find((edge) => edge.data.layer === "element-interaction");

    expect(elementEdge).toBeDefined();

    const selection = buildChamberSelectionState({ graph, edgeIds: elementEdge ? [elementEdge.id] : [] });
    const bundle = resolveChamberRelationBundle({ selection, graph, calculatedState });

    expect(bundle?.relations).toEqual([
      expect.objectContaining({
        relationType: "element-interaction",
        detailLabel: expect.stringMatching(/^(สองทิศ|ส่งออก)$/),
      }),
    ]);
  });
});
