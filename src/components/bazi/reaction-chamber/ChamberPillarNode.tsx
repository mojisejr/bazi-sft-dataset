"use client";

import { Handle, Position } from "@xyflow/react";

import type { SemanticPillarNodeData } from "@/lib/bazi/semantic-chamber-graph";

type ChamberPillarNodeProps = {
  data: SemanticPillarNodeData;
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

      {data.stageSlots.length > 0 && (
        <dl className="chamber-node-pillar__stages">
          {data.stageSlots.slice(0, 3).map((slot) => (
            <div key={`${slot.source}-${slot.value}`} className="chamber-stage-chip">
              <dt>{slot.label}</dt>
              <dd>{slot.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {data.meaningSlots.length > 0 && (
        <div className="chamber-node-pillar__meaning" aria-label="ดิถีมอง">
          <p>ดิถีมอง</p>
          <ul>
            {data.meaningSlots.slice(0, 4).map((slot) => (
              <li key={slot.badge.id} className={`chamber-role-chip chamber-role-chip--${slot.badge.status}`}>
                <span>{slot.source === "stem" ? "บน" : "ล่าง"}</span>
                <strong>{slot.relationLabel}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
