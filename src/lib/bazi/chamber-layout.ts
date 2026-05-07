import type {
  SemanticChamberGraph,
  SemanticEdge,
  SemanticPillarKey,
} from "@/lib/bazi/semantic-chamber-graph";

export type ChamberLayoutPositions = Map<string, { x: number; y: number }>;

type ChamberNodePositionMap = Record<SemanticPillarKey, { x: number; y: number }>;

const GRID_PILLAR_ORDER: SemanticPillarKey[] = ["hour", "day", "month", "year"];
const GRID_COLUMN_SPACING = 180;
const GRID_ROW_SPACING = 200;
const GRID_ORIGIN_X = 100;
const GRID_STEM_ROW_Y = 100;
const GRID_BRANCH_ROW_Y = GRID_STEM_ROW_Y + GRID_ROW_SPACING;
const GRID_MARKER_ROW_Y = GRID_BRANCH_ROW_Y + GRID_ROW_SPACING + 40;

function gridColumnIndex(pillarKey: SemanticPillarKey): number {
  return GRID_PILLAR_ORDER.indexOf(pillarKey);
}

function computeStemNodePositions(): ChamberNodePositionMap {
  const positions: Partial<ChamberNodePositionMap> = {};

  for (const key of GRID_PILLAR_ORDER) {
    const col = gridColumnIndex(key);
    positions[key] = {
      x: GRID_ORIGIN_X + col * GRID_COLUMN_SPACING,
      y: GRID_STEM_ROW_Y,
    };
  }

  return positions as ChamberNodePositionMap;
}

function computeBranchNodePositions(): ChamberNodePositionMap {
  const positions: Partial<ChamberNodePositionMap> = {};

  for (const key of GRID_PILLAR_ORDER) {
    const col = gridColumnIndex(key);
    positions[key] = {
      x: GRID_ORIGIN_X + col * GRID_COLUMN_SPACING,
      y: GRID_BRANCH_ROW_Y,
    };
  }

  return positions as ChamberNodePositionMap;
}

function computeMarkerPosition(pillarKey: SemanticPillarKey): { x: number; y: number } {
  const col = gridColumnIndex(pillarKey);
  return {
    x: GRID_ORIGIN_X + col * GRID_COLUMN_SPACING,
    y: GRID_MARKER_ROW_Y,
  };
}

function shouldOffsetLayer(layer: SemanticEdge["data"]["layer"]): boolean {
  return layer === "inter-pillar-reaction";
}

function getOffsetGroupKey(edge: SemanticEdge): string {
  return `${edge.source}->${edge.target}`;
}

function getOffsetStride(layer: SemanticEdge["data"]["layer"]): number {
  if (layer === "inter-pillar-reaction") {
    return 18;
  }

  return 0;
}

function assignParallelOffsets(edges: SemanticEdge[]): void {
  const groups = new Map<string, SemanticEdge[]>();

  for (const edge of edges) {
    edge.data.parallelOffset = 0;
    if (!shouldOffsetLayer(edge.data.layer)) continue;

    const key = getOffsetGroupKey(edge);
    const group = groups.get(key);
    if (group) {
      group.push(edge);
    } else {
      groups.set(key, [edge]);
    }
  }

  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const stride = getOffsetStride(group[0].data.layer);
    for (let index = 0; index < group.length; index += 1) {
      group[index].data.parallelOffset = index * stride;
    }
  }
}

export function computeChamberLayoutPositions(graph: SemanticChamberGraph): ChamberLayoutPositions {
  const positions = new Map<string, { x: number; y: number }>();
  const stemPositions = computeStemNodePositions();
  const branchPositions = computeBranchNodePositions();

  for (const node of graph.nodes) {
    if (node.data.kind === "stem-node") {
      positions.set(node.id, stemPositions[node.data.pillarKey]);
    } else if (node.data.kind === "branch-node") {
      positions.set(node.id, branchPositions[node.data.pillarKey]);
    } else if (node.data.kind === "marker" && node.data.attachedPillarKey) {
      positions.set(node.id, computeMarkerPosition(node.data.attachedPillarKey));
    } else if (node.data.kind === "marker") {
      positions.set(node.id, { x: 640, y: 620 });
    } else {
      positions.set(node.id, node.position);
    }
  }

  return positions;
}

export function resolveChamberInteractionHandles(
  sourcePillarKey: SemanticPillarKey,
  targetPillarKey: SemanticPillarKey,
  sourceIsStem: boolean,
  targetIsStem: boolean,
): { sourceHandle: string; targetHandle: string } {
  const sourceCol = gridColumnIndex(sourcePillarKey);
  const targetCol = gridColumnIndex(targetPillarKey);
  const delta = targetCol - sourceCol;
  const isCrossType = sourceIsStem !== targetIsStem;

  if (isCrossType && delta === 0) {
    return { sourceHandle: "source-bottom", targetHandle: "target-top" };
  }

  if (isCrossType) {
    if (Math.abs(delta) >= 2) {
      return { sourceHandle: "source-top", targetHandle: "target-top" };
    }
    if (delta < 0) {
      return { sourceHandle: "source-left", targetHandle: "target-right" };
    }
    return { sourceHandle: "source-right", targetHandle: "target-left" };
  }

  if (sourceIsStem) {
    if (Math.abs(delta) >= 2) {
      return { sourceHandle: "source-top", targetHandle: "target-top" };
    }
    if (delta < 0) {
      return { sourceHandle: "source-left", targetHandle: "target-right" };
    }
    return { sourceHandle: "source-right", targetHandle: "target-left" };
  }

  if (Math.abs(delta) >= 2) {
    return { sourceHandle: "source-top", targetHandle: "target-top" };
  }
  if (delta < 0) {
    return { sourceHandle: "source-left", targetHandle: "target-right" };
  }
  return { sourceHandle: "source-right", targetHandle: "target-left" };
}

export function assignChamberGraphLayout(graph: SemanticChamberGraph): ChamberLayoutPositions {
  const positions = computeChamberLayoutPositions(graph);

  for (const node of graph.nodes) {
    const position = positions.get(node.id);
    if (position) {
      node.position = position;
    }
  }

  assignParallelOffsets(graph.edges);

  return positions;
}

export const __testing__ = {
  computeStemNodePositions,
  computeBranchNodePositions,
  computeMarkerPosition,
  shouldOffsetLayer,
  getOffsetGroupKey,
  getOffsetStride,
};
