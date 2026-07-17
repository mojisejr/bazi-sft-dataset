// Hour Rectification — traverse.ts (#hour-rectification-engine, v1). Walks the question BANK for a
// specific user: picks which question to ask next (adaptive, based on THIS user's 12 hour
// signatures), collects the evidence their answers imply, and decides when enough has been asked.
// Pure + fully deterministic — no LLM/engine/file access — so the stateless API can replay the
// whole session from just (birthDate, answeredSteps) on every request and land in the same place.

import { accumulateEvidence, matchSignature, type TargetSignature } from "./match";
import {
  SIGNATURE_DIMENSIONS,
  type AnsweredStep,
  type BankQuestion,
  type HourSignature,
  type QuestionBank,
  type SignatureVote,
} from "./types";

// Ask at least MIN, stop early once a clear leader emerges, never exceed MAX_ASK — and MAX_DEPTH is
// the hard "≤10 questions, guaranteed" ceiling validate-tree also enforces the bank can honour.
export const MIN_QUESTIONS_TO_ASK = 5;
export const MAX_QUESTIONS_TO_ASK = 8;
export const MAX_QUESTION_DEPTH = 10;
// A leader is "clear enough" to stop early once its score beats second place by this margin.
export const EARLY_STOP_MARGIN = 2;
// How close to the leader an hour must be to still count as a contender worth discriminating. Kept
// as its own constant (even though it currently equals EARLY_STOP_MARGIN) so tuning the stop
// threshold and the focus window stay independent knobs.
export const CONTENDER_WINDOW = 2;

// Collect the SignatureVotes implied by a set of answered steps. Unknown question/option ids are
// skipped (they contribute no evidence) — malformed trails are caught separately by validateTrail.
export function accumulateAnswers(
  bank: QuestionBank,
  answered: readonly AnsweredStep[],
): SignatureVote[] {
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  const votes: SignatureVote[] = [];
  for (const step of answered) {
    const question = byId.get(step.questionId);
    const option = question?.options.find((candidate) => candidate.id === step.optionId);
    if (option) votes.push(...option.evidence);
  }
  return votes;
}

// Which dimensions a question actually probes (union across its options' evidence).
function questionDimensions(question: BankQuestion): Set<string> {
  const dims = new Set<string>();
  for (const option of question.options) {
    for (const vote of option.evidence) dims.add(vote.dimension);
  }
  return dims;
}

// Discrimination score of a candidate question against the current field of contender hours:
// how many contender PAIRS this question could tell apart (i.e. the two hours differ on at least
// one dimension the question probes). A question that separates many still-tied leaders is asked
// first; one that can't distinguish anyone left is worthless. Deterministic, no lookahead needed.
function discriminationScore(
  question: BankQuestion,
  contenders: readonly HourSignature[],
): number {
  const dims = questionDimensions(question);
  if (dims.size === 0) return 0;
  let distinguishablePairs = 0;
  for (let i = 0; i < contenders.length; i += 1) {
    for (let j = i + 1; j < contenders.length; j += 1) {
      const a = contenders[i].signature;
      const b = contenders[j].signature;
      const separates = [...dims].some(
        (dim) => a[dim as keyof typeof a] !== b[dim as keyof typeof b],
      );
      if (separates) distinguishablePairs += 1;
    }
  }
  return distinguishablePairs;
}

// The current contender field = hours still tied for or near the lead given the evidence so far.
// Before any answers every hour is a contender; once scores diverge we focus discrimination on the
// hours that actually still matter (top score and anyone within EARLY_STOP_MARGIN of it).
function currentContenders(
  target: TargetSignature,
  hourSignatures: readonly HourSignature[],
): HourSignature[] {
  const match = matchSignature(target, hourSignatures);
  if (!match || match.score === 0) return [...hourSignatures];
  const topScore = match.ranked[0].score;
  const keep = new Set(
    match.ranked
      .filter((r) => topScore - r.score <= CONTENDER_WINDOW)
      .map((r) => r.hourBranch),
  );
  const focused = hourSignatures.filter((h) => keep.has(h.hourBranch));
  return focused.length >= 2 ? focused : [...hourSignatures];
}

