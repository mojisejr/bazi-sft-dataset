import type { BaseChartReactionBadgeValue } from "./schema-types";
import type { SemanticEdge } from "./semantic-chamber-graph";

export type SchoolRevealPolicyConfig = {
  quietGraph: boolean;
};

/**
 * Filter computed_truth into visible_truth.
 */
export function applySchoolRevealPolicy(
  badges: BaseChartReactionBadgeValue[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: SchoolRevealPolicyConfig = { quietGraph: true }
): BaseChartReactionBadgeValue[] {
  // In quietGraph mode, we currently DO NOT drop element-generate / element-control.
  // The user explicitly expects "เซียงแซ" (element-generate) to connect across the chart.
  // We will preserve them so the graph shows generating flows accurately.
  return badges;
}

export function filterEdgesBySchoolRevealPolicy(
  edges: SemanticEdge[],
  config: SchoolRevealPolicyConfig = { quietGraph: true }
): SemanticEdge[] {
  if (!config.quietGraph) {
    return edges;
  }

  const pillarOrder = ["hour", "day", "month", "year"];

  function resolveNodeParts(nodeId: string) {
    const [kind, pillarKey] = nodeId.split(":");
    return { kind, pillarKey };
  }

  function isAdjacentPillar(sourcePillar: string, targetPillar: string) {
    return Math.abs(pillarOrder.indexOf(sourcePillar) - pillarOrder.indexOf(targetPillar)) === 1;
  }

  return edges.filter((edge) => {
    // Drop Daymaster role lines in quiet graph, as they are now in the summary modal
    if (edge.data.layer === "element-flow" || edge.data.layer === "daymaster-meaning") {
      return false;
    }

    if (edge.data.layer !== "element-interaction") {
      return true;
    }

    const { kind: sourceKind, pillarKey: sourcePillar } = resolveNodeParts(edge.source);
    const { kind: targetKind, pillarKey: targetPillar } = resolveNodeParts(edge.target);
    const isGenerating = edge.data.flowCycleType === "generating";
    const isSamePillar = sourcePillar === targetPillar;

    // Rule 1: Tong Gen survives in the graph when the line is vertical and nourishing.
    if (isSamePillar) {
      return isGenerating && sourceKind !== targetKind;
    }

    // Rule 2: Adjacency survives for both generating and controlling lanes.
    if (isAdjacentPillar(sourcePillar, targetPillar)) {
      return true;
    }

    // Rule 3: Non-adjacent controls are too noisy for the Master's view.
    if (!isGenerating) {
      return false;
    }

    // Rule 4: Continuous Xiang Sheng may bridge non-adjacent pillars.
    return true;
  });
}
