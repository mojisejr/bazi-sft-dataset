import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import {
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type AnnotationDimensionName,
  type DraftAnnotationDataValue,
} from "@/lib/bazi/schema-types";

export { ANNOTATION_DIMENSION_META } from "@/lib/bazi/annotation-dimension-meta";

export type AnnotationProgressState = "not-started" | "draft" | "complete";

export type AnnotationDimensionDraft = {
  thoughtProcess: string;
  finalPrediction: string;
};

export type AnnotationDimensionDraftState = Record<
  AnnotationDimensionName,
  AnnotationDimensionDraft
>;

export type AnnotationProgressSummary = {
  completeCount: number;
  draftCount: number;
  notStartedCount: number;
};

export type AnnotationDraftContentState = "empty" | "active";

export function createEmptyAnnotationDimensions(): AnnotationDimensionDraftState {
  return REQUIRED_ANNOTATION_DIMENSION_NAMES.reduce((accumulator, dimensionName) => {
    accumulator[dimensionName] = {
      thoughtProcess: "",
      finalPrediction: "",
    };

    return accumulator;
  }, {} as AnnotationDimensionDraftState);
}

export function getDimensionProgress(
  dimension: AnnotationDimensionDraft,
): AnnotationProgressState {
  const hasThoughtProcess = dimension.thoughtProcess.trim().length > 0;
  const hasPrediction = dimension.finalPrediction.trim().length > 0;

  if (hasThoughtProcess && hasPrediction) {
    return "complete";
  }

  if (hasThoughtProcess || hasPrediction) {
    return "draft";
  }

  return "not-started";
}

export function getAnnotationProgressSummary(
  dimensions: AnnotationDimensionDraftState,
): AnnotationProgressSummary {
  return REQUIRED_ANNOTATION_DIMENSION_NAMES.reduce(
    (summary, dimensionName) => {
      const progress = getDimensionProgress(dimensions[dimensionName]);

      if (progress === "complete") {
        summary.completeCount += 1;
      } else if (progress === "draft") {
        summary.draftCount += 1;
      } else {
        summary.notStartedCount += 1;
      }

      return summary;
    },
    {
      completeCount: 0,
      draftCount: 0,
      notStartedCount: 0,
    },
  );
}

export function getAnnotationDraftContentState(
  dimensions: AnnotationDimensionDraftState,
): AnnotationDraftContentState {
  const summary = getAnnotationProgressSummary(dimensions);

  if (summary.completeCount > 0 || summary.draftCount > 0) {
    return "active";
  }

  return "empty";
}

export function isAnnotationReadyForReview(
  dimensions: AnnotationDimensionDraftState,
) {
  const summary = getAnnotationProgressSummary(dimensions);

  return summary.completeCount === REQUIRED_ANNOTATION_DIMENSION_NAMES.length;
}

export function createDraftAnnotationData(
  dimensions: AnnotationDimensionDraftState,
): DraftAnnotationDataValue {
  return {
    version: "1.6",
    dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
      dimension_name: dimensionName,
      thought_process: dimensions[dimensionName].thoughtProcess,
      final_prediction: dimensions[dimensionName].finalPrediction,
      supporting_signals: [],
    })),
  };
}

type AnnotationStoreState = {
  dimensions: AnnotationDimensionDraftState;
  expandedDimensionName: AnnotationDimensionName;
  setExpandedDimension: (dimensionName: AnnotationDimensionName) => void;
  updateThoughtProcess: (
    dimensionName: AnnotationDimensionName,
    thoughtProcess: string,
  ) => void;
  updateFinalPrediction: (
    dimensionName: AnnotationDimensionName,
    finalPrediction: string,
  ) => void;
  reset: () => void;
};

export function createAnnotationStore() {
  return createStore<AnnotationStoreState>((set) => ({
    dimensions: createEmptyAnnotationDimensions(),
    expandedDimensionName: REQUIRED_ANNOTATION_DIMENSION_NAMES[0],
    setExpandedDimension: (dimensionName) => {
      set({ expandedDimensionName: dimensionName });
    },
    updateThoughtProcess: (dimensionName, thoughtProcess) => {
      set((state) => {
        const trimmedValue = thoughtProcess.trim();
        const currentDimension = state.dimensions[dimensionName];

        return {
          dimensions: {
            ...state.dimensions,
            [dimensionName]: {
              ...currentDimension,
              thoughtProcess,
              finalPrediction:
                trimmedValue.length > 0 ? currentDimension.finalPrediction : "",
            },
          },
        };
      });
    },
    updateFinalPrediction: (dimensionName, finalPrediction) => {
      set((state) => ({
        dimensions: {
          ...state.dimensions,
          [dimensionName]: {
            ...state.dimensions[dimensionName],
            finalPrediction,
          },
        },
      }));
    },
    reset: () => {
      set({
        dimensions: createEmptyAnnotationDimensions(),
        expandedDimensionName: REQUIRED_ANNOTATION_DIMENSION_NAMES[0],
      });
    },
  }));
}

const annotationStore = createAnnotationStore();

export function useAnnotationStore<Selected>(
  selector: (state: AnnotationStoreState) => Selected,
) {
  return useStore(annotationStore, selector);
}

export function resetAnnotationStore() {
  annotationStore.getState().reset();
}