// Hour Rectification — pure tree traversal ("ตอบข้อนี้ → ไปข้อไหนต่อ"). No LLM/engine/file access.

import type { AnsweredStep, HourBranch, QuestionNetwork, QuestionNode } from "./types";

export type StepOutcome =
  | { status: "question"; node: QuestionNode }
  | { status: "result"; hourBranch: HourBranch }
  | { status: "error"; reason: string };

export function startTraversal(network: QuestionNetwork): StepOutcome {
  const rootNode = network.nodes[network.rootNodeId];
  if (!rootNode) {
    return { status: "error", reason: `root node "${network.rootNodeId}" not found` };
  }
  return { status: "question", node: rootNode };
}

// One step: given the node currently being answered and the chosen option, resolve to either the
// next question or a terminal hour-branch result.
export function answerStep(
  network: QuestionNetwork,
  currentNodeId: string,
  optionId: string,
): StepOutcome {
  const node = network.nodes[currentNodeId];
  if (!node) {
    return { status: "error", reason: `node "${currentNodeId}" not found` };
  }

  const option = node.options.find((candidate) => candidate.id === optionId);
  if (!option) {
    return {
      status: "error",
      reason: `option "${optionId}" not found on node "${currentNodeId}"`,
    };
  }

  if (option.next.kind === "result") {
    return { status: "result", hourBranch: option.next.hourBranch };
  }

  const nextNode = network.nodes[option.next.nodeId];
  if (!nextNode) {
    return { status: "error", reason: `next node "${option.next.nodeId}" not found` };
  }
  return { status: "question", node: nextNode };
}

export type FullTraversalResult =
  | { status: "result"; hourBranch: HourBranch; trail: AnsweredStep[] }
  | { status: "error"; reason: string; trail: AnsweredStep[] }
  | { status: "incomplete"; nextNode: QuestionNode; trail: AnsweredStep[] };

// Convenience for tests/self-consistency checks: run a full sequence of option choices from the
// root and report where it lands (result, ran out of answers, or hit an error).
export function traverseFullPath(
  network: QuestionNetwork,
  optionIds: readonly string[],
): FullTraversalResult {
  const root = startTraversal(network);
  if (root.status === "error") {
    return { status: "error", reason: root.reason, trail: [] };
  }

  let currentNodeId = network.rootNodeId;
  const trail: AnsweredStep[] = [];

  for (const optionId of optionIds) {
    const outcome = answerStep(network, currentNodeId, optionId);
    if (outcome.status === "error") {
      return { status: "error", reason: outcome.reason, trail };
    }
    trail.push({ nodeId: currentNodeId, optionId });
    if (outcome.status === "result") {
      return { status: "result", hourBranch: outcome.hourBranch, trail };
    }
    currentNodeId = outcome.node.id;
  }

  const nextNode = network.nodes[currentNodeId];
  return { status: "incomplete", nextNode, trail };
}
