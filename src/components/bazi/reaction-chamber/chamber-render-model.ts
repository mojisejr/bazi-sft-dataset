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

function isReactionEdge(edge: SemanticEdge): boolean {
  return edge.data.layer === "inter-pillar-reaction";
}

function isElementFlowEdge(edge: SemanticEdge): boolean {
  return edge.data.layer === "element-flow";
}

function resolveEdgeType(edge: SemanticEdge): string {
  if (isReactionEdge(edge) || isElementFlowEdge(edge)) {
    return "chamberBezier";
  }

  return "smoothstep";
}

function resolveEdgeZIndex(edge: SemanticEdge): number {
  if (isElementFlowEdge(edge)) return 10;
  if (edge.data.layer === "shen-sha-overlay") return 18;
  if (isReactionEdge(edge)) return 20;

  return 6;
}

function buildReactFlowNode(
  graphNode: SemanticNode,
  layoutPositions: ChamberLayoutPositions,
): Node {
  const position = layoutPositions.get(graphNode.id) ?? graphNode.position;

  return {
    id: graphNode.id,
    type: graphNode.type,
    data: graphNode.data as unknown as Record<string, unknown>,
    position,
    draggable: false,
    selectable: true,
  } satisfies Node;
}

function buildReactFlowEdge(edge: SemanticEdge): Edge {
  const flowDirection = isElementFlowEdge(edge)
    ? (edge.data as unknown as { flowDirection?: string }).flowDirection
    : undefined;

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label,
    className: edge.className,
    data: edge.data as unknown as Record<string, unknown>,
    selectable: true,
    focusable: true,
    type: resolveEdgeType(edge),
    zIndex: resolveEdgeZIndex(edge),
    interactionWidth: isReactionEdge(edge) ? 20 : 12,
    ...(isReactionEdge(edge)
      ? { markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 } }
      : {}),
    ...(isElementFlowEdge(edge) && flowDirection === "outward"
      ? { markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 } }
      : {}),
    ...(isElementFlowEdge(edge) && flowDirection === "inward"
      ? { markerStart: { type: MarkerType.ArrowClosed, width: 12, height: 12 } }
      : {}),
  } satisfies Edge;
}

export function buildChamberRenderModel(
  graph: SemanticChamberGraph,
  layoutPositions: ChamberLayoutPositions,
): ChamberRenderModel {
  return {
    nodes: graph.nodes.map((node) => buildReactFlowNode(node, layoutPositions)),
    edges: graph.edges.map(buildReactFlowEdge),
  };
}
