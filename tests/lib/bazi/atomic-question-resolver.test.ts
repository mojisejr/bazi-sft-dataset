import { describe, expect, test } from "vitest";

import {
  BAZI_ATOMIC_QUESTION_RESOLVER_FIRST_WAVE_JOB_IDS,
  BAZI_ATOMIC_QUESTION_RESOLVER_FALLBACK_REASONS,
  resolveBaziAtomicQuestion,
} from "@/lib/bazi/atomic-question-resolver";

import {
  RELATIONSHIP_AMBIGUOUS_FALLBACK_FIXTURE,
  RELATIONSHIP_PARTNER_PROFILE_FIXTURE,
  RELATIONSHIP_TIMING_WINDOW_FIXTURE,
} from "../../helpers/atomic-question-resolver-fixtures";

describe("resolveBaziAtomicQuestion", () => {
  test("freezes the Phase 3A first-wave job set", () => {
    expect(BAZI_ATOMIC_QUESTION_RESOLVER_FIRST_WAVE_JOB_IDS).toEqual([
      "foundation.base_chart_persona",
      "foundation.life_direction_check",
      "wealth.accumulation_capacity",
      "wealth.timing_window",
      "work.career_fit",
      "work.job_switch_timing",
      "relationship.partner_profile",
      "relationship.timing_window",
      "health.constitution_baseline",
      "health.recovery_caution",
    ]);
  });

  test("keeps work career fit and job-switch timing as distinct resolver outcomes", () => {
    const careerFit = resolveBaziAtomicQuestion({
      canonicalBucket: "work",
      currentChatEvidence: {
        latestUserMessage: "What kind of role or work style fits me best?",
      },
    });
    const jobSwitchTiming = resolveBaziAtomicQuestion({
      canonicalBucket: "work",
      currentChatEvidence: {
        latestUserMessage: "Should I change jobs, and when is the safer window?",
      },
    });

    expect(careerFit).toMatchObject({
      selectionMode: "atomic_job",
      canonicalBucket: "work",
      jobId: "work.career_fit",
    });
    expect(jobSwitchTiming).toMatchObject({
      selectionMode: "atomic_job",
      canonicalBucket: "work",
      jobId: "work.job_switch_timing",
    });
    expect(careerFit).not.toMatchObject({
      jobId: "work.job_switch_timing",
    });
  });

  test("returns ambiguous bucket fallback when one prompt asks two work jobs at once", () => {
    const result = resolveBaziAtomicQuestion({
      canonicalBucket: "work",
      currentChatEvidence: {
        latestUserMessage: "What kind of role fits me best, and when should I change jobs?",
      },
    });

    expect(result).toMatchObject({
      selectionMode: "bucket_fallback",
      canonicalBucket: "work",
      fallbackReason: "ambiguous_signal",
    });
  });

  test("fails closed when mixed work wording gives one job extra support signals", () => {
    const result = resolveBaziAtomicQuestion({
      canonicalBucket: "work",
      currentChatEvidence: {
        latestUserMessage:
          "What kind of role fits me best, and when is the safer window to change jobs?",
      },
    });

    expect(result).toMatchObject({
      selectionMode: "bucket_fallback",
      canonicalBucket: "work",
      fallbackReason: "ambiguous_signal",
    });
  });

  test("keeps relationship partner profile and timing window as distinct resolver outcomes", () => {
    const partnerProfile = resolveBaziAtomicQuestion({
      canonicalBucket: RELATIONSHIP_PARTNER_PROFILE_FIXTURE.canonicalBucket,
      currentChatEvidence: RELATIONSHIP_PARTNER_PROFILE_FIXTURE.currentChatEvidence,
    });
    const timingWindow = resolveBaziAtomicQuestion({
      canonicalBucket: RELATIONSHIP_TIMING_WINDOW_FIXTURE.canonicalBucket,
      currentChatEvidence: RELATIONSHIP_TIMING_WINDOW_FIXTURE.currentChatEvidence,
    });

    expect(partnerProfile).toMatchObject({
      selectionMode: "atomic_job",
      canonicalBucket: "relationship",
      jobId: "relationship.partner_profile",
    });
    expect(timingWindow).toMatchObject({
      selectionMode: "atomic_job",
      canonicalBucket: "relationship",
      jobId: "relationship.timing_window",
    });
    expect(partnerProfile).not.toMatchObject({
      jobId: "relationship.timing_window",
    });
  });

  test("fails closed for ambiguous relationship wording instead of guessing a narrow job", () => {
    const result = resolveBaziAtomicQuestion({
      canonicalBucket: RELATIONSHIP_AMBIGUOUS_FALLBACK_FIXTURE.canonicalBucket,
      currentChatEvidence: RELATIONSHIP_AMBIGUOUS_FALLBACK_FIXTURE.currentChatEvidence,
    });

    expect(result).toMatchObject({
      selectionMode: "bucket_fallback",
      canonicalBucket: "relationship",
      fallbackReason: "ambiguous_signal",
    });
  });

  test("returns insufficient-signal fallback for broad foundation reading prompts", () => {
    const result = resolveBaziAtomicQuestion({
      canonicalBucket: "foundation",
      currentChatEvidence: {
        latestUserMessage: "Can you give me a general reading of this chart?",
      },
    });

    expect(result).toMatchObject({
      selectionMode: "bucket_fallback",
      canonicalBucket: "foundation",
      fallbackReason: "insufficient_signal",
    });
  });

  test("fails closed when a supported bucket prompt misses every first-wave job", () => {
    const result = resolveBaziAtomicQuestion({
      canonicalBucket: "work",
      currentChatEvidence: {
        latestUserMessage: "Should I start my own business instead of staying employed?",
      },
    });

    expect(result).toMatchObject({
      selectionMode: "bucket_fallback",
      canonicalBucket: "work",
      fallbackReason: "insufficient_signal",
    });
  });

  test("names every fallback reason and uses unsupported bucket explicitly", () => {
    expect(BAZI_ATOMIC_QUESTION_RESOLVER_FALLBACK_REASONS).toEqual([
      "unsupported_bucket",
      "insufficient_signal",
      "ambiguous_signal",
    ]);

    const result = resolveBaziAtomicQuestion({
      canonicalBucket: "study",
      currentChatEvidence: {
        latestUserMessage: "What should I study next?",
      },
    });

    expect(result).toMatchObject({
      selectionMode: "bucket_fallback",
      canonicalBucket: "study",
      fallbackReason: "unsupported_bucket",
      confidence: 0,
    });
  });
});