import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import {
  EMPTY_CHAMBER_SELECTION,
  type ChamberSelectionState,
} from "@/lib/bazi/chamber-selection-grammar";

export type ChamberLayerToggles = {
  showStructure: boolean;
  showEnergy: boolean;
  showOverlay: boolean;
};

export type ChamberPresentationState = {
  selection: ChamberSelectionState;
  isInspectorOpen: boolean;
  isTenGodPanelOpen: boolean;
  isRawMatrixOpen: boolean;
  layerToggles: ChamberLayerToggles;
  hoveredNodeId: string | null;
};

type ChamberPresentationStoreState = ChamberPresentationState & {
  setSelection: (selection: ChamberSelectionState) => void;
  clearSelection: () => void;
  setHoveredNodeId: (nodeId: string | null) => void;
  openInspector: () => void;
  closeInspector: () => void;
  toggleInspector: () => void;
  toggleTenGodPanel: () => void;
  closeTenGodPanel: () => void;
  toggleRawMatrix: () => void;
  closeRawMatrix: () => void;
  toggleLayer: (layer: keyof ChamberLayerToggles) => void;
  resetPresentation: () => void;
};

export function createChamberPresentationState(
  overrides: Partial<ChamberPresentationState> = {},
): ChamberPresentationState {
  return {
    selection: EMPTY_CHAMBER_SELECTION,
    isInspectorOpen: false,
    isTenGodPanelOpen: false,
    isRawMatrixOpen: false,
    layerToggles: {
      showStructure: true,
      showEnergy: true,
      showOverlay: true,
    },
    hoveredNodeId: null,
    ...overrides,
  };
}

export function createChamberPresentationStore(
  initialState: Partial<ChamberPresentationState> = {},
) {
  return createStore<ChamberPresentationStoreState>((set) => ({
    ...createChamberPresentationState(initialState),
    setSelection: (selection) => {
      set({
        selection,
        isInspectorOpen: selection.mode !== "base",
      });
    },
    clearSelection: () => {
      set({
        selection: EMPTY_CHAMBER_SELECTION,
        isInspectorOpen: false,
      });
    },
    setHoveredNodeId: (hoveredNodeId) => {
      set({ hoveredNodeId });
    },
    openInspector: () => {
      set({ isInspectorOpen: true });
    },
    closeInspector: () => {
      set({ isInspectorOpen: false });
    },
    toggleInspector: () => {
      set((current) => ({ isInspectorOpen: !current.isInspectorOpen }));
    },
    toggleTenGodPanel: () => {
      set((current) => ({ isTenGodPanelOpen: !current.isTenGodPanelOpen }));
    },
    closeTenGodPanel: () => {
      set({ isTenGodPanelOpen: false });
    },
    toggleRawMatrix: () => {
      set((current) => ({ isRawMatrixOpen: !current.isRawMatrixOpen }));
    },
    closeRawMatrix: () => {
      set({ isRawMatrixOpen: false });
    },
    toggleLayer: (layer) => {
      set((current) => ({
        layerToggles: {
          ...current.layerToggles,
          [layer]: !current.layerToggles[layer],
        },
      }));
    },
    resetPresentation: () => {
      set(createChamberPresentationState());
    },
  }));
}

const chamberPresentationStore = createChamberPresentationStore();

export function useChamberPresentationStore<Selected>(
  selector: (state: ChamberPresentationStoreState) => Selected,
) {
  return useStore(chamberPresentationStore, selector);
}

export function resetChamberPresentation() {
  chamberPresentationStore.getState().resetPresentation();
}
