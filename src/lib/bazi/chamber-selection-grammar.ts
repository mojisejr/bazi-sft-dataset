import type { SemanticChamberGraph, SemanticEdge, SemanticNode } from "@/lib/bazi/semantic-chamber-graph";

export type ChamberSelectionMode = "base" | "single" | "pair" | "multi";

export type ChamberRevealScope = "quiet-graph" | "selected-neighborhood" | "pair-bundle" | "cluster-bundle";

export type ChamberSelectionEntity =
  | { kind: "node"; node: SemanticNode }
  | { kind: "edge"; edge: SemanticEdge };

export type ChamberPairSelectionDoctrine = {
  doctrine: "day-master-compare" | "day-pillar-compare" | "anchor-compare";
  includesDayMaster: boolean;
  includesDayPillar: boolean;
  anchorNodeIds: [string, string];
};

export type ChamberSelectionState = {
  mode: ChamberSelectionMode;
  revealScope: ChamberRevealScope;
  selectedNodes: SemanticNode[];
  selectedEdges: SemanticEdge[];
  primary: ChamberSelectionEntity | null;
  pairDoctrine: ChamberPairSelectionDoctrine | null;
};

export const EMPTY_CHAMBER_SELECTION: ChamberSelectionState = {
  mode: "base",
  revealScope: "quiet-graph",
  selectedNodes: [],
  selectedEdges: [],
  primary: null,
  pairDoctrine: null,
};

type BuildChamberSelectionStateInput = {
  graph: SemanticChamberGraph;
  nodeIds?: string[];
  edgeIds?: string[];
};

function sortNodesBySelectionOrder(nodeIds: string[], graph: SemanticChamberGraph): SemanticNode[] {
  return nodeIds
    .map((id) => graph.nodes.find((node) => node.id === id))
    .filter((node): node is SemanticNode => Boolean(node));
}

function sortEdgesBySelectionOrder(edgeIds: string[], graph: SemanticChamberGraph): SemanticEdge[] {
  return edgeIds
    .map((id) => graph.edges.find((edge) => edge.id === id))
    .filter((edge): edge is SemanticEdge => Boolean(edge));
}

function isDayMasterNode(node: SemanticNode): boolean {
  return node.data.kind === "stem-node" && node.data.pillarKey === "day";
}

function isDayPillarNode(node: SemanticNode): boolean {
  return (node.data.kind === "stem-node" || node.data.kind === "branch-node") && node.data.pillarKey === "day";
}

function resolvePairDoctrine(selectedNodes: SemanticNode[]): ChamberPairSelectionDoctrine | null {
  if (selectedNodes.length !== 2) {
    return null;
  }

  const includesDayMaster = selectedNodes.some(isDayMasterNode);
  const includesDayPillar = includesDayMaster || selectedNodes.some(isDayPillarNode);

  let doctrine: ChamberPairSelectionDoctrine["doctrine"] = "anchor-compare";
  if (includesDayMaster) {
    doctrine = "day-master-compare";
  } else if (includesDayPillar) {
    doctrine = "day-pillar-compare";
  }

  const orderedNodes = [...selectedNodes].sort((left, right) => {
    const getPriority = (node: SemanticNode) => {
      if (isDayMasterNode(node)) return 0;
      if (isDayPillarNode(node)) return 1;
      return 2;
    };

    const priorityDelta = getPriority(left) - getPriority(right);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return left.id.localeCompare(right.id);
  });

  return {
    doctrine,
    includesDayMaster,
    includesDayPillar,
    anchorNodeIds: [orderedNodes[0].id, orderedNodes[1].id],
  };
}

export function buildChamberSelectionState({
  graph,
  nodeIds = [],
  edgeIds = [],
}: BuildChamberSelectionStateInput): ChamberSelectionState {
  const selectedNodes = sortNodesBySelectionOrder(nodeIds, graph);
  const selectedEdges = sortEdgesBySelectionOrder(edgeIds, graph);
  const totalSelections = selectedNodes.length + selectedEdges.length;

  if (totalSelections === 0) {
    return EMPTY_CHAMBER_SELECTION;
  }

  if (selectedNodes.length === 2 && selectedEdges.length === 0) {
    return {
      mode: "pair",
      revealScope: "pair-bundle",
      selectedNodes,
      selectedEdges,
      primary: { kind: "node", node: selectedNodes[0] },
      pairDoctrine: resolvePairDoctrine(selectedNodes),
    };
  }

  if (totalSelections === 1) {
    if (selectedNodes.length === 1) {
      return {
        mode: "single",
        revealScope: "selected-neighborhood",
        selectedNodes,
        selectedEdges,
        primary: { kind: "node", node: selectedNodes[0] },
        pairDoctrine: null,
      };
    }

    return {
      mode: "single",
      revealScope: "selected-neighborhood",
      selectedNodes,
      selectedEdges,
      primary: { kind: "edge", edge: selectedEdges[0] },
      pairDoctrine: null,
    };
  }

  return {
    mode: "multi",
    revealScope: "cluster-bundle",
    selectedNodes,
    selectedEdges,
    primary: selectedNodes[0]
      ? { kind: "node", node: selectedNodes[0] }
      : selectedEdges[0]
        ? { kind: "edge", edge: selectedEdges[0] }
        : null,
    pairDoctrine: null,
  };
}
