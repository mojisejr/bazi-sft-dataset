import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import {
  EMPTY_CHAMBER_SELECTION,
  type ChamberSelectionState,
} from "@/lib/bazi/chamber-selection-grammar";
import {
  DEFAULT_SCHOOL_REVEAL_POLICY_CONFIG,
  type SchoolRevealFlowFamily,
  type SchoolRevealPolicyConfig,
} from "@/lib/bazi/school-reveal-policy";

export type ChamberLayerToggles = {
  showStructure: boolean;
  showEnergy: boolean;
  showReaction: boolean;
  showOverlay: boolean;
  energyFamily: SchoolRevealFlowFamily;
};

export type ChamberToggleLayerKey = "showStructure" | "showEnergy" | "showReaction" | "showOverlay";

export function resolveChamberGraphRevealPolicy(
  layerToggles: ChamberLayerToggles,
): SchoolRevealPolicyConfig {
  const isQuietDefault = layerToggles.showStructure
    && layerToggles.showEnergy
    && layerToggles.showReaction
    && layerToggles.showOverlay
    && layerToggles.energyFamily === "all";

  return {
    ...DEFAULT_SCHOOL_REVEAL_POLICY_CONFIG,
    ...layerToggles,
    quietGraph: isQuietDefault,
    focusedRoleFamily: layerToggles.energyFamily,
  };
}

export function isChamberQuietDefault(layerToggles: ChamberLayerToggles): boolean {
  return resolveChamberGraphRevealPolicy(layerToggles).quietGraph;
}

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
  toggleLayer: (layer: ChamberToggleLayerKey) => void;
  setEnergyFamily: (family: SchoolRevealFlowFamily) => void;
  resetLayerFocus: () => void;
  resetPresentation: () => void;
};

export function createChamberPresentationState(
  overrides: Partial<ChamberPresentationState> = {},
): ChamberPresentationState {
  return {
    selection: EMPTY_CHAMBER_SELECTION,
    isInspectorOpen: true,
    isTenGodPanelOpen: false,
    isRawMatrixOpen: false,
      layerToggles: {
        showStructure: true,
        showEnergy: true,
        showReaction: true,
        showOverlay: true,
        energyFamily: "all",
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
      set((current) => ({
        selection,
        isInspectorOpen: current.isInspectorOpen || selection.mode !== "base",
      }));
    },
    clearSelection: () => {
      set({
        selection: EMPTY_CHAMBER_SELECTION,
        isInspectorOpen: true,
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
    setEnergyFamily: (energyFamily) => {
      set((current) => ({
        layerToggles: {
          ...current.layerToggles,
          showEnergy: true,
          showStructure: energyFamily === "all",
          showReaction: energyFamily === "all" ? current.layerToggles.showReaction : false,
          showOverlay: energyFamily === "all" ? current.layerToggles.showOverlay : false,
          energyFamily,
        },
      }));
    },
    resetLayerFocus: () => {
      set((current) => ({
        layerToggles: {
          ...current.layerToggles,
          showStructure: true,
          showEnergy: true,
          showReaction: true,
          showOverlay: true,
          energyFamily: "all",
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
