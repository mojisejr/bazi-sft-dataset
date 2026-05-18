import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import type { ChamberSelectionState } from "@/lib/bazi/chamber-selection-grammar";
import {
  resolveSemanticEdgeBadgeContract,
  type SemanticChamberGraph,
  type SemanticEdge,
  type SemanticEdgeBadgeContract,
  type SemanticNode,
  type SemanticPillarKey,
} from "@/lib/bazi/semantic-chamber-graph";

export type ChamberBundleRelationType = "ten-god-flow" | "day-master-role" | "interaction" | "element-interaction" | "overlay";

export type ChamberBundleRelationDirection = "outward" | "inward" | "mutual" | "none";

export type ChamberBundleRelationStrength = "primary" | "secondary" | "neutralized";

export type ChamberHiddenStemCue = {
  pillarKey: SemanticPillarKey;
  pillarLabel: string;
  hiddenStems: string[];
};

export type ChamberBundleRelation = {
  edgeId: string;
  badgeId: string;
  layer: SemanticEdge["data"]["layer"];
  relationType: ChamberBundleRelationType;
  direction: ChamberBundleRelationDirection;
  strength: ChamberBundleRelationStrength;
  displayLabel: string;
  detailLabel?: string;
  sourceNodeId: string;
  targetNodeId: string;
  flowFamily?: string;
};

export type ChamberRelationBundle = {
  mode: ChamberSelectionState["mode"];
  revealScope: ChamberSelectionState["revealScope"];
  pairDoctrine: ChamberSelectionState["pairDoctrine"];
  visibleNodeIds: string[];
  visibleEdgeIds: string[];
  hiddenStemCues: ChamberHiddenStemCue[];
  relations: ChamberBundleRelation[];
};

type ResolveChamberRelationBundleInput = {
  selection: ChamberSelectionState;
  graph: SemanticChamberGraph;
  calculatedState: CalculatedStateValue;
};

function resolveVisibleEdges(selection: ChamberSelectionState, graph: SemanticChamberGraph): SemanticEdge[] {
  if (selection.mode === "base") {
    return [];
  }

  if (selection.mode === "single") {
    if (selection.primary?.kind === "edge") {
      return selection.primary.edge ? [selection.primary.edge] : [];
    }

    const primaryNodeId = selection.primary?.kind === "node" ? selection.primary.node.id : null;
    if (!primaryNodeId) {
      return [];
    }

    return graph.edges.filter((edge) => edge.source === primaryNodeId || edge.target === primaryNodeId);
  }

  const selectedNodeIds = new Set(selection.selectedNodes.map((node) => node.id));
  return graph.edges.filter((edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target));
}

function resolveVisibleNodeIds(selection: ChamberSelectionState, visibleEdges: SemanticEdge[]): string[] {
  if (selection.mode === "base") {
    return [];
  }

  if (selection.mode === "single") {
    if (selection.primary?.kind === "node") {
      const ids = new Set<string>([selection.primary.node.id]);
      visibleEdges.forEach((edge) => {
        ids.add(edge.source);
        ids.add(edge.target);
      });
      return Array.from(ids);
    }

    if (selection.primary?.kind === "edge") {
      return [selection.primary.edge.source, selection.primary.edge.target];
    }
  }

  return selection.selectedNodes.map((node) => node.id);
}

function resolveStrength(edge: SemanticEdge): ChamberBundleRelationStrength {
  if (edge.data.badge.status === "neutralized" || edge.data.badge.priority === "neutralized") {
    return "neutralized";
  }

  if (edge.data.badge.priority === "primary") {
    return "primary";
  }

  return "secondary";
}

