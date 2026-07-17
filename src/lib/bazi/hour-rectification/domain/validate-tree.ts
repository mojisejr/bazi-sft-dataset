// Hour Rectification — structural validation of a generated question network
// (#hour-rectification-engine). This is the file the whole "≤10 questions, guaranteed" promise
// rests on: it's code, not a hope that the LLM followed instructions. Pure, no LLM/engine/file
// access — takes a QuestionNetwork value in, returns a report out.

import { HOUR_BRANCHES, type HourBranch, type QuestionNetwork } from "./types";

// "≤10 ข้อ เด็ดขาด" — a path may ask at most this many questions before a result is required.
export const MAX_QUESTION_DEPTH = 10;
export const MIN_QUESTION_OPTIONS = 2;

export type ValidationIssue =
  | { code: "MISSING_ROOT"; nodeId: string }
  | { code: "DANGLING_NODE_REF"; fromNodeId: string; optionId: string; toNodeId: string }
  | { code: "TOO_FEW_OPTIONS"; nodeId: string; optionCount: number }
  | { code: "DUPLICATE_OPTION_ID"; nodeId: string; optionId: string }
  | { code: "DEPTH_EXCEEDED"; path: string[]; depth: number }
  | { code: "CYCLE_DETECTED"; path: string[] }
  | { code: "UNREACHABLE_HOUR_BRANCH"; hourBranch: HourBranch }
  | { code: "UNREACHABLE_NODE"; nodeId: string };

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
  maxDepthObserved: number;
  reachableHourBranches: HourBranch[];
};

export function validateQuestionNetwork(network: QuestionNetwork): ValidationResult {
  const issues: ValidationIssue[] = [];
  const reachableBranches = new Set<HourBranch>();
  const reachableNodeIds = new Set<string>();
  let maxDepthObserved = 0;

  const rootNode = network.nodes[network.rootNodeId];
  if (!rootNode) {
    issues.push({ code: "MISSING_ROOT", nodeId: network.rootNodeId });
    return { valid: false, issues, maxDepthObserved: 0, reachableHourBranches: [] };
  }

  // Per-node sanity: option count, duplicate ids, dangling refs to nodes that don't exist.
  for (const [nodeId, node] of Object.entries(network.nodes)) {
    if (node.options.length < MIN_QUESTION_OPTIONS) {
      issues.push({ code: "TOO_FEW_OPTIONS", nodeId, optionCount: node.options.length });
    }
    const seenOptionIds = new Set<string>();
    for (const option of node.options) {
      if (seenOptionIds.has(option.id)) {
        issues.push({ code: "DUPLICATE_OPTION_ID", nodeId, optionId: option.id });
      }
      seenOptionIds.add(option.id);
      if (option.next.kind === "question" && !network.nodes[option.next.nodeId]) {
        issues.push({
          code: "DANGLING_NODE_REF",
          fromNodeId: nodeId,
          optionId: option.id,
          toNodeId: option.next.nodeId,
        });
      }
    }
  }

  // DFS from root, tracking the CURRENT PATH (not a global visited set) so a node reachable via
  // two different paths at two different depths is checked correctly on each, and any node that
  // reappears within its own ancestor chain is a genuine cycle (would never terminate at runtime).
  function dfs(nodeId: string, depth: number, pathNodeIds: readonly string[]): void {
    if (pathNodeIds.includes(nodeId)) {
      issues.push({ code: "CYCLE_DETECTED", path: [...pathNodeIds, nodeId] });
      return;
    }
    reachableNodeIds.add(nodeId);
    maxDepthObserved = Math.max(maxDepthObserved, depth);

    // depth = how many questions were already asked to arrive here. This node would be
    // question #(depth+1) — if depth already reached the max, this node itself is one too many.
    if (depth >= MAX_QUESTION_DEPTH) {
      issues.push({ code: "DEPTH_EXCEEDED", path: [...pathNodeIds, nodeId], depth: depth + 1 });
      return;
    }

    const node = network.nodes[nodeId];
    if (!node) return; // already reported as a dangling ref above

    const nextPath = [...pathNodeIds, nodeId];
    for (const option of node.options) {
      if (option.next.kind === "result") {
        reachableBranches.add(option.next.hourBranch);
        maxDepthObserved = Math.max(maxDepthObserved, depth + 1);
      } else if (network.nodes[option.next.nodeId]) {
        dfs(option.next.nodeId, depth + 1, nextPath);
      }
      // dangling refs already reported in the per-node pass above — don't double-report here.
    }
  }

  dfs(network.rootNodeId, 0, []);

  for (const hourBranch of HOUR_BRANCHES) {
    if (!reachableBranches.has(hourBranch)) {
      issues.push({ code: "UNREACHABLE_HOUR_BRANCH", hourBranch });
    }
  }

  for (const nodeId of Object.keys(network.nodes)) {
    if (!reachableNodeIds.has(nodeId)) {
      issues.push({ code: "UNREACHABLE_NODE", nodeId });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    maxDepthObserved,
    reachableHourBranches: Array.from(reachableBranches),
  };
}
