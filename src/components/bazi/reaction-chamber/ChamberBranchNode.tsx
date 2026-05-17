"use client";

import { Handle, Position } from "@xyflow/react";
import { AnimatePresence, motion } from "motion/react";

import type { SemanticBranchNodeData } from "@/lib/bazi/semantic-chamber-graph";
import { ELEMENT_COLORS_TH, ELEMENT_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";

type ChamberBranchNodeProps = {
  data: SemanticBranchNodeData & { isDimmed?: boolean };
  selected?: boolean;
};

export function ChamberBranchNode({ data, selected }: ChamberBranchNodeProps) {
  const focalClass = data.isFocal ? " chamber-branch-node--focal" : "";
  const selectedClass = selected ? " chamber-branch-node--selected" : "";
  const expandedClass = selected ? " chamber-branch-node--expanded" : "";
  const dimmedClass = data.isDimmed ? " chamber-branch-node--dimmed" : "";
  const elementColor = ELEMENT_COLORS_TH[data.element] ?? "#9f5320";

  return (
    <motion.div
      className={`chamber-branch-node${focalClass}${selectedClass}${expandedClass}${dimmedClass}`}
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

      <span className="chamber-branch-node__glyph" style={{ color: elementColor }}>{data.branch}</span>
      <span className="chamber-branch-node__translation">{data.branchTranslation ?? ELEMENT_LABELS_TH[data.element as keyof typeof ELEMENT_LABELS_TH] ?? data.element}</span>
      <span className="chamber-branch-node__stage">{data.stageDisplay ?? "-"}</span>
      {data.markerLabels.length > 0 && <span className="chamber-branch-node__marker-count">ดาว {data.markerLabels.length}</span>}
      <AnimatePresence initial={false}>
        {selected && data.hiddenStems.length > 0 && (
          <motion.div
            className="chamber-branch-node__drawer"
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <span className="chamber-branch-node__drawer-label">ราศีแฝง</span>
            <span className="chamber-branch-node__drawer-value">{data.hiddenStems.join(" · ")}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <span className="chamber-branch-node__pillar">{data.pillarLabel}</span>
    </motion.div>
  );
}
