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

  // Same here, we do not drop the element-interaction layer.
  return edges;
}
