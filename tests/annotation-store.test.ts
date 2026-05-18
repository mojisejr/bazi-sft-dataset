import { describe, expect, test } from "vitest";

import {
  createDraftAnnotationData,
  createAnnotationStore,
  getAnnotationProgressSummary,
  getDimensionProgress,
  isAnnotationReadyForReview,
} from "@/lib/bazi/annotation-store";
import {
  ACTIVE_RLHF_DIMENSION_NAMES,
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
} from "@/lib/bazi/schema-types";

describe("annotation store", () => {
  test("updates one dimension without mutating the others", () => {
    const store = createAnnotationStore();

    store.getState().updateThoughtProcess(
      "chart_foundation",
      "ใช้โครงสร้างหลักของดวงเป็นฐานในการเปิดเคส",
    );

    const state = store.getState().dimensions;

    expect(state.chart_foundation.thoughtProcess).toContain("โครงสร้างหลักของดวง");
    expect(state.balance_element.thoughtProcess).toBe("");
    expect(getDimensionProgress(state.chart_foundation)).toBe("draft");
    expect(getDimensionProgress(state.balance_element)).toBe("not-started");
  });

  test("calculates progress summary and clears prediction when thought process is removed", () => {
    const store = createAnnotationStore();

    store.getState().updateThoughtProcess("personality_psychology", "ดวงนี้มีแรงขับภายในที่ชัดและคุมเกมเก่ง");
    store.getState().updateFinalPrediction("personality_psychology", "นิสัยหลักคือรับแรงกดดันได้ดีแต่ต้องระวังความตึงในใจ");
    store.getState().updateThoughtProcess("balance_element", "ควรเติมธาตุน้ำและโลหะ");

    let summary = getAnnotationProgressSummary(store.getState().dimensions);

    expect(summary).toEqual({
      completeCount: 1,
      draftCount: 1,
      notStartedCount: ACTIVE_RLHF_DIMENSION_NAMES.length - 2,
    });

    store.getState().updateThoughtProcess("personality_psychology", "");

    const personality = store.getState().dimensions.personality_psychology;
    summary = getAnnotationProgressSummary(store.getState().dimensions);

    expect(personality.finalPrediction).toBe("");
    expect(getDimensionProgress(personality)).toBe("not-started");
    expect(summary).toEqual({
      completeCount: 0,
      draftCount: 1,
      notStartedCount: ACTIVE_RLHF_DIMENSION_NAMES.length - 1,
    });
  });

  test("serializes draft annotation data in canonical order and detects review readiness", () => {
    const store = createAnnotationStore();

    for (const dimensionName of REQUIRED_ANNOTATION_DIMENSION_NAMES) {
      store.getState().updateThoughtProcess(dimensionName, `Reasoning for ${dimensionName}`);
      store.getState().updateFinalPrediction(dimensionName, `Prediction for ${dimensionName}`);
    }

    const annotationData = createDraftAnnotationData(store.getState().dimensions);

    expect(annotationData.version).toBe("1.6");
    expect(annotationData.dimensions.map((dimension) => dimension.dimension_name)).toEqual(
      [...ACTIVE_RLHF_DIMENSION_NAMES],
    );
    expect(isAnnotationReadyForReview(store.getState().dimensions)).toBe(true);
  });
});
