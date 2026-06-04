import type { BaziAtomicQuestionMatrixEntry } from "./types";

export function buildAtomicQuestionMatrixLookup(
  entries: readonly BaziAtomicQuestionMatrixEntry[],
): Record<string, BaziAtomicQuestionMatrixEntry> {
  return Object.fromEntries(
    entries.map((entry) => [entry.jobId, entry] as const),
  );
}