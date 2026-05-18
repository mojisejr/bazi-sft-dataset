import type { BaseChartReactionBadgeValue } from "./schema-types";
import type { SemanticEdge } from "./semantic-chamber-graph";

export type SchoolRevealFlowFamily = "all" | "output" | "wealth" | "power" | "resource" | "companion";

export type SchoolRevealPolicyConfig = {
  quietGraph: boolean;
  showStructure: boolean;
  showEnergy: boolean;
  showReaction: boolean;
  showOverlay: boolean;
  focusedRoleFamily: SchoolRevealFlowFamily;
};

export const DEFAULT_SCHOOL_REVEAL_POLICY_CONFIG: SchoolRevealPolicyConfig = {
  quietGraph: true,
  showStructure: true,
  showEnergy: true,
  showReaction: true,
  showOverlay: true,
  focusedRoleFamily: "all",
};

export function resolveSchoolRevealPolicyConfig(
  config: Partial<SchoolRevealPolicyConfig> = {},
): SchoolRevealPolicyConfig {
  return {
    ...DEFAULT_SCHOOL_REVEAL_POLICY_CONFIG,
    ...config,
  };
}

/**
 * Filter computed_truth into visible_truth.
 */
export function applySchoolRevealPolicy(
  badges: BaseChartReactionBadgeValue[],
  config: Partial<SchoolRevealPolicyConfig> = DEFAULT_SCHOOL_REVEAL_POLICY_CONFIG,
): BaseChartReactionBadgeValue[] {
  const policy = resolveSchoolRevealPolicyConfig(config);

  if (!policy.showEnergy) {
    return badges.filter(
      (badge) => badge.semanticKind !== "element-generate" && badge.semanticKind !== "element-control",
    );
  }

  // In quietGraph mode, we currently DO NOT drop element-generate / element-control.
  // The user explicitly expects "เซียงแซ" (element-generate) to connect across the chart.
  // We will preserve them so the graph shows generating flows accurately.
  return badges;
}

function isStructureEdge(edge: SemanticEdge): boolean {
  return edge.data.layer === "daymaster-meaning";
}

function isEnergyEdge(edge: SemanticEdge): boolean {
  return edge.data.layer === "element-flow" || edge.data.layer === "element-interaction";
}

function isReactionEdge(edge: SemanticEdge): boolean {
  return edge.data.layer === "inter-pillar-reaction";
}

function isOverlayEdge(edge: SemanticEdge): boolean {
  return edge.data.layer === "shen-sha-overlay";
}

function matchesFocusedRoleFamily(edge: SemanticEdge, focusedRoleFamily: SchoolRevealFlowFamily): boolean {
  if (focusedRoleFamily === "all") {
    return true;
  }

  return edge.data.flowCategory === focusedRoleFamily;
}

export function filterEdgesBySchoolRevealPolicy(
  edges: SemanticEdge[],
  config: Partial<SchoolRevealPolicyConfig> = DEFAULT_SCHOOL_REVEAL_POLICY_CONFIG,
): SemanticEdge[] {
  const policy = resolveSchoolRevealPolicyConfig(config);

  const pillarOrder = ["hour", "day", "month", "year"];

  function resolveNodeParts(nodeId: string) {
    const [kind, pillarKey] = nodeId.split(":");
    return { kind, pillarKey };
  }

  function isAdjacentPillar(sourcePillar: string, targetPillar: string) {
    return Math.abs(pillarOrder.indexOf(sourcePillar) - pillarOrder.indexOf(targetPillar)) === 1;
  }

  return edges.filter((edge) => {
    if (!policy.showStructure && isStructureEdge(edge)) {
      return false;
    }

    if (!policy.showEnergy && isEnergyEdge(edge)) {
      return false;
    }

    if (!policy.showReaction && isReactionEdge(edge)) {
      return false;
    }

    if (!policy.showOverlay && isOverlayEdge(edge)) {
      return false;
    }

    if (edge.data.layer === "element-flow") {
      if (!matchesFocusedRoleFamily(edge, policy.focusedRoleFamily)) {
        return false;
      }

      return policy.focusedRoleFamily !== "all" || !policy.quietGraph;
    }

    if (edge.data.layer === "daymaster-meaning") {
      return !policy.quietGraph;
    }

    if (edge.data.layer === "element-interaction") {
      if (!matchesFocusedRoleFamily(edge, policy.focusedRoleFamily)) {
        return false;
      }

      // Focused role-family mode should foreground the canonical role lanes,
      // not flood the graph with school-facing elemental interaction rails.
      if (policy.focusedRoleFamily !== "all") {
        return false;
      }
    }

    // Drop Daymaster role lines in quiet graph, as they are now in the summary modal
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
