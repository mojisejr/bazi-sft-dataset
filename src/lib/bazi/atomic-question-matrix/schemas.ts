import { z } from "zod";

import {
  BAZI_ATOMIC_CANONICAL_BUCKETS,
  BAZI_ATOMIC_QUESTION_CANONICAL_HOME,
  BAZI_ATOMIC_QUESTION_MATRIX_VERSION,
  BAZI_ATOMIC_QUESTION_REVIEW_DOCUMENT_PATH,
  BAZI_ATOMIC_SUPPORT_STATUSES,
} from "./constants";

export const BaziAtomicCanonicalBucketSchema = z.enum(
  BAZI_ATOMIC_CANONICAL_BUCKETS,
);

export const BaziAtomicSupportStatusSchema = z.enum(
  BAZI_ATOMIC_SUPPORT_STATUSES,
);

export const BaziAtomicFaqIntentSchema = z.enum([
  "general",
  "work",
  "study",
  "wealth",
  "love",
  "health",
  "family",
  "other",
  "timing",
]);

export const BaziAtomicFaqBindingSchema = z.object({
  primaryIntents: z.array(BaziAtomicFaqIntentSchema).min(1),
  rawTypeLabels: z.array(z.string().trim().min(1)).min(1).optional(),
  notes: z.string().trim().min(1).optional(),
});

export const BaziAtomicQuestionMatrixEntrySchema = z.object({
  jobId: z.string().trim().min(1),
  canonicalBucket: BaziAtomicCanonicalBucketSchema,
  underlyingJob: z.string().trim().min(1),
  keepSeparateFrom: z.array(z.string().trim().min(1)).default([]),
  faqTaxonomy: BaziAtomicFaqBindingSchema,
  userAsk: z.string().trim().min(1),
  mustAnswer: z.string().trim().min(1),
  mandatoryEvidence: z.array(z.string().trim().min(1)).min(1),
  forbiddenNoise: z.array(z.string().trim().min(1)).min(1),
  readingOrder: z.array(z.string().trim().min(1)).min(1),
  supportStatus: BaziAtomicSupportStatusSchema,
  supportNotes: z.string().trim().min(1).optional(),
});

export const BaziAtomicCrossDomainRuleSchema = z.object({
  ruleId: z.string().trim().min(1),
  promptPattern: z.string().trim().min(1),
  resultPolicy: z.string().trim().min(1),
});

export const BaziAtomicQuestionMatrixSchema = z.object({
  version: z.literal(BAZI_ATOMIC_QUESTION_MATRIX_VERSION),
  canonicalHome: z.literal(BAZI_ATOMIC_QUESTION_CANONICAL_HOME),
  reviewDocumentPath: z.literal(BAZI_ATOMIC_QUESTION_REVIEW_DOCUMENT_PATH),
  taxonomySource: z.object({
    sourceTable: z.literal("bazi_faq_taxonomies"),
    sourceBuilder: z.literal("buildFaqTaxonomies"),
    sourceFile: z.literal("src/lib/bazi/canonical-knowledge.ts"),
    policy: z.array(z.string().trim().min(1)).min(1),
  }),
  crossDomainDecomposition: z
    .array(BaziAtomicCrossDomainRuleSchema)
    .min(1),
  entries: z.array(BaziAtomicQuestionMatrixEntrySchema).min(1),
});