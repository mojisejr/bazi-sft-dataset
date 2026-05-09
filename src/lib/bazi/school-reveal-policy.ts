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

  // Find all pillars that are involved in a stem-combination
  const combinationLockedNodeIds = new Set<string>();
  edges.forEach((edge) => {
    if (edge.data.badge.semanticKind === "stem-combination") {
      combinationLockedNodeIds.add(edge.source);
      combinationLockedNodeIds.add(edge.target);
    }
  });

  return edges.filter((edge) => {
    // We only prune generation and control edges
    if (edge.data.badge.semanticKind !== "element-generate" && edge.data.badge.semanticKind !== "element-control") {
      return true;
    }

    const sourceParts = edge.source.split(":");
    const targetParts = edge.target.split(":");
    const sourcePillar = sourceParts[1];
    const targetPillar = targetParts[1];
    const sourceIsStem = sourceParts[0] === "stem";
    const targetIsBranch = targetParts[0] === "branch";

    // Rule 1: Drop Same-Pillar (การส่งเสริม/พิฆาตในเสาเดียวกัน)
    // Sinsaes treat intra-pillar relationships as implicit structural context, not macroscopic graph flows.
    if (sourcePillar === targetPillar) {
      return false;
    }

    // Rule 2: Drop Downward Flow (จากบนลงล่าง)
    // Qi naturally flows upwards from roots to stems, or across the same layer.
    // Downward generation is often seen as "draining" rather than active support.
    if (sourceIsStem && targetIsBranch) {
      return false;
    }

    // Rule 3: Apply Combination Lock (ฮะแล้วลืมเกิด/พิฆาต)
    // If a Heavenly Stem is involved in an active "Combination", its energy is locked.
    if (combinationLockedNodeIds.has(edge.source)) {
      return false;
    }

    return true;
  });
}
