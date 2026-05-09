import { MarkerType, type Edge, type Node } from "@xyflow/react";

import type {
  SemanticChamberGraph,
  SemanticEdge,
  SemanticNode,
} from "@/lib/bazi/semantic-chamber-graph";
import type { ChamberLayoutPositions } from "@/lib/bazi/chamber-layout";

export type ChamberRenderModel = {
  nodes: Node[];
  edges: Edge[];
};

type ChamberRenderSelectionState = {
  selectedNodeIds?: string[];
  selectedEdgeIds?: string[];
  revealedEdgeIds?: string[];
  hideUnrevealedEdges?: boolean;
};

type ChamberInlineEdgeLabel = {
  relationLabel: string;
  directionLabel: string;
  directionSymbol: string;
  strengthLabel: string;
};

function isReactionEdge(edge: SemanticEdge): boolean {
  return edge.data.layer === "inter-pillar-reaction";
}

function isElementInteractionEdge(edge: SemanticEdge): boolean {
  return edge.data.layer === "element-interaction";
}

function isElementFlowEdge(edge: SemanticEdge): boolean {
  return edge.data.layer === "element-flow";
}

function resolveEdgeType(edge: SemanticEdge): string {
  if (isReactionEdge(edge) || isElementFlowEdge(edge) || isElementInteractionEdge(edge)) {
    return "chamberBezier";
  }

  return "smoothstep";
}

function resolveEdgeZIndex(edge: SemanticEdge): number {
  if (isElementFlowEdge(edge)) return 10;
  if (isElementInteractionEdge(edge)) return 16;
  if (edge.data.layer === "shen-sha-overlay") return 18;
  if (isReactionEdge(edge)) return 20;

  return 6;
}

function resolveEdgeDirectionLabel(edge: SemanticEdge): { label: string; symbol: string } {
  if (edge.data.layer === "element-flow") {
    if (edge.data.flowDirection === "outward") {
      return { label: "ส่งออก", symbol: "→" };
    }
    if (edge.data.flowDirection === "inward") {
      return { label: "รับเข้า", symbol: "←" };
    }
    return { label: "คู่ธาตุ", symbol: "↔" };
  }

  if (edge.data.layer === "element-interaction") {
    return { label: "สัมพันธ์ธาตุ", symbol: "↔" };
  }

  if (edge.data.layer === "daymaster-meaning") {
    const sourceIsDay = edge.source.endsWith(":day");
    const targetIsDay = edge.target.endsWith(":day");

    if (sourceIsDay && !targetIsDay) {
      return { label: "ดิถีส่งออก", symbol: "→" };
    }
    if (!sourceIsDay && targetIsDay) {
      return { label: "ดิถีรับเข้า", symbol: "←" };
    }
  }

  if (edge.data.layer === "inter-pillar-reaction") {
    return { label: "สวนกัน", symbol: "↔" };
  }

  return { label: "พ่วง", symbol: "•" };
}

function resolveEdgeStrengthLabel(edge: SemanticEdge): string {
  if (edge.data.badge.status === "neutralized" || edge.data.badge.priority === "neutralized") {
    return "ล้าง";
  }

  if (edge.data.tier === "secondary") {
    return "รอง";
  }

  if (edge.data.tier === "tertiary") {
    return "เสริม";
  }

  if (edge.data.badge.priority === "primary") {
    return "หลัก";
  }

  return "รอง";
}

function buildInlineEdgeLabel(edge: SemanticEdge): ChamberInlineEdgeLabel | null {
  if (edge.data.layer === "shen-sha-overlay") {
    return null;
  }

  const relationLabel = edge.data.layer === "element-flow" || edge.data.layer === "element-interaction"
    ? edge.data.flowLabel ?? edge.data.badge.shortLabel ?? edge.data.badge.label
    : edge.data.schoolLabel ?? edge.data.badge.shortLabel ?? edge.label ?? edge.data.badge.label;

  const direction = resolveEdgeDirectionLabel(edge);

  return {
    relationLabel,
    directionLabel: direction.label,
    directionSymbol: direction.symbol,
    strengthLabel: resolveEdgeStrengthLabel(edge),
  };
}

function buildReactFlowNode(
  graphNode: SemanticNode,
  layoutPositions: ChamberLayoutPositions,
  selectedNodeIds: Set<string>,
): Node {
  const position = layoutPositions.get(graphNode.id) ?? graphNode.position;

  return {
    id: graphNode.id,
    type: graphNode.type,
    data: graphNode.data as unknown as Record<string, unknown>,
    position,
    draggable: false,
    selectable: true,
    selected: selectedNodeIds.has(graphNode.id),
  } satisfies Node;
}

function buildReactFlowEdge(
  edge: SemanticEdge,
  selectedEdgeIds: Set<string>,
  revealedEdgeIds: Set<string>,
  hideUnrevealedEdges: boolean,
): Edge {
  const flowDirection = isElementFlowEdge(edge)
    ? (edge.data as unknown as { flowDirection?: string }).flowDirection
    : undefined;
  const inlineLabel = buildInlineEdgeLabel(edge);
  const isSelected = selectedEdgeIds.has(edge.id);
  const isRevealed = revealedEdgeIds.has(edge.id) || isSelected;

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label,
    className: edge.className,
    data: {
      ...(edge.data as unknown as Record<string, unknown>),
      inlineLabel: inlineLabel?.relationLabel,
      inlineDirectionLabel: inlineLabel?.directionLabel,
      inlineDirectionSymbol: inlineLabel?.directionSymbol,
      inlineStrengthLabel: inlineLabel?.strengthLabel,
      showInlineLabel: isRevealed && Boolean(inlineLabel),
      isRevealed,
    },
    selectable: true,
    focusable: true,
    selected: isSelected,
    type: resolveEdgeType(edge),
    zIndex: resolveEdgeZIndex(edge),
    interactionWidth: isReactionEdge(edge) ? 20 : 12,
    hidden: hideUnrevealedEdges && !isRevealed,
    ...(isReactionEdge(edge)
      ? { markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10 } }
      : {}),
    ...(isElementInteractionEdge(edge)
      ? {
          markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10 },
          ...(edge.data.flowDirection === "both"
            ? { markerStart: { type: MarkerType.ArrowClosed, width: 10, height: 10 } }
            : {}),
        }
      : {}),
    ...(isElementFlowEdge(edge) && flowDirection === "outward"
      ? { markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8 } }
      : {}),
    ...(isElementFlowEdge(edge) && flowDirection === "inward"
      ? { markerStart: { type: MarkerType.ArrowClosed, width: 8, height: 8 } }
      : {}),
  } satisfies Edge;
}

export function buildChamberRenderModel(
  graph: SemanticChamberGraph,
  layoutPositions: ChamberLayoutPositions,
  selectionState: ChamberRenderSelectionState = {},
): ChamberRenderModel {
  const selectedNodeIds = new Set(selectionState.selectedNodeIds ?? []);
  const selectedEdgeIds = new Set(selectionState.selectedEdgeIds ?? []);
  const revealedEdgeIds = new Set(selectionState.revealedEdgeIds ?? []);

  return {
    nodes: graph.nodes.map((node) => buildReactFlowNode(node, layoutPositions, selectedNodeIds)),
    edges: graph.edges.map((edge) => buildReactFlowEdge(
      edge,
      selectedEdgeIds,
      revealedEdgeIds,
      selectionState.hideUnrevealedEdges ?? false,
    )),
  };
}
