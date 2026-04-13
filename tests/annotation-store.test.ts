import { describe, expect, test } from "vitest";

import {
  createDraftAnnotationData,
  createAnnotationStore,
  getAnnotationProgressSummary,
  getDimensionProgress,
  isAnnotationReadyForReview,
} from "@/lib/bazi/annotation-store";
import { REQUIRED_ANNOTATION_DIMENSION_NAMES } from "@/lib/bazi/schema-types";

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

    store.getState().updateThoughtProcess("chart_foundation", "ดวงนี้มีฐานธาตุที่ต้องประคอง");
    store.getState().updateFinalPrediction("chart_foundation", "ควรค่อยๆ เดินเกมชีวิตแบบมีแผน");
    store.getState().updateThoughtProcess("balance_element", "ควรเติมธาตุน้ำและโลหะ");

    let summary = getAnnotationProgressSummary(store.getState().dimensions);

    expect(summary).toEqual({
      completeCount: 1,
      draftCount: 1,
      notStartedCount: 13,
    });

    store.getState().updateThoughtProcess("chart_foundation", "");

    const chartFoundation = store.getState().dimensions.chart_foundation;
    summary = getAnnotationProgressSummary(store.getState().dimensions);

    expect(chartFoundation.finalPrediction).toBe("");
    expect(getDimensionProgress(chartFoundation)).toBe("not-started");
    expect(summary).toEqual({
      completeCount: 0,
      draftCount: 1,
      notStartedCount: 14,
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
      [...REQUIRED_ANNOTATION_DIMENSION_NAMES],
    );
    expect(isAnnotationReadyForReview(store.getState().dimensions)).toBe(true);
  });
});