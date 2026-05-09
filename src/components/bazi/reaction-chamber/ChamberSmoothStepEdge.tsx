import { BaseEdge, EdgeLabelRenderer, Position } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";

type FlowCycleType = "generating" | "controlling" | "neutral";
type FlowDirection = "outward" | "inward" | "none" | "both";

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

  const isVerticalPath =
    sourcePosition === Position.Top || sourcePosition === Position.Bottom ||
    targetPosition === Position.Top || targetPosition === Position.Bottom;

  const distanceX = Math.abs(tx - sx);
  const distanceY = Math.abs(ty - sy);
  const distance = isVerticalPath ? distanceX : distanceY;
  // Exaggerate scale non-linearly for longer distances to push them out of the dense center
  const distanceScale = Math.max(1, Math.pow(distance / 100, 1.3));

  // Rainbow/Hammock effect: bend the curve outwards perpendicular to the handle direction
  // For vertical paths (Top/Bottom handles), the primary movement is Y. We bend them along X.
  // For horizontal paths (Left/Right handles), the primary movement is X. We bend them along Y.
  // Increased base multiplier to 2.2 for more aggressive separation
  const bulge = offset !== 0 ? Math.sign(offset) * Math.abs(offset) * 2.2 * distanceScale : 0;

  let edgePath = "";
  let labelX = (sx + tx) / 2;
  let labelY = (sy + ty) / 2;

  if (isVerticalPath) {
    // Vertical path: Top to Bottom or Bottom to Top
    // Control points are pushed along Y by React Flow normally, we add a bulge along X
    const sourceDirY = sourcePosition === Position.Bottom ? 1 : -1;
    const targetDirY = targetPosition === Position.Top ? -1 : 1;
    const absY = Math.max(Math.abs(ty - sy), 50); // minimum curve depth
    const c1x = sx + bulge;
    const c1y = sy + (absY * 0.4 * sourceDirY);
    const c2x = tx + bulge;
    const c2y = ty + (absY * 0.4 * targetDirY);
    edgePath = `M ${sx},${sy} C ${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
    labelX = (c1x + c2x) / 2;
    labelY = (c1y + c2y) / 2;
  } else {
    // Horizontal path: Left to Right or Right to Left
    const sourceDirX = sourcePosition === Position.Right ? 1 : -1;
    const targetDirX = targetPosition === Position.Left ? -1 : 1;
    const absX = Math.max(Math.abs(tx - sx), 50);
    const c1x = sx + (absX * 0.4 * sourceDirX);
    const c1y = sy + bulge;
    const c2x = tx + (absX * 0.4 * targetDirX);
    const c2y = ty + bulge;
    edgePath = `M ${sx},${sy} C ${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
    labelX = (c1x + c2x) / 2;
    labelY = (c1y + c2y) / 2;
  }

  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (!RF_INTERNAL.has(k)) {
      filtered[k] = v;
    }
  }

  // Mootech Semantics: Combine base classes with semantic states
  const className = ("className" in rest && typeof rest.className === "string") ? rest.className : "";
  const isDimmed = className.includes("chamber-edge--dimmed");
  const edgeClasses = [
    "chamber-edge",
    selected ? "chamber-edge--selected" : "",
    isDimmed ? "chamber-edge--dimmed" : "",
    data?.flowCycleType ? `chamber-edge--cycle-${data.flowCycleType}` : "",
  ].filter(Boolean).join(" ");

  return (
    <g className={edgeClasses}>
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
