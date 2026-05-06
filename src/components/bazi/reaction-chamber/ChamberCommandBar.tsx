"use client";

import { useReactFlow } from "@xyflow/react";

import type { SemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";
import { getSemanticDayFocusNodeIds } from "@/lib/bazi/semantic-chamber-graph";

type ChamberCommandBarProps = {
  title: string;
  onBack: () => void;
  graph: SemanticChamberGraph;
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

export function ChamberCommandBar({ title, onBack, graph }: ChamberCommandBarProps) {
  return (
    <header className="chamber-command-bar" aria-label="chamber command bar">
      <button type="button" onClick={onBack} className="chamber-command-bar__back" aria-label="กลับไปหน้าสรุป">
        ← กลับสรุปดวง
      </button>
      <p className="chamber-command-bar__title">{title}</p>
      <FocusFitButtons graph={graph} />
    </header>
  );
}
