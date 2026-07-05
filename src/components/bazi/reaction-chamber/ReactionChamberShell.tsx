"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { buildDayMasterRelationPacket } from "@/lib/bazi/day-master-relation-reading-poc";
import { resolveChamberRelationBundle } from "@/lib/bazi/chamber-relation-bundle";
import {
  resetChamberPresentation,
  resolveChamberGraphRevealPolicy,
  useChamberPresentationStore,
} from "@/lib/bazi/chamber-presentation-store";
import { buildSemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";
import { useBaziWorkspaceSessionStore } from "@/lib/bazi/bazi-session-store";

import {
  ReactionChamberCanvas,
  ReactFlowProvider,
} from "@/components/bazi/reaction-chamber/ReactionChamberCanvas";
import { AiNarrateButton } from "@/components/bazi/AiNarrateButton";
import { ChamberCommandBar } from "@/components/bazi/reaction-chamber/ChamberCommandBar";
import { ChamberInspector } from "@/components/bazi/reaction-chamber/ChamberInspector";
import { ChamberLayerTogglesPanel } from "@/components/bazi/reaction-chamber/ChamberLayerTogglesPanel";

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
  const layerToggles = useChamberPresentationStore((state) => state.layerToggles);
  const isQuietDefault = useChamberPresentationStore((state) => resolveChamberGraphRevealPolicy(state.layerToggles).quietGraph);
  const hoveredNodeId = useChamberPresentationStore((state) => state.hoveredNodeId);
  const setSelection = useChamberPresentationStore((state) => state.setSelection);
  const setHoveredNodeId = useChamberPresentationStore((state) => state.setHoveredNodeId);
  const clearSelection = useChamberPresentationStore((state) => state.clearSelection);
  const toggleInspector = useChamberPresentationStore((state) => state.toggleInspector);
  const toggleLayer = useChamberPresentationStore((state) => state.toggleLayer);
  const setEnergyFamily = useChamberPresentationStore((state) => state.setEnergyFamily);
  const resetLayerFocus = useChamberPresentationStore((state) => state.resetLayerFocus);

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

  const readingPacket = useMemo(() => {
    if (!calculatedState) {
      return null;
    }

    return buildDayMasterRelationPacket(calculatedState);
  }, [calculatedState]);

  const graph = useMemo(() => {
    if (!calculatedState) {
      return { nodes: [], edges: [], schoolClusters: [], hiddenSecondaryOverlays: [] };
    }
    return buildSemanticChamberGraph(calculatedState, resolveChamberGraphRevealPolicy(layerToggles));
  }, [calculatedState, layerToggles]);

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
  const title = `ผังปฏิกิริยาพื้นดวง · ดิถี ${dayMaster}`;
  return (
    <ReactFlowProvider>
      <main className={`reaction-chamber-shell reaction-chamber-shell--${variant}`}>
        <ChamberCommandBar
          title={title}
          onBack={() => router.push("/")}
          graph={graph}
          selectionMode={selection.mode}
          isInspectorOpen={isInspectorOpen}
          onToggleInspector={toggleInspector}
        />

        <div className="reaction-chamber-shell__viewport">
          <div className="reaction-chamber-shell__canvas-stack">
            <ChamberLayerTogglesPanel
              layerToggles={layerToggles}
              onToggleLayer={toggleLayer}
              onSetEnergyFamily={setEnergyFamily}
              onResetLayerFocus={resetLayerFocus}
            />
            <ReactionChamberCanvas
              graph={graph}
              selection={selection}
              relationBundle={relationBundle}
              hoveredNodeId={hoveredNodeId}
              forceInlineLabels={!isQuietDefault && layerToggles.energyFamily !== "all"}
              onSelectionChange={setSelection}
              onNodeHover={(node) => setHoveredNodeId(node?.id ?? null)}
            />
          </div>
          {variant === "docked" && isInspectorOpen && (
            <ChamberInspector selection={selection} relationBundle={relationBundle} readingPacket={readingPacket} variant="docked" onClose={clearSelection} />
          )}
        </div>

        {variant === "sheet" && isInspectorOpen && (
          <ChamberInspector selection={selection} relationBundle={relationBundle} readingPacket={readingPacket} variant="sheet" onClose={clearSelection} />
        )}

        {readingPacket && (
          <div className="reaction-chamber-shell__ai">
            <AiNarrateButton
              feature="reaction_chamber"
              domainLabel="ปฏิกิริยาธาตุในดวง"
              engineText={[
                readingPacket.chartAnchor.identityNarrativeThai,
                readingPacket.chartAnchor.balanceNarrativeThai,
                ...readingPacket.stepInsights.map((s) => `${s.titleThai}: ${s.summaryThai}`),
              ].join("\n")}
            />
          </div>
        )}
      </main>
    </ReactFlowProvider>
  );
}
