import { describe, expect, test } from "vitest";

import {
  createChamberPresentationStore,
  createChamberPresentationState,
} from "@/lib/bazi/chamber-presentation-store";
import {
  EMPTY_CHAMBER_SELECTION,
  buildChamberSelectionState,
} from "@/lib/bazi/chamber-selection-grammar";
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

describe("chamber-presentation-store", () => {
  test("starts from a calm base presentation state", () => {
    expect(createChamberPresentationState()).toEqual({
      selection: EMPTY_CHAMBER_SELECTION,
      isInspectorOpen: false,
      isTenGodPanelOpen: false,
      isRawMatrixOpen: false,
    });
  });

  test("opens inspector when a non-base selection arrives and closes on clear", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());
    const selection = buildChamberSelectionState({ graph, nodeIds: ["stem:day"] });
    const store = createChamberPresentationStore();

    store.getState().setSelection(selection);

    expect(store.getState().selection.mode).toBe("single");
    expect(store.getState().isInspectorOpen).toBe(true);

    store.getState().clearSelection();

    expect(store.getState().selection).toEqual(EMPTY_CHAMBER_SELECTION);
    expect(store.getState().isInspectorOpen).toBe(false);
  });

  test("resetPresentation removes stale support state between chamber runs", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());
    const selection = buildChamberSelectionState({ graph, nodeIds: ["stem:day", "stem:hour"] });
    const store = createChamberPresentationStore();

    store.getState().toggleTenGodPanel();
    store.getState().setSelection(selection);
    store.getState().closeInspector();
    store.getState().resetPresentation();

    expect(store.getState()).toMatchObject({
      selection: EMPTY_CHAMBER_SELECTION,
      isInspectorOpen: false,
      isTenGodPanelOpen: false,
      isRawMatrixOpen: false,
    });
  });

  test("toggles raw matrix modal without disturbing selection state", () => {
    const store = createChamberPresentationStore();

    store.getState().toggleRawMatrix();
    expect(store.getState().isRawMatrixOpen).toBe(true);

    store.getState().toggleRawMatrix();
    expect(store.getState().isRawMatrixOpen).toBe(false);
    expect(store.getState().selection).toEqual(EMPTY_CHAMBER_SELECTION);
  });
});
