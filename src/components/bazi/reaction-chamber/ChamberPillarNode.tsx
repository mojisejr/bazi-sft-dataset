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
  const modeClass = ` chamber-node-pillar--${data.displayMode}`;
  const upperSlot = data.stageSlots.find((slot) => slot.source === "upper");
  const sittingSlot = data.stageSlots.find((slot) => slot.source === "sitting");
  const lowerSlot = data.stageSlots.find((slot) => slot.source === "lower");

  if (data.displayMode === "day-anchor") {
    return (
      <div className={`chamber-node-pillar${focalClass}${selectedClass}${modeClass}`}>
        <Handle id="top" type="target" position={Position.Top} className="chamber-node-handle" />
        <Handle id="left" type="target" position={Position.Left} className="chamber-node-handle" />
        <Handle id="right" type="target" position={Position.Right} className="chamber-node-handle" />
        <Handle id="bottom" type="target" position={Position.Bottom} className="chamber-node-handle" />
        <Handle id="top" type="source" position={Position.Top} className="chamber-node-handle" />
        <Handle id="left" type="source" position={Position.Left} className="chamber-node-handle" />
        <Handle id="right" type="source" position={Position.Right} className="chamber-node-handle" />
        <Handle id="bottom" type="source" position={Position.Bottom} className="chamber-node-handle" />

        <p className="chamber-node-pillar__kicker">หลักวัน · ดิถี</p>
        <div className="chamber-node-pillar__anchor-core">
          <span className="chamber-node-pillar__stem">{data.stem}</span>
          <span className="chamber-node-pillar__translation">{data.stemTranslation}</span>
        </div>
        <div className="chamber-node-pillar__anchor-branch">
          <span className="chamber-node-pillar__branch">{data.branch}</span>
          <span>{data.branchTranslation}</span>
        </div>
        {lowerSlot && (
          <div className="chamber-stage-chip chamber-stage-chip--lower-only">
            <dt>ราศีล่าง</dt>
            <dd>{lowerSlot.value}</dd>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`chamber-node-pillar${focalClass}${selectedClass}${modeClass}`}>
      <Handle id="top" type="target" position={Position.Top} className="chamber-node-handle" />
      <Handle id="left" type="target" position={Position.Left} className="chamber-node-handle" />
      <Handle id="right" type="target" position={Position.Right} className="chamber-node-handle" />
      <Handle id="bottom" type="target" position={Position.Bottom} className="chamber-node-handle" />
      <Handle id="top" type="source" position={Position.Top} className="chamber-node-handle" />
      <Handle id="right" type="source" position={Position.Right} className="chamber-node-handle" />
      <Handle id="left" type="source" position={Position.Left} className="chamber-node-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="chamber-node-handle" />

      <p className="chamber-node-pillar__kicker">{data.pillarLabel}</p>
      <dl className="chamber-node-pillar__ribbon-stack">
        {upperSlot && (
          <div className="chamber-stage-chip chamber-stage-chip--upper">
            <dt>{upperSlot.label}</dt>
            <dd>{upperSlot.value}</dd>
          </div>
        )}
        <div className="chamber-node-pillar__glyph-block chamber-node-pillar__glyph-block--stem">
          <span className="chamber-node-pillar__stem">{data.stem}</span>
          <span>{data.stemTranslation}</span>
        </div>
        {sittingSlot && (
          <div className="chamber-stage-chip chamber-stage-chip--sitting">
            <dt>{sittingSlot.label}</dt>
            <dd>{sittingSlot.value}</dd>
          </div>
        )}
        <div className="chamber-node-pillar__glyph-block chamber-node-pillar__glyph-block--branch">
          <span className="chamber-node-pillar__branch">{data.branch}</span>
          <span>{data.branchTranslation}</span>
        </div>
        <div className="chamber-node-pillar__stage-row">
          {lowerSlot && (
            <div className="chamber-stage-chip chamber-stage-chip--lower">
              <dt>{lowerSlot.label}</dt>
              <dd>{lowerSlot.value}</dd>
            </div>
          )}
        </div>
      </dl>

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
