"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { EMPTY_CHAMBER_SELECTION } from "@/lib/bazi/chamber-selection-grammar";
import { resolveChamberRelationBundle } from "@/lib/bazi/chamber-relation-bundle";
import { buildSemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";
import { useBaziWorkspaceSessionStore } from "@/lib/bazi/bazi-session-store";

import {
  ReactionChamberCanvas,
  ReactFlowProvider,
  type ChamberSelection,
} from "@/components/bazi/reaction-chamber/ReactionChamberCanvas";
import { ChamberCommandBar } from "@/components/bazi/reaction-chamber/ChamberCommandBar";
import { ChamberInspector } from "@/components/bazi/reaction-chamber/ChamberInspector";
import { ChamberTenGodPanel } from "@/components/bazi/reaction-chamber/ChamberTenGodPanel";

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
  const [selection, setSelection] = useState<ChamberSelection>(EMPTY_CHAMBER_SELECTION);
  const variant = useViewportVariant();

  useEffect(() => {
    if (!calculatedState) {
      router.replace("/");
    }
  }, [calculatedState, router]);

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
  const roleBadges = calculatedState.baseChartReading?.roleBadges ?? [];

  return (
    <ReactFlowProvider>
      <main className={`reaction-chamber-shell reaction-chamber-shell--${variant}`}>
        <ChamberCommandBar title={title} onBack={() => router.push("/")} graph={graph} />

        <div className="reaction-chamber-shell__viewport">
            <ReactionChamberCanvas graph={graph} onSelectionChange={setSelection} />
            <ChamberTenGodPanel roleBadges={roleBadges} />
            {variant === "docked" && (
              <ChamberInspector selection={selection} relationBundle={relationBundle} variant="docked" onClose={() => setSelection(EMPTY_CHAMBER_SELECTION)} />
            )}
          </div>

        {variant === "sheet" && (
          <ChamberInspector selection={selection} relationBundle={relationBundle} variant="sheet" onClose={() => setSelection(EMPTY_CHAMBER_SELECTION)} />
        )}
      </main>
    </ReactFlowProvider>
  );
}
