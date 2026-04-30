"use client";

import { Handle, Position } from "@xyflow/react";

import type { ChamberPillarNodeData } from "@/lib/bazi/base-chart-chamber-graph";

type ChamberPillarNodeProps = {
  data: ChamberPillarNodeData;
  selected?: boolean;
};

export function ChamberPillarNode({ data, selected }: ChamberPillarNodeProps) {
  const focalClass = data.isFocal ? " chamber-node-pillar--focal" : "";
  const selectedClass = selected ? " chamber-node-pillar--selected" : "";

  return (
    <div className={`chamber-node-pillar${focalClass}${selectedClass}`}>
      <Handle type="target" position={Position.Left} className="chamber-node-handle" />
      <Handle type="source" position={Position.Right} className="chamber-node-handle" />

      <p className="chamber-node-pillar__kicker">{data.pillarLabel}</p>
      <div className="chamber-node-pillar__glyphs">
        <span className="chamber-node-pillar__stem">{data.stem}</span>
        <span className="chamber-node-pillar__branch">{data.branch}</span>
      </div>
      {(data.stemTranslation || data.branchTranslation) && (
        <p className="chamber-node-pillar__translation">
          {[data.stemTranslation, data.branchTranslation].filter(Boolean).join(" / ")}
        </p>
      )}

      {data.roleBadges.length > 0 && (
        <ul className="chamber-node-pillar__roles">
          {data.roleBadges.slice(0, 3).map((badge) => (
            <li key={badge.id} className={`chamber-role-chip chamber-role-chip--${badge.status}`}>
              {badge.shortLabel ?? badge.label}
            </li>
          ))}
          {data.roleBadges.length > 3 && (
            <li className="chamber-role-chip chamber-role-chip--more">+{data.roleBadges.length - 3}</li>
          )}
        </ul>
      )}
    </div>
  );
}
