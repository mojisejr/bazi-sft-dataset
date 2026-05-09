"use client";

import { useReactFlow } from "@xyflow/react";

import type { SemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";
import { getSemanticDayFocusNodeIds } from "@/lib/bazi/semantic-chamber-graph";
import type { ChamberLayerToggles } from "@/lib/bazi/chamber-presentation-store";

type ChamberCommandBarProps = {
  title: string;
  onBack: () => void;
  graph: SemanticChamberGraph;
  selectionMode: "base" | "single" | "pair" | "multi";
  isInspectorOpen: boolean;
  isRoleSummaryOpen: boolean;
  isRawMatrixOpen: boolean;
  layerToggles: ChamberLayerToggles;
  onToggleInspector: () => void;
  onToggleRoleSummary: () => void;
  onToggleRawMatrix: () => void;
  onToggleLayer: (layer: keyof ChamberLayerToggles) => void;
};

function FocusFitButtons({ graph }: Pick<ChamberCommandBarProps, "graph">) {
  const reactFlowInstance = useReactFlow();

  function handleFitAll() {
    reactFlowInstance.fitView({ padding: 0.25, duration: 350 });
  }

  function handleFocusDayPillar() {
    const focusableNodeIds = getSemanticDayFocusNodeIds(graph);
    const node = focusableNodeIds
      .map((nodeId) => reactFlowInstance.getNode(nodeId))
      .find(Boolean);

    if (node) {
      reactFlowInstance.setCenter(node.position.x + (node.width ?? 80) / 2, node.position.y + (node.height ?? 80) / 2, {
        zoom: 1.1,
        duration: 350,
      });
    }
  }

  return (
    <div className="chamber-command-bar__viewport-actions">
      <button type="button" onClick={handleFitAll} className="chamber-command-bar__action">
        ดูทั้งหมด
      </button>
      <button type="button" onClick={handleFocusDayPillar} className="chamber-command-bar__action">
        โฟกัสดิถี
      </button>
    </div>
  );
}

function describeSelectionMode(selectionMode: ChamberCommandBarProps["selectionMode"]): string {
  if (selectionMode === "pair") {
    return "โหมดเทียบคู่";
  }
  if (selectionMode === "multi") {
    return "โหมดหลายจุด";
  }
  if (selectionMode === "single") {
    return "โหมดจุดเดียว";
  }
  return "กราฟสงบ";
}

export function ChamberCommandBar({
  title,
  onBack,
  graph,
  selectionMode,
  isInspectorOpen,
  isRoleSummaryOpen,
  isRawMatrixOpen,
  layerToggles,
  onToggleInspector,
  onToggleRoleSummary,
  onToggleRawMatrix,
  onToggleLayer,
}: ChamberCommandBarProps) {
  return (
    <header className="chamber-command-bar" aria-label="chamber command bar">
      <button type="button" onClick={onBack} className="chamber-command-bar__back" aria-label="กลับไปหน้าสรุป">
        ← กลับสรุปดวง
      </button>
      <div className="chamber-command-bar__title-group">
        <p className="chamber-command-bar__title">{title}</p>
        <p className="chamber-command-bar__hint">
          {describeSelectionMode(selectionMode)} · กด Shift/Cmd/Ctrl เพื่อเทียบหลายจุด
        </p>
      </div>
      <div className="chamber-command-bar__layer-toggles">
        <label className="chamber-command-bar__toggle-label">
          <input
            type="checkbox"
            checked={layerToggles.showStructure}
            onChange={() => onToggleLayer("showStructure")}
          />
          โครงสร้าง (Structure)
        </label>
        <label className="chamber-command-bar__toggle-label">
          <input
            type="checkbox"
            checked={layerToggles.showEnergy}
            onChange={() => onToggleLayer("showEnergy")}
          />
          พลังงาน (Energy)
        </label>
        <label className="chamber-command-bar__toggle-label">
          <input
            type="checkbox"
            checked={layerToggles.showOverlay}
            onChange={() => onToggleLayer("showOverlay")}
          />
          ดาวประกอบ (Overlay)
        </label>
      </div>
      <div className="chamber-command-bar__viewport-actions">
        <button
          type="button"
          onClick={onToggleInspector}
          className="chamber-command-bar__action"
          aria-pressed={isInspectorOpen}
        >
          {isInspectorOpen ? "ซ่อนรายละเอียด" : "เปิดรายละเอียด"}
        </button>
        <button
          type="button"
          onClick={onToggleRoleSummary}
          className="chamber-command-bar__action"
          aria-pressed={isRoleSummaryOpen}
        >
          {isRoleSummaryOpen ? "ซ่อนสรุปธาตุ" : "สรุปธาตุ"}
        </button>
        <button
          type="button"
          onClick={onToggleRawMatrix}
          className="chamber-command-bar__action"
          aria-pressed={isRawMatrixOpen}
        >
          {isRawMatrixOpen ? "ซ่อนตารางปฏิกิริยา" : "ตารางปฏิกิริยา"}
        </button>
        <FocusFitButtons graph={graph} />
      </div>
    </header>
  );
}
