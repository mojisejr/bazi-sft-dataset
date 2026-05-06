"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { buildSemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";
import { useBaziWorkspaceSessionStore } from "@/lib/bazi/bazi-session-store";
import { buildReactionChamberDoctrineModel } from "@/lib/bazi/reaction-chamber-doctrine";

import {
  ReactionChamberCanvas,
  ReactFlowProvider,
  type ChamberSelection,
} from "@/components/bazi/reaction-chamber/ReactionChamberCanvas";
import { ChamberCommandBar } from "@/components/bazi/reaction-chamber/ChamberCommandBar";
import { ChamberInspector } from "@/components/bazi/reaction-chamber/ChamberInspector";
import { ChamberTenGodPanel } from "@/components/bazi/reaction-chamber/ChamberTenGodPanel";

const MOBILE_BREAKPOINT_PX = 900;

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

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
  const [activeLaneKey, setActiveLaneKey] = useState<string | null>(null);
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

  const doctrine = useMemo(() => {
    if (!calculatedState) {
      return buildReactionChamberDoctrineModel({ dayMaster: "-" });
    }

    return buildReactionChamberDoctrineModel({
      dayMaster: calculatedState.dayMaster,
      reading: calculatedState.baseChartReading,
      hiddenSecondaryCount: graph.hiddenSecondaryOverlays.length,
    });
  }, [calculatedState, graph.hiddenSecondaryOverlays.length]);

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

  const roleBadges = calculatedState.baseChartReading?.roleBadges ?? [];
  const resolvedActiveLaneKey = doctrine.lanes.some((lane) => lane.key === activeLaneKey)
    ? activeLaneKey
    : (doctrine.lanes[0]?.key ?? null);
  const activeLane = doctrine.lanes.find((lane) => lane.key === resolvedActiveLaneKey) ?? null;

  return (
    <ReactFlowProvider>
      <main className={`reaction-chamber-shell reaction-chamber-shell--${variant}`}>
        <ChamberCommandBar
          kicker={doctrine.kicker}
          title={doctrine.title}
          subtitle={doctrine.subtitle}
          summary={doctrine.summary}
          onBack={() => router.push("/")}
        />

        <div className="reaction-chamber-shell__viewport reaction-chamber-shell__viewport--doctrine-first">
          <section className="reaction-chamber-shell__doctrine" aria-label="doctrine-first reading lanes">
            {doctrine.strengthGate ? (
              <article className="reaction-chamber-shell__strength-gate" data-lane-key="strength-gate">
                <div>
                  <p className="reaction-chamber-shell__lane-kicker">ด่านแรกของการอ่าน</p>
                  <h2>{doctrine.strengthGate.title}</h2>
                  <p>{doctrine.strengthGate.summary}</p>
                </div>
                <div className="reaction-chamber-shell__strength-meta">
                  {doctrine.strengthGate.displayLabel ? (
                    <span className="reaction-chamber-shell__strength-chip">{doctrine.strengthGate.displayLabel}</span>
                  ) : null}
                  {typeof doctrine.strengthGate.score === "number" ? (
                    <span className="reaction-chamber-shell__strength-score">คะแนน {doctrine.strengthGate.score.toFixed(2)}</span>
                  ) : null}
                </div>
                <p className="reaction-chamber-shell__strength-hint">{doctrine.strengthGate.readingOrderHint}</p>
              </article>
            ) : null}

            {doctrine.readingOrderSteps.length > 0 ? (
              <section className="reaction-chamber-shell__reading-order" aria-label="reading order steps">
                <p className="reaction-chamber-shell__lane-kicker">ลำดับการอ่าน</p>
                <ol>
                  {doctrine.readingOrderSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>
            ) : null}

            <section className="reaction-chamber-shell__lane-list" aria-label="doctrine lanes">
              {doctrine.lanes.map((lane) => (
                <button
                  key={lane.key}
                  type="button"
                  className={classNames(
                    "reaction-chamber-shell__lane-card",
                    resolvedActiveLaneKey === lane.key && "reaction-chamber-shell__lane-card--active",
                  )}
                  onClick={() => setActiveLaneKey(lane.key)}
                >
                  <div className="reaction-chamber-shell__lane-head">
                    <span className="reaction-chamber-shell__lane-order">{lane.readingOrder}</span>
                    <div>
                      <p className="reaction-chamber-shell__lane-title">{lane.title}</p>
                      {lane.description ? <p className="reaction-chamber-shell__lane-description">{lane.description}</p> : null}
                    </div>
                  </div>
                  <div className="reaction-chamber-shell__lane-meta">
                    <span>{lane.badgeCount} รายการ</span>
                    {lane.previewLabels.length > 0 ? (
                      <span>{lane.previewLabels.join(" · ")}</span>
                    ) : (
                      <span>อ่านผ่านสรุปและหลักฐานในกราฟ</span>
                    )}
                  </div>
                </button>
              ))}
            </section>

            <ChamberTenGodPanel roleBadges={roleBadges} />
          </section>

          <section className="reaction-chamber-shell__evidence" aria-label="graph evidence pane">
            <div className="reaction-chamber-shell__evidence-head">
              <div>
                <p className="reaction-chamber-shell__lane-kicker">{doctrine.evidenceTitle}</p>
                <h2>{activeLane?.title ?? doctrine.evidenceTitle}</h2>
                <p>{activeLane?.description ?? doctrine.evidenceSummary}</p>
              </div>
            </div>
            <ReactionChamberCanvas
              graph={graph}
              legendItems={doctrine.legendItems}
              onSelectionChange={setSelection}
            />
            {variant === "docked" && (
              <ChamberInspector
                selection={selection}
                variant="docked"
                title={activeLane ? `หลักฐานของ ${activeLane.title}` : doctrine.evidenceTitle}
                summary={activeLane?.description ?? doctrine.evidenceSummary}
                onClose={() => setSelection(null)}
              />
            )}
          </section>
        </div>

        {variant === "sheet" && (
          <ChamberInspector
            selection={selection}
            variant="sheet"
            title={activeLane ? `หลักฐานของ ${activeLane.title}` : doctrine.evidenceTitle}
            summary={activeLane?.description ?? doctrine.evidenceSummary}
            onClose={() => setSelection(null)}
          />
        )}
      </main>
    </ReactFlowProvider>
  );
}
