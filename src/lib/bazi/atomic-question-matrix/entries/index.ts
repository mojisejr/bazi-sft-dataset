import type { BaziAtomicQuestionMatrixEntry } from "../types";

import { foundationAtomicQuestionEntries } from "./foundation";
import { healthAtomicQuestionEntries } from "./health";
import { relationshipAtomicQuestionEntries } from "./relationship";
import { studyAtomicQuestionEntries } from "./study";
import { wealthAtomicQuestionEntries } from "./wealth";
import { workAtomicQuestionEntries } from "./work";

export const atomicQuestionEntries = [
  ...workAtomicQuestionEntries,
  ...wealthAtomicQuestionEntries,
  ...relationshipAtomicQuestionEntries,
  ...studyAtomicQuestionEntries,
  ...healthAtomicQuestionEntries,
  ...foundationAtomicQuestionEntries,
] as const satisfies readonly BaziAtomicQuestionMatrixEntry[];

export type BaziAtomicQuestionJobId =
  (typeof atomicQuestionEntries)[number]["jobId"];