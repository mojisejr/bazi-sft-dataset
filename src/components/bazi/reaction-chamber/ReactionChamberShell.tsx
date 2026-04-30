"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { buildSemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";
import { useBaziWorkspaceSessionStore } from "@/lib/bazi/bazi-session-store";

import {
  ReactionChamberCanvas,
  ReactFlowProvider,
  type ChamberSelection,
} from "@/components/bazi/reaction-chamber/ReactionChamberCanvas";
import { ChamberCommandBar } from "@/components/bazi/reaction-chamber/ChamberCommandBar";
import { ChamberInspector } from "@/components/bazi/reaction-chamber/ChamberInspector";

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
  const [selection, setSelection] = useState<ChamberSelection>(null);
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
        <ChamberCommandBar title={title} onBack={() => router.push("/")} />

        <div className="reaction-chamber-shell__viewport">
          <ReactionChamberCanvas graph={graph} onSelectionChange={setSelection} />
          {variant === "docked" && (
            <ChamberInspector selection={selection} variant="docked" onClose={() => setSelection(null)} />
          )}
        </div>

        {variant === "sheet" && (
          <ChamberInspector selection={selection} variant="sheet" onClose={() => setSelection(null)} />
        )}
      </main>
    </ReactFlowProvider>
  );
}
