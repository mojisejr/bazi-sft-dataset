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
      <Handle type="target" position={Position.Left} className="chamber-node-handle" />

      <p className="chamber-node-marker__kicker">ตัวประกอบพิเศษ · ชั้นหลัก</p>
      <p className="chamber-node-marker__title">{data.displayLabel}</p>
      <p className="chamber-node-marker__meaning">{data.badge.meaningShort}</p>
    </div>
  );
}
