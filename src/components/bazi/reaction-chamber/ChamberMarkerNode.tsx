"use client";

import { Handle, Position } from "@xyflow/react";

import type { SemanticMarkerNodeData } from "@/lib/bazi/semantic-chamber-graph";

type ChamberMarkerNodeProps = {
  data: SemanticMarkerNodeData;
  selected?: boolean;
};

export function ChamberMarkerNode({ data, selected }: ChamberMarkerNodeProps) {
  const selectedClass = selected ? " chamber-node-marker--selected" : "";

  return (
    <div className={`chamber-node-marker${selectedClass}`}>
      <Handle id="target-left" type="target" position={Position.Left} className="chamber-node-handle" />

      <span className="chamber-node-marker__label">{data.displayLabel}</span>
    </div>
  );
}
