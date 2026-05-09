"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { resolveChamberRelationBundle } from "@/lib/bazi/chamber-relation-bundle";
import {
  resetChamberPresentation,
  useChamberPresentationStore,
} from "@/lib/bazi/chamber-presentation-store";
import { buildSemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";
import { useBaziWorkspaceSessionStore } from "@/lib/bazi/bazi-session-store";

import {
  ReactionChamberCanvas,
  ReactFlowProvider,
} from "@/components/bazi/reaction-chamber/ReactionChamberCanvas";
import { ChamberCommandBar } from "@/components/bazi/reaction-chamber/ChamberCommandBar";
import { ChamberInspector } from "@/components/bazi/reaction-chamber/ChamberInspector";
import { ChamberTenGodPanel } from "@/components/bazi/reaction-chamber/ChamberTenGodPanel";
import { RawInteractionMatrixModal } from "@/components/bazi/reaction-chamber/RawInteractionMatrixModal";

const MOBILE_BREAKPOINT_PX = 900;

function useViewportVariant(): "docked" | "sheet" {
  const [variant, setVariant] = useState<"docked" | "sheet">("docked");

  useEffect(() => {
    function resolveVariant() {
      setVariant(window.innerWidth < MOBILE_BREAKPOINT_PX ? "sheet" : "docked");
    }

    resolveVariant();
    window.addEventListener("resize", resolveVariant);
    return () => window.removeEventListener("resize", resolveVariant);
  }, []);

  return variant;
}

export function ReactionChamberShell() {
  const router = useRouter();
  const calculatedState = useBaziWorkspaceSessionStore((state) => state.calculatedState);
  const variant = useViewportVariant();
  const selection = useChamberPresentationStore((state) => state.selection);
  const isInspectorOpen = useChamberPresentationStore((state) => state.isInspectorOpen);
  const setSelection = useChamberPresentationStore((state) => state.setSelection);
  const clearSelection = useChamberPresentationStore((state) => state.clearSelection);
  const toggleInspector = useChamberPresentationStore((state) => state.toggleInspector);
  const isTenGodPanelOpen = useChamberPresentationStore((state) => state.isTenGodPanelOpen);
  const toggleTenGodPanel = useChamberPresentationStore((state) => state.toggleTenGodPanel);
  const closeTenGodPanel = useChamberPresentationStore((state) => state.closeTenGodPanel);
  const isRawMatrixOpen = useChamberPresentationStore((state) => state.isRawMatrixOpen);
  const toggleRawMatrix = useChamberPresentationStore((state) => state.toggleRawMatrix);
  const closeRawMatrix = useChamberPresentationStore((state) => state.closeRawMatrix);

  useEffect(() => {
    if (!calculatedState) {
      router.replace("/");
    }
  }, [calculatedState, router]);

  useEffect(() => {
    resetChamberPresentation();

    return () => {
      resetChamberPresentation();
    };
  }, [calculatedState]);

  const graph = useMemo(() => {
    if (!calculatedState) {
      return { nodes: [], edges: [], schoolClusters: [], hiddenSecondaryOverlays: [] };
    }
    return buildSemanticChamberGraph(calculatedState);
  }, [calculatedState]);

  const relationBundle = useMemo(() => {
    if (!calculatedState) {
      return null;
    }

    return resolveChamberRelationBundle({
      selection,
      graph,
      calculatedState,
    });
  }, [calculatedState, graph, selection]);

  if (!calculatedState) {
    return (
      <main className="reaction-chamber-shell reaction-chamber-shell--empty">
        <div className="reaction-chamber-shell__empty-card">
          <p className="section-kicker">แผนภาพปฏิกิริยา</p>
          <h2>ยังไม่มีดวงให้เปิด</h2>
          <p>กลับไปคำนวณดวงในหน้าสรุปก่อน แล้วค่อยเปิดแผนภาพปฏิกิริยาอีกครั้งค่ะ</p>
          <button type="button" className="primary-action" onClick={() => router.replace("/")}>กลับหน้าสรุปดวง</button>
        </div>
      </main>
    );
  }

  const dayMaster = calculatedState.dayMaster;
  const title = `แผนภาพปฏิกิริยา · ดิถี ${dayMaster}`;
  return (
    <ReactFlowProvider>
      <main className={`reaction-chamber-shell reaction-chamber-shell--${variant}`}>
        <ChamberCommandBar
          title={title}
          onBack={() => router.push("/")}
          graph={graph}
          selectionMode={selection.mode}
          isInspectorOpen={isInspectorOpen}
          isRoleSummaryOpen={isTenGodPanelOpen}
          isRawMatrixOpen={isRawMatrixOpen}
          onToggleInspector={toggleInspector}
          onToggleRoleSummary={toggleTenGodPanel}
          onToggleRawMatrix={toggleRawMatrix}
        />

        <div className="reaction-chamber-shell__viewport">
          <ReactionChamberCanvas graph={graph} selection={selection} relationBundle={relationBundle} onSelectionChange={setSelection} />
          <ChamberTenGodPanel
            calculatedState={calculatedState}
            isOpen={isTenGodPanelOpen}
            onClose={closeTenGodPanel}
          />
          <RawInteractionMatrixModal
            calculatedState={calculatedState}
            isOpen={isRawMatrixOpen}
            onClose={closeRawMatrix}
          />
          {variant === "docked" && isInspectorOpen && (
            <ChamberInspector selection={selection} relationBundle={relationBundle} variant="docked" onClose={clearSelection} />
          )}
        </div>

        {variant === "sheet" && (
          <ChamberInspector selection={selection} relationBundle={relationBundle} variant="sheet" onClose={clearSelection} />
        )}
      </main>
    </ReactFlowProvider>
  );
}
