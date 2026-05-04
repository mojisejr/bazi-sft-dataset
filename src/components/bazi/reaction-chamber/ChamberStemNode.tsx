"use client";

import { Handle, Position } from "@xyflow/react";

import type { SemanticStemNodeData } from "@/lib/bazi/semantic-chamber-graph";

const ELEMENT_COLORS: Record<string, string> = {
  "ไม้": "#4a7c59",
  "ไฟ": "#c45a3c",
  "ดิน": "#b8a070",
  "ทอง": "#a89050",
  "น้ำ": "#5a8fa8",
};

type ChamberStemNodeProps = {
  data: SemanticStemNodeData;
  selected?: boolean;
};

export function ChamberStemNode({ data, selected }: ChamberStemNodeProps) {
  const focalClass = data.isFocal ? " chamber-stem-node--focal" : "";
  const selectedClass = selected ? " chamber-stem-node--selected" : "";
  const elementColor = ELEMENT_COLORS[data.element] ?? "#9f5320";

  return (
    <div className={`chamber-stem-node${focalClass}${selectedClass}`} style={{ borderColor: elementColor }}>
      <Handle id="target-top" type="target" position={Position.Top} className="chamber-node-handle" />
      <Handle id="target-left" type="target" position={Position.Left} className="chamber-node-handle" />
      <Handle id="target-right" type="target" position={Position.Right} className="chamber-node-handle" />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className="chamber-node-handle" />
      <Handle id="source-top" type="source" position={Position.Top} className="chamber-node-handle" />
      <Handle id="source-left" type="source" position={Position.Left} className="chamber-node-handle" />
      <Handle id="source-right" type="source" position={Position.Right} className="chamber-node-handle" />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className="chamber-node-handle" />

      <span className="chamber-stem-node__glyph" style={{ color: elementColor }}>{data.stem}</span>
      <span className="chamber-stem-node__translation">{data.stemTranslation ?? data.element}</span>
      <span className="chamber-stem-node__pillar">{data.pillarLabel}</span>
      {data.tenGod && (
        <span className="chamber-stem-node__ten-god">{data.tenGod}</span>
      )}
    </div>
  );
}
