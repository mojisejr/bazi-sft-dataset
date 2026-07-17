// Hour Rectification — match.ts (#hour-rectification-engine, v1). THE HEART of v1: given the
// signature evidence a user's answers accumulated, score it against that user's OWN 12 real hour
// signatures and pick the best-matching ยาม. Pure logic — no LLM, no engine, no file access.
//
// Why this file exists separately from generation: the behaviour→property MAPPING (which the LLM
// authors and which is not yet empirically proven) lives in the question bank. The property→hour
// MATCHING here is deterministic element math over the user's real chart. Keeping them apart means
// when real Jaroensak rules replace the LLM mapping, only the bank changes — this scorer does not.

import {
  HOUR_BRANCHES,
  SIGNATURE_DIMENSIONS,
  type HourBranch,
  type HourSignature,
  type SignatureDimension,
  type SignatureVote,
  type StructuralSignature,
} from "./types";

// Accumulated evidence: per dimension, a weighted vote map value → summed weight.
export type TargetSignature = Record<SignatureDimension, Record<string, number>>;

function emptyTarget(): TargetSignature {
  return {
    stemElement: {},
    stemRole: {},
    branchRole: {},
    strengthBucket: {},
  };
}

// Fold a flat list of votes (from every answered option) into the weighted target. Later votes add
// to earlier ones — answering two questions that both point at "metal" reinforces metal.
export function accumulateEvidence(votes: readonly SignatureVote[]): TargetSignature {
  const target = emptyTarget();
  for (const vote of votes) {
    if (!(vote.dimension in target)) continue; // defensive: unknown dimension contributes nothing
    const bucket = target[vote.dimension];
    bucket[vote.value] = (bucket[vote.value] ?? 0) + vote.weight;
  }
  return target;
}

// How many distinct dimensions the target actually has any evidence on (used for tie-breaking:
// prefer the hour that matches the user on MORE independent axes, not just higher raw weight).
function dimensionsMatched(target: TargetSignature, signature: StructuralSignature): number {
  let count = 0;
  for (const dimension of SIGNATURE_DIMENSIONS) {
    const value = signature[dimension];
    if ((target[dimension][value] ?? 0) > 0) count += 1;
  }
  return count;
}

// Raw score: sum, over the 4 dimensions, of the weight the accumulated evidence placed on THIS
// hour's actual signature value. An hour whose element/role/strength the answers kept pointing at
// scores high; an hour they never pointed at scores 0.
export function scoreHour(target: TargetSignature, signature: StructuralSignature): number {
  let score = 0;
  for (const dimension of SIGNATURE_DIMENSIONS) {
    const value = signature[dimension];
    score += target[dimension][value] ?? 0;
  }
  return score;
}

export type RankedHour = {
  hourBranch: HourBranch;
  score: number;
  dimensionsMatched: number;
};

export type MatchResult = {
  hourBranch: HourBranch;
  score: number;
  // Second-place gap — feeds the runtime "is a clear leader emerging yet?" stop condition, and is
  // honest signal for the beta confidence (a thin margin is a weak call).
  margin: number;
  ranked: RankedHour[];
};

// Deterministic argmax over the user's 12 real hour signatures. NEVER returns empty as long as at
// least one hour is supplied (the whole "every signature-combo maps to a ยาม" guarantee) — with no
// evidence at all every hour scores 0 and the tie-break falls through to HOUR_BRANCHES order.
//
// Tie-break order (all deterministic, no randomness):
//   1. higher raw score
//   2. more independent dimensions matched (breadth of agreement beats one heavy axis)
//   3. canonical HOUR_BRANCHES order (final, guarantees a stable single answer)
export function matchSignature(
  target: TargetSignature,
  hourSignatures: readonly HourSignature[],
): MatchResult | null {
  if (hourSignatures.length === 0) return null;

  const branchOrder = new Map<HourBranch, number>(
    HOUR_BRANCHES.map((branch, index) => [branch, index]),
  );

  const ranked: RankedHour[] = hourSignatures
    .map((hour) => ({
      hourBranch: hour.hourBranch,
      score: scoreHour(target, hour.signature),
      dimensionsMatched: dimensionsMatched(target, hour.signature),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.dimensionsMatched !== a.dimensionsMatched) {
        return b.dimensionsMatched - a.dimensionsMatched;
      }
      return (branchOrder.get(a.hourBranch) ?? 0) - (branchOrder.get(b.hourBranch) ?? 0);
    });

  const winner = ranked[0];
  const runnerUp = ranked[1];
  const margin = runnerUp ? winner.score - runnerUp.score : winner.score;

  return {
    hourBranch: winner.hourBranch,
    score: winner.score,
    margin,
    ranked,
  };
}
