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
  return badges.filter((badge) => {
    // Canonical Reactions Protection
    if (
      badge.semanticKind !== "element-generate" &&
      badge.semanticKind !== "element-control"
    ) {
      return true; // Always render canonical reactions
    }

    if (config.quietGraph) {
      return false; // Suppress noise
    }

    return true;
  });
}

/**
 * Alternatively, apply directly to semantic edges so that they can be fully omitted or hidden.
 */
export function filterEdgesBySchoolRevealPolicy(
  edges: SemanticEdge[],
  config: SchoolRevealPolicyConfig = { quietGraph: true }
): SemanticEdge[] {
  if (!config.quietGraph) {
    return edges;
  }

  return edges.filter((edge) => {
    if (edge.data.layer === "element-interaction") {
      return false;
    }
    return true;
  });
}
