"use client";

import { useReactFlow } from "@xyflow/react";

import type { SemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";
import { getSemanticDayFocusNodeIds } from "@/lib/bazi/semantic-chamber-graph";

type ChamberCommandBarProps = {
  title: string;
  onBack: () => void;
  graph: SemanticChamberGraph;
  selectionMode: "base" | "single" | "pair" | "multi";
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
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
    return "เทียบคู่สัมพันธ์";
  }
  if (selectionMode === "multi") {
    return "มองหลายจุดพร้อมกัน";
  }
  if (selectionMode === "single") {
    return "กำลังอ่านจุดเดียว";
  }
  return "ภาพรวมสงบ";
}

export function ChamberCommandBar({
  title,
  onBack,
  graph,
  selectionMode,
  isInspectorOpen,
  onToggleInspector,
}: ChamberCommandBarProps) {
  return (
    <header className="chamber-command-bar" aria-label="chamber command bar">
      <button type="button" onClick={onBack} className="chamber-command-bar__back" aria-label="กลับไปหน้าสรุป">
        ← กลับสรุปดวง
      </button>
      <div className="chamber-command-bar__title-group">
        <p className="chamber-command-bar__title">{title}</p>
        <p className="chamber-command-bar__hint">
          {describeSelectionMode(selectionMode)} · ชี้เพื่อดูปฏิกิริยา คลิกเพื่อขุดรายละเอียด
        </p>
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
        <FocusFitButtons graph={graph} />
      </div>
    </header>
  );
}