function resolveDirection(edge: SemanticEdge): ChamberBundleRelationDirection {
  if (edge.data.layer === "element-flow" || edge.data.layer === "element-interaction") {
    const d = edge.data.flowDirection;
    if (d === "both") return "mutual";
    return d ?? "none";
  }

  if (edge.data.layer === "daymaster-meaning") {
    const sourceIsDay = edge.source.endsWith(":day");
    const targetIsDay = edge.target.endsWith(":day");
    if (sourceIsDay && !targetIsDay) {
      return "outward";
    }
    if (!sourceIsDay && targetIsDay) {
      return "inward";
    }
    return "none";
  }

  if (edge.data.layer === "inter-pillar-reaction") {
    return "mutual";
  }

  return "none";
}

function resolveRelationType(edge: SemanticEdge): ChamberBundleRelationType {
  if (edge.data.layer === "element-flow") {
    return "ten-god-flow";
  }

  if (edge.data.layer === "daymaster-meaning") {
    return "day-master-role";
  }

  if (edge.data.layer === "inter-pillar-reaction") {
    return "interaction";
  }

  if (edge.data.layer === "element-interaction") {
    return "element-interaction";
  }

  return "overlay";
}

function resolveBadgeContract(edge: SemanticEdge): SemanticEdgeBadgeContract | null {
  return resolveSemanticEdgeBadgeContract(edge);
}

function resolvePillarKeyFromNode(node: SemanticNode): SemanticPillarKey | null {
  if (node.data.kind === "stem-node" || node.data.kind === "branch-node" || node.data.kind === "pillar") {
    return node.data.pillarKey;
  }

  return node.data.attachedPillarKey;
}

function resolveHiddenStemCues(
  visibleNodeIds: string[],
  graph: SemanticChamberGraph,
  calculatedState: CalculatedStateValue,
): ChamberHiddenStemCue[] {
  const pillarKeys = new Set<SemanticPillarKey>();

  visibleNodeIds.forEach((nodeId) => {
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return;
    }

    const pillarKey = resolvePillarKeyFromNode(node);
    if (pillarKey) {
      pillarKeys.add(pillarKey);
    }
  });

  return Array.from(pillarKeys).map((pillarKey) => {
    const pillar = calculatedState.fourPillars[pillarKey];
    const pillarLabel = graph.nodes.find(
      (node) => (node.data.kind === "stem-node" || node.data.kind === "branch-node") && node.data.pillarKey === pillarKey,
    );

    return {
      pillarKey,
      pillarLabel: pillarLabel && "pillarLabel" in pillarLabel.data ? pillarLabel.data.pillarLabel : pillarKey,
      hiddenStems: pillar.hiddenStems ?? [],
    };
  });
}

function buildBundleRelation(edge: SemanticEdge): ChamberBundleRelation {
  const badgeContract = resolveBadgeContract(edge);

  return {
    edgeId: edge.id,
    badgeId: edge.data.badge.id,
    layer: edge.data.layer,
    relationType: resolveRelationType(edge),
    direction: resolveDirection(edge),
    strength: resolveStrength(edge),
    displayLabel: badgeContract?.relationLabel ?? edge.data.badge.shortLabel ?? edge.data.badge.label,
    detailLabel: badgeContract?.directionLabel,
    sourceNodeId: edge.source,
    targetNodeId: edge.target,
    flowFamily: edge.data.layer === "element-flow" || edge.data.layer === "element-interaction"
      ? badgeContract?.relationLabel ?? edge.data.flowLabel
      : undefined,
  };
}

export function resolveChamberRelationBundle({
  selection,
  graph,
  calculatedState,
}: ResolveChamberRelationBundleInput): ChamberRelationBundle | null {
  if (selection.mode === "base") {
    return null;
  }

  const visibleEdges = resolveVisibleEdges(selection, graph);
  const visibleNodeIds = resolveVisibleNodeIds(selection, visibleEdges);

  return {
    mode: selection.mode,
    revealScope: selection.revealScope,
    pairDoctrine: selection.pairDoctrine,
    visibleNodeIds,
    visibleEdgeIds: visibleEdges.map((edge) => edge.id),
    hiddenStemCues: resolveHiddenStemCues(visibleNodeIds, graph, calculatedState),
    relations: visibleEdges.map(buildBundleRelation),
  };
}
