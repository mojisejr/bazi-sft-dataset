"use client";

import { Panel } from "@xyflow/react";
import { useChamberPresentationStore } from "@/lib/bazi/chamber-presentation-store";

export function ChamberLayerTogglesPanel() {
  const layerToggles = useChamberPresentationStore((state) => state.layerToggles);
  const toggleLayer = useChamberPresentationStore((state) => state.toggleLayer);

  return (
    <Panel position="bottom-left" className="chamber-layer-panel">
      <div className="chamber-layer-panel__container">
        <h4 className="chamber-layer-panel__title">ระดับวิชา (Layer)</h4>
        <div className="chamber-layer-panel__buttons">
          <button
            type="button"
            className={`chamber-layer-panel__button ${layerToggles.showStructure ? "chamber-layer-panel__button--active" : ""}`}
            onClick={() => toggleLayer("showStructure")}
            data-layer="structure"
          >
            <span className="chamber-layer-panel__icon">⬡</span>
            โครงสร้าง
          </button>
          
          <button
            type="button"
            className={`chamber-layer-panel__button ${layerToggles.showEnergy ? "chamber-layer-panel__button--active" : ""}`}
            onClick={() => toggleLayer("showEnergy")}
            data-layer="energy"
          >
            <span className="chamber-layer-panel__icon">≈</span>
            พลังงาน
          </button>

          <button
            type="button"
            className={`chamber-layer-panel__button ${layerToggles.showOverlay ? "chamber-layer-panel__button--active" : ""}`}
            onClick={() => toggleLayer("showOverlay")}
            data-layer="overlay"
          >
            <span className="chamber-layer-panel__icon">✧</span>
            ดาวประกอบ
          </button>
        </div>
      </div>
    </Panel>
  );
}
