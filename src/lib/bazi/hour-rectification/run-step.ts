// Hour Rectification — run-step use-case (#hour-rectification-engine, v1 RUNTIME, no LLM at all).
//
// Stateless by design, matching public-calc/route.ts: the client holds the answer trail (the birth
// data + the (questionId, optionId) pairs chosen so far) and resends it whole on every step. The
// server recomputes the user's 12 real hour signatures and replays the deterministic bank walk from
// scratch each request — no DB, no server-side session. The birth data is required because v1 is
// PERSONAL: the same answers map to different ยาม for different people's charts.
import {
  computeHourSignatures,
  type ChartProfileBaseInput,
} from "./adapters/chart-profile-adapter";
import { readQuestionBank } from "./adapters/network-repository";
import { accumulateEvidence, matchSignature } from "./domain/match";
import { buildRectificationTrace, type RectificationTrace } from "./domain/trace";
import { accumulateAnswers, walkBank } from "./domain/traverse";
import {
  HOUR_BRANCH_LABELS_TH,
  type AnsweredStep,
  type HourBranch,
  type QuestionBank,
} from "./domain/types";

export type RunStepInput = ChartProfileBaseInput & {
  // (questionId, optionId) pairs chosen so far, in order. Empty = just starting (asks question #1).
  answeredSteps: AnsweredStep[];
};

export type RunStepResult =
  | {
      status: "question";
      questionId: string;
      question: string;
      options: { id: string; label: string }[];
      questionNumber: number;
    }
  | {
      status: "result";
      hourBranch: HourBranch;
      hourLabel: string;
      trace: RectificationTrace;
      // Not over-promising accuracy — see #hour-rectification-engine testing-3-levels: the
      // behaviour→property mapping is LLM-authored and not yet validated against real people.
      confidence: "beta";
    }
  | { status: "error"; reason: string };

export async function runRectificationStep(
  bank: QuestionBank,
  input: RunStepInput,
): Promise<RunStepResult> {
  const { answeredSteps, ...baseInput } = input;
  const hourSignatures = await computeHourSignatures(baseInput);

  const outcome = walkBank(bank, hourSignatures, answeredSteps);

  if (outcome.status === "error") {
    return { status: "error", reason: outcome.reason };
  }

  if (outcome.status === "question") {
    return {
      status: "question",
      questionId: outcome.question.id,
      question: outcome.question.question,
      options: outcome.question.options.map((option) => ({
        id: option.id,
        label: option.label,
      })),
      questionNumber: outcome.questionNumber,
    };
  }

  // status === "result": score the accumulated signature against the user's real 12 hours.
  const target = outcome.target;
  const match = matchSignature(target, hourSignatures);
  if (!match) {
    return { status: "error", reason: "no hour signatures computed for this birth data" };
  }
  const trace = buildRectificationTrace(bank, answeredSteps, match, target, hourSignatures);
  return {
    status: "result",
    hourBranch: match.hourBranch,
    hourLabel: HOUR_BRANCH_LABELS_TH[match.hourBranch],
    trace,
    confidence: "beta",
  };
}

// Re-exported for callers/tests that want to build the target signature directly (e.g. to assert
// which ยาม a fully-specified answer set resolves to without going through walkBank stepwise).
export { accumulateAnswers, accumulateEvidence };

export function loadRectificationBank(repoRoot?: string): QuestionBank {
  return readQuestionBank(repoRoot);
}
