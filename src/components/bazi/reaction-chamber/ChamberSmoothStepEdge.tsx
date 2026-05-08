import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";

type FlowCycleType = "generating" | "controlling" | "neutral";
type FlowDirection = "outward" | "inward" | "none";

type ChamberBezierEdgeData = {
  parallelOffset?: number;
  schoolLabel?: string;
  tier?: string;
  flowCycleType?: FlowCycleType;
  flowDirection?: FlowDirection;
  flowLabel?: string;
  flowElement?: string;
  inlineLabel?: string;
  inlineDirectionLabel?: string;
  inlineDirectionSymbol?: string;
  inlineStrengthLabel?: string;
  showInlineLabel?: boolean;
  isRevealed?: boolean;
};

const RF_INTERNAL = new Set([
  "id",
  "source",
  "target",
  "sourceHandleId",
  "targetHandleId",
  "selectable",
  "deletable",
  "type",
  "data",
  "style",
  "className",
  "animated",
  "hidden",
  "pathOptions",
  "interactionWidth",
  "ariaLabel",
  "focusable",
  "updatable",
  "onContextMenu",
]);

/**
 * Compute perpendicular offset for bezier control points.
 * For vertical paths (top/bottom handles), shift X.
 * For horizontal paths (left/right handles), shift Y.
 */
function applyBezierOffset(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  offset: number,
): { sx: number; sy: number; tx: number; ty: number } {
  if (offset === 0) {
    return { sx: sourceX, sy: sourceY, tx: targetX, ty: targetY };
  }

  const isVerticalPath =
    sourcePosition === Position.Top || sourcePosition === Position.Bottom ||
    targetPosition === Position.Top || targetPosition === Position.Bottom;

  if (isVerticalPath) {
    // Vertical path: offset perpendicular = shift X
    return {
      sx: sourceX + offset,
      sy: sourceY,
      tx: targetX + offset,
      ty: targetY,
    };
  }

  // Horizontal path: offset perpendicular = shift Y
  return {
    sx: sourceX,
    sy: sourceY + offset,
    tx: targetX,
    ty: targetY + offset,
  };
}

export function ChamberBezierEdge(props: EdgeProps & { data?: ChamberBezierEdgeData }) {
  const {
    sourceX: rawSourceX,
    sourceY: rawSourceY,
    targetX: rawTargetX,
    targetY: rawTargetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
    ...rest
  } = props;

  const offset = data?.parallelOffset ?? 0;
  const { sx, sy, tx, ty } = applyBezierOffset(
    rawSourceX, rawSourceY,
    rawTargetX, rawTargetY,
    sourcePosition, targetPosition,
    offset,
  );

  const arcSpread = offset !== 0 ? Math.sign(offset) * Math.abs(offset) * 0.35 : 0;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy - arcSpread,
    targetX: tx,
    targetY: ty + arcSpread,
    sourcePosition,
    targetPosition,
  });

  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (!RF_INTERNAL.has(k)) {
      filtered[k] = v;
    }
  }

  return (
    <g className={selected ? "chamber-edge--selected" : undefined}>
      <BaseEdge
        path={edgePath}
        {...filtered}
      />
      {data?.showInlineLabel && data.inlineLabel && (
        <EdgeLabelRenderer>
          <div
            className="chamber-edge-inline-label"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
            }}
            data-school={data.schoolLabel}
            data-tier={data.tier ?? ""}
            data-direction={data.inlineDirectionLabel ?? ""}
          >
            <span className="chamber-edge-inline-label__rail">
              <span className="chamber-edge-inline-label__direction">{data.inlineDirectionSymbol ?? "•"}</span>
              <span className="chamber-edge-inline-label__label">{data.inlineLabel}</span>
            </span>
            <span className="chamber-edge-inline-label__meta">
              {data.inlineDirectionLabel}
              {data.inlineStrengthLabel ? ` · ${data.inlineStrengthLabel}` : ""}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}

/** Backward-compat alias */
export const ChamberSmoothStepEdge = ChamberBezierEdge;
