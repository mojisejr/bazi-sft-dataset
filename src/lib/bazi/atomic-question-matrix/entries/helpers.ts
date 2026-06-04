import type { BaziAtomicQuestionMatrixEntry } from "../types";

export function defineAtomicQuestionEntries<
  TEntries extends readonly BaziAtomicQuestionMatrixEntry[],
>(entries: TEntries): TEntries {
  return entries;
}