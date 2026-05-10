"use client";

import { Handle, Position } from "@xyflow/react";

import type { SemanticBranchNodeData } from "@/lib/bazi/semantic-chamber-graph";
import { ELEMENT_COLORS_TH, ELEMENT_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";

type ChamberBranchNodeProps = {
  data: SemanticBranchNodeData;
  selected?: boolean;
};

export function ChamberBranchNode({ data, selected }: ChamberBranchNodeProps) {
  const focalClass = data.isFocal ? " chamber-branch-node--focal" : "";
  const selectedClass = selected ? " chamber-branch-node--selected" : "";
  const expandedClass = selected || data.isFocal ? " chamber-branch-node--expanded" : "";
  const elementColor = ELEMENT_COLORS_TH[data.element] ?? "#9f5320";

  return (
    <div className={`chamber-branch-node${focalClass}${selectedClass}${expandedClass}`} style={{ borderColor: elementColor }}>
      <Handle id="target-top" type="target" position={Position.Top} className="chamber-node-handle" />
      <Handle id="target-left" type="target" position={Position.Left} className="chamber-node-handle" />
      <Handle id="target-right" type="target" position={Position.Right} className="chamber-node-handle" />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className="chamber-node-handle" />
      <Handle id="source-top" type="source" position={Position.Top} className="chamber-node-handle" />
      <Handle id="source-left" type="source" position={Position.Left} className="chamber-node-handle" />
      <Handle id="source-right" type="source" position={Position.Right} className="chamber-node-handle" />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className="chamber-node-handle" />

      <span className="chamber-branch-node__glyph" style={{ color: elementColor }}>{data.branch}</span>
      <span className="chamber-branch-node__translation">{data.branchTranslation ?? ELEMENT_LABELS_TH[data.element as keyof typeof ELEMENT_LABELS_TH] ?? data.element}</span>
      {data.hiddenStems.length > 0 && (
        <span className="chamber-branch-node__hidden-stems" aria-label={`hidden stems ${data.hiddenStems.join(" ")}`}>
          <span className="chamber-branch-node__hidden-compact">{data.hiddenStemCompactLabel ?? data.hiddenStems.join(" · ")}</span>
          <span className="chamber-branch-node__hidden-expanded">{data.hiddenStems.join(" · ")}</span>
        </span>
      )}
      <span className="chamber-branch-node__pillar">{data.pillarLabel}</span>
    </div>
  );
}
