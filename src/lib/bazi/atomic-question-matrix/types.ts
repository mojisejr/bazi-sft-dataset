import { z } from "zod";

import {
  BaziAtomicCanonicalBucketSchema,
  BaziAtomicCrossDomainRuleSchema,
  BaziAtomicFaqBindingSchema,
  BaziAtomicFaqIntentSchema,
  BaziAtomicQuestionMatrixEntrySchema,
  BaziAtomicQuestionMatrixSchema,
  BaziAtomicSupportStatusSchema,
} from "./schemas";

export type BaziAtomicCanonicalBucket = z.infer<
  typeof BaziAtomicCanonicalBucketSchema
>;
export type BaziAtomicSupportStatus = z.infer<
  typeof BaziAtomicSupportStatusSchema
>;
export type BaziAtomicFaqIntent = z.infer<typeof BaziAtomicFaqIntentSchema>;
export type BaziAtomicFaqBinding = z.infer<typeof BaziAtomicFaqBindingSchema>;
export type BaziAtomicQuestionMatrixEntry = z.infer<
  typeof BaziAtomicQuestionMatrixEntrySchema
>;
export type BaziAtomicQuestionMatrix = z.infer<
  typeof BaziAtomicQuestionMatrixSchema
>;
export type BaziAtomicCrossDomainRule = z.infer<
  typeof BaziAtomicCrossDomainRuleSchema
>;