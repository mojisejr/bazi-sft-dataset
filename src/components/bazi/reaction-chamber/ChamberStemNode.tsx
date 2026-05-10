"use client";

import { Handle, Position } from "@xyflow/react";

import type { SemanticStemNodeData } from "@/lib/bazi/semantic-chamber-graph";
import { ELEMENT_COLORS_TH, ELEMENT_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";

type ChamberStemNodeProps = {
  data: SemanticStemNodeData;
  selected?: boolean;
};

export function ChamberStemNode({ data, selected }: ChamberStemNodeProps) {
  const focalClass = data.isFocal ? " chamber-stem-node--focal" : "";
  const selectedClass = selected ? " chamber-stem-node--selected" : "";
  const expandedClass = selected || data.isFocal ? " chamber-stem-node--expanded" : "";
  const elementColor = ELEMENT_COLORS_TH[data.element] ?? "#9f5320";

  return (
    <div className={`chamber-stem-node${focalClass}${selectedClass}${expandedClass}`} style={{ borderColor: elementColor }}>
      <Handle id="target-top" type="target" position={Position.Top} className="chamber-node-handle" />
      <Handle id="target-left" type="target" position={Position.Left} className="chamber-node-handle" />
      <Handle id="target-right" type="target" position={Position.Right} className="chamber-node-handle" />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className="chamber-node-handle" />
      <Handle id="source-top" type="source" position={Position.Top} className="chamber-node-handle" />
      <Handle id="source-left" type="source" position={Position.Left} className="chamber-node-handle" />
      <Handle id="source-right" type="source" position={Position.Right} className="chamber-node-handle" />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className="chamber-node-handle" />

      <span className="chamber-stem-node__glyph" style={{ color: elementColor }}>{data.stem}</span>
      <span className="chamber-stem-node__translation">{data.stemTranslation ?? ELEMENT_LABELS_TH[data.element as keyof typeof ELEMENT_LABELS_TH] ?? data.element}</span>
      {data.hiddenStems.length > 0 && (
        <span className="chamber-stem-node__hidden-stems" aria-label={`hidden stems ${data.hiddenStems.join(" ")}`}>
          <span className="chamber-stem-node__hidden-compact">{data.hiddenStemCompactLabel ?? data.hiddenStems.join(" · ")}</span>
          <span className="chamber-stem-node__hidden-expanded">{data.hiddenStems.join(" · ")}</span>
        </span>
      )}
      <span className="chamber-stem-node__pillar">{data.pillarLabel}</span>
    </div>
  );
}
