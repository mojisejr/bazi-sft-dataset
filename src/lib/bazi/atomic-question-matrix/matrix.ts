import {
  BAZI_ATOMIC_QUESTION_CANONICAL_HOME,
  BAZI_ATOMIC_QUESTION_MATRIX_VERSION,
  BAZI_ATOMIC_QUESTION_REVIEW_DOCUMENT_PATH,
} from "./constants";
import { crossDomainDecomposition } from "./cross-domain-rules";
import {
  atomicQuestionEntries,
  type BaziAtomicQuestionJobId,
} from "./entries";
import { buildAtomicQuestionMatrixLookup } from "./lookup";
import { BaziAtomicQuestionMatrixSchema } from "./schemas";
import type {
  BaziAtomicQuestionMatrix,
  BaziAtomicQuestionMatrixEntry,
} from "./types";

export const BAZI_ATOMIC_QUESTION_MATRIX: BaziAtomicQuestionMatrix =
  BaziAtomicQuestionMatrixSchema.parse({
    version: BAZI_ATOMIC_QUESTION_MATRIX_VERSION,
    canonicalHome: BAZI_ATOMIC_QUESTION_CANONICAL_HOME,
    reviewDocumentPath: BAZI_ATOMIC_QUESTION_REVIEW_DOCUMENT_PATH,
    taxonomySource: {
      sourceTable: "bazi_faq_taxonomies",
      sourceBuilder: "buildFaqTaxonomies",
      sourceFile: "src/lib/bazi/canonical-knowledge.ts",
      policy: [
        "bazi_faq_taxonomies remains the upstream phrase inventory and coarse domain evidence.",
        "This matrix narrows taxonomy rows into atomic doctrine jobs instead of replacing the FAQ corpus.",
        "Each atomic entry binds back through primaryIntents and optional rawTypeLabels so later phases can preserve taxonomy provenance.",
        "Cross-domain prompts must decompose into multiple atomic jobs before packet composition.",
      ],
    },
    crossDomainDecomposition,
    entries: atomicQuestionEntries,
  });

export const BAZI_ATOMIC_QUESTION_MATRIX_BY_JOB_ID =
  buildAtomicQuestionMatrixLookup(
    BAZI_ATOMIC_QUESTION_MATRIX.entries,
  ) as Record<BaziAtomicQuestionJobId, BaziAtomicQuestionMatrixEntry>;