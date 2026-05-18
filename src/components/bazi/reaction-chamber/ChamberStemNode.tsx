"use client";

import { Handle, Position } from "@xyflow/react";
import { motion } from "motion/react";

import type { SemanticStemNodeData } from "@/lib/bazi/semantic-chamber-graph";
import { ELEMENT_COLORS_TH, ELEMENT_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";

type ChamberStemNodeProps = {
  data: SemanticStemNodeData & { isDimmed?: boolean };
  selected?: boolean;
};

export function ChamberStemNode({ data, selected }: ChamberStemNodeProps) {
  const focalClass = data.isFocal ? " chamber-stem-node--focal" : "";
  const selectedClass = selected ? " chamber-stem-node--selected" : "";
  const dimmedClass = data.isDimmed ? " chamber-stem-node--dimmed" : "";
  const elementColor = ELEMENT_COLORS_TH[data.element] ?? "#9f5320";

  return (
    <motion.div
      className={`chamber-stem-node${focalClass}${selectedClass}${dimmedClass}`}
      style={{ borderColor: elementColor }}
      animate={{ opacity: data.isDimmed ? 0.3 : 1, scale: selected ? 1.04 : 1, y: selected ? -2 : 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
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
      {data.tenGod && <span className="chamber-stem-node__cue">{data.tenGod}</span>}
      {data.markerLabels.length > 0 && <span className="chamber-stem-node__marker-count">ดาวประกอบ</span>}
      <span className="chamber-stem-node__pillar">{data.pillarLabel}</span>
    </motion.div>
  );
}