// Pick the next question to ask, or null when the session should stop. Deterministic given
// (bank, hourSignatures, answered): same inputs → same choice, which is what makes stateless replay
// exact. Tie-break on equal discrimination is by questionId (ascending) for stability.
export function selectNextQuestion(
  bank: QuestionBank,
  hourSignatures: readonly HourSignature[],
  answered: readonly AnsweredStep[],
): BankQuestion | null {
  const askedIds = new Set(answered.map((step) => step.questionId));
  const askedCount = askedIds.size;

  // Hard ceilings first. MAX_QUESTION_DEPTH is the absolute "≤10, guaranteed" backstop; the
  // MAX_QUESTIONS_TO_ASK soft cap normally fires earlier, but the depth check is what actually
  // enforces the named ceiling if that soft cap is ever raised.
  if (askedCount >= MAX_QUESTION_DEPTH) return null;
  if (askedCount >= MAX_QUESTIONS_TO_ASK) return null;

  const target = accumulateEvidence(accumulateAnswers(bank, answered));

  // Early stop: enough asked AND a clear leader.
  if (askedCount >= MIN_QUESTIONS_TO_ASK) {
    const match = matchSignature(target, hourSignatures);
    if (match && match.margin >= EARLY_STOP_MARGIN) return null;
  }

  const contenders = currentContenders(target, hourSignatures);
  const remaining = bank.questions.filter((q) => !askedIds.has(q.id));
  if (remaining.length === 0) return null; // bank exhausted (validate-tree guards bankSize ≥ MAX)

  let best: BankQuestion | null = null;
  let bestScore = -1;
  for (const question of remaining) {
    const score = discriminationScore(question, contenders);
    if (
      score > bestScore ||
      (score === bestScore && best !== null && question.id < best.id)
    ) {
      best = question;
      bestScore = score;
    }
  }

  // If nothing left can separate the remaining contenders (score 0), asking more is pointless once
  // the minimum is met; before the minimum, still ask (a low-info question is better than none for
  // reaching a stable trail length). Return the best candidate regardless when below MIN.
  if (bestScore <= 0 && askedCount >= MIN_QUESTIONS_TO_ASK) return null;
  return best;
}

export type WalkOutcome =
  | { status: "question"; question: BankQuestion; questionNumber: number }
  | { status: "result"; target: TargetSignature }
  | { status: "error"; reason: string };

// One runtime step: validate the trail so far, then either surface the next question or signal the
// session is complete (caller runs match against the user's real 12 hours).
export function walkBank(
  bank: QuestionBank,
  hourSignatures: readonly HourSignature[],
  answered: readonly AnsweredStep[],
): WalkOutcome {
  const trailError = validateTrail(bank, hourSignatures, answered);
  if (trailError) return { status: "error", reason: trailError };

  const next = selectNextQuestion(bank, hourSignatures, answered);
  if (next) {
    return { status: "question", question: next, questionNumber: answered.length + 1 };
  }
  const target = accumulateEvidence(accumulateAnswers(bank, answered));
  return { status: "result", target };
}

// A trail is only valid if it is EXACTLY the sequence the deterministic selector would have asked
// this user, in order — we replay selectNextQuestion step by step and require each answered
// questionId to be the one it surfaced, with a real option chosen. This is the integrity guarantee
// the AnsweredStep.questionId field exists for (see types.ts): a tampered, reordered, over-long, or
// fabricated trail is rejected (a 400) rather than silently folded into the accumulated signature.
// Because the selector never re-asks a question, duplicate/unknown-id trails fail this check too.
export function validateTrail(
  bank: QuestionBank,
  hourSignatures: readonly HourSignature[],
  answered: readonly AnsweredStep[],
): string | null {
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  for (let i = 0; i < answered.length; i += 1) {
    const step = answered[i];
    const prefix = answered.slice(0, i);
    const expected = selectNextQuestion(bank, hourSignatures, prefix);
    if (!expected) {
      return `trail has more answers than the engine would ask (extra answer at step ${i + 1})`;
    }
    if (expected.id !== step.questionId) {
      return `out-of-sequence trail: step ${i + 1} should answer "${expected.id}" but got "${step.questionId}"`;
    }
    const question = byId.get(step.questionId);
    if (!question || !question.options.some((option) => option.id === step.optionId)) {
      return `unknown option "${step.optionId}" on question "${step.questionId}"`;
    }
  }
  return null;
}

// Convenience for tests/self-consistency: run a fixed sequence of answers straight through and
// report where it lands. Mirrors the API's per-step replay but in one call.
export function replayAnswers(
  bank: QuestionBank,
  hourSignatures: readonly HourSignature[],
  answered: readonly AnsweredStep[],
): WalkOutcome {
  return walkBank(bank, hourSignatures, answered);
}
