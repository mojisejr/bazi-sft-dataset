"use client";

import { Handle, Position } from "@xyflow/react";

import type { ChamberMarkerNodeData } from "@/lib/bazi/base-chart-chamber-graph";

type ChamberMarkerNodeProps = {
  data: ChamberMarkerNodeData;
  selected?: boolean;
};

export function ChamberMarkerNode({ data, selected }: ChamberMarkerNodeProps) {
  const selectedClass = selected ? " chamber-node-marker--selected" : "";

  return (
    <div className={`chamber-node-marker${selectedClass}`}>
      <Handle type="target" position={Position.Left} className="chamber-node-handle" />

      <p className="chamber-node-marker__kicker">ตัวประกอบพิเศษ</p>
      <p className="chamber-node-marker__title">{data.badge.shortLabel ?? data.badge.label}</p>
      <p className="chamber-node-marker__meaning">{data.badge.meaningShort}</p>
    </div>
  );
}
