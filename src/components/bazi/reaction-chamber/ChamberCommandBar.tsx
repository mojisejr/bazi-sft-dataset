"use client";

import { useReactFlow } from "@xyflow/react";

type ChamberCommandBarProps = {
  kicker?: string;
  title: string;
  subtitle?: string;
  summary?: string;
  onBack: () => void;
};

function FocusFitButtons() {
  const reactFlowInstance = useReactFlow();

  function handleFitAll() {
    reactFlowInstance.fitView({ padding: 0.25, duration: 350 });
  }

  function handleFocusDayPillar() {
    const node = reactFlowInstance.getNode("pillar:day");
    if (node) {
      reactFlowInstance.setCenter(node.position.x + (node.width ?? 220) / 2, node.position.y + (node.height ?? 220) / 2, {
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

export function ChamberCommandBar({ kicker, title, subtitle, summary, onBack }: ChamberCommandBarProps) {
  return (
    <header className="chamber-command-bar" aria-label="chamber command bar">
      <button type="button" onClick={onBack} className="chamber-command-bar__back" aria-label="กลับไปหน้าสรุป">
        ← กลับสรุปดวง
      </button>
      <div className="chamber-command-bar__heading">
        {kicker ? <p className="chamber-command-bar__kicker">{kicker}</p> : null}
        <p className="chamber-command-bar__title">{title}</p>
        {subtitle ? <p className="chamber-command-bar__subtitle">{subtitle}</p> : null}
        {summary ? <p className="chamber-command-bar__summary">{summary}</p> : null}
      </div>
      <FocusFitButtons />
    </header>
  );
}
