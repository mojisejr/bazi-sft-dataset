// Hour Rectification — run-step use-case (#hour-rectification-engine, RUNTIME, no LLM at all).
//
// Stateless by design, matching public-calc/route.ts: the client holds the answer trail (array of
// chosen option ids, in order) and resends it whole on every step — the server just replays it
// deterministically against the pre-generated network. No DB, no server-side session.
import { readQuestionNetwork } from "./adapters/network-repository";
import { buildRectificationTrace, type RectificationTrace } from "./domain/trace";
import { traverseFullPath } from "./domain/traverse";
import { HOUR_BRANCH_LABELS_TH, type HourBranch, type QuestionNetwork } from "./domain/types";

export type RunStepInput = {
  // All option ids chosen so far, in order. Empty array = just starting (asks the root question).
  answeredOptionIds: string[];
};

export type RunStepResult =
  | {
      status: "question";
      nodeId: string;
      question: string;
      options: { id: string; label: string }[];
      questionNumber: number;
    }
  | {
      status: "result";
      hourBranch: HourBranch;
      hourLabel: string;
      trace: RectificationTrace;
      // Not over-promising accuracy — see #hour-rectification-engine testing-3-levels: real-world
      // accuracy against actual people is not yet measured as of this generation.
      confidence: "beta";
    }
  | { status: "error"; reason: string };

export function runRectificationStep(
  network: QuestionNetwork,
  input: RunStepInput,
): RunStepResult {
  const traversal = traverseFullPath(network, input.answeredOptionIds);

  if (traversal.status === "error") {
    return { status: "error", reason: traversal.reason };
  }

  if (traversal.status === "result") {
    const trace = buildRectificationTrace(network, traversal.trail, traversal.hourBranch);
    return {
      status: "result",
      hourBranch: traversal.hourBranch,
      hourLabel: HOUR_BRANCH_LABELS_TH[traversal.hourBranch],
      trace,
      confidence: "beta",
    };
  }

  return {
    status: "question",
    nodeId: traversal.nextNode.id,
    question: traversal.nextNode.question,
    options: traversal.nextNode.options.map((option) => ({ id: option.id, label: option.label })),
    questionNumber: input.answeredOptionIds.length + 1,
  };
}

export function loadRectificationNetwork(repoRoot?: string): QuestionNetwork {
  return readQuestionNetwork(repoRoot);
}
