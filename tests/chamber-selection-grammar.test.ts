import { describe, expect, test } from "vitest";

import { buildBaseChartReading } from "@/lib/bazi/symbolic-engine.base-chart";
import { buildGeneralizedInteractionState, resolveBranchInteractionEffects } from "@/lib/bazi/symbolic-engine.interactions";
import { buildChamberSelectionState, EMPTY_CHAMBER_SELECTION } from "@/lib/bazi/chamber-selection-grammar";
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

describe("chamber selection grammar", () => {
  test("returns quiet base state when nothing is selected", () => {
    expect(buildChamberSelectionState({ graph: buildSemanticChamberGraph(buildStubCalculatedState()) })).toEqual(
      EMPTY_CHAMBER_SELECTION,
    );
  });

  test("locks single-selection neighborhood mode for a day-master anchor", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());
    const selection = buildChamberSelectionState({ graph, nodeIds: ["stem:day"] });

    expect(selection.mode).toBe("single");
    expect(selection.revealScope).toBe("selected-neighborhood");
    expect(selection.primary?.kind).toBe("node");
    expect(selection.primary?.kind === "node" ? selection.primary.node.id : null).toBe("stem:day");
    expect(selection.pairDoctrine).toBeNull();
  });

  test("locks pair compare doctrine when day master is compared against another anchor", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());
    const selection = buildChamberSelectionState({ graph, nodeIds: ["stem:month", "stem:day"] });

    expect(selection.mode).toBe("pair");
    expect(selection.revealScope).toBe("pair-bundle");
    expect(selection.pairDoctrine).toEqual({
      doctrine: "day-master-compare",
      includesDayMaster: true,
      includesDayPillar: true,
      anchorNodeIds: ["stem:day", "stem:month"],
    });
  });

  test("keeps non-day pair selections in anchor compare doctrine", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());
    const selection = buildChamberSelectionState({ graph, nodeIds: ["stem:month", "branch:year"] });

    expect(selection.mode).toBe("pair");
    expect(selection.pairDoctrine).toEqual({
      doctrine: "anchor-compare",
      includesDayMaster: false,
      includesDayPillar: false,
      anchorNodeIds: ["branch:year", "stem:month"],
    });
  });

  test("escalates to multi selection when more than two anchors are selected", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());
    const selection = buildChamberSelectionState({ graph, nodeIds: ["stem:day", "stem:month", "branch:year"] });

    expect(selection.mode).toBe("multi");
    expect(selection.revealScope).toBe("cluster-bundle");
    expect(selection.selectedNodes.map((node) => node.id)).toEqual(["stem:day", "stem:month", "branch:year"]);
    expect(selection.pairDoctrine).toBeNull();
  });
});
