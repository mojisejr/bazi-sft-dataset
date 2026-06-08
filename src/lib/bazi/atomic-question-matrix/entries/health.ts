import { FAQ_TAXONOMY } from "../faq-taxonomy";

import { defineAtomicQuestionEntries } from "./helpers";

export const healthAtomicQuestionEntries = defineAtomicQuestionEntries([
  {
    jobId: "health.constitution_baseline",
    canonicalBucket: "health",
    underlyingJob:
      "Describe core body balance or baseline weakness",
    keepSeparateFrom: [
      "health.timing_sensitive_weakness",
      "health.recovery_caution",
    ],
    faqTaxonomy: FAQ_TAXONOMY.health,
    userAsk: "What is the chart's baseline body tendency or core weakness?",
    mustAnswer:
      "Describe the baseline constitution pattern, what part of balance looks thin or overloaded, and what kind of caution frame is appropriate.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "seasonalInteraction",
      "source3HealthInterpretation",
    ],
    forbiddenNoise: [
      "diagnosis",
      "treatment instructions",
      "certainty about disease",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "seasonalInteraction",
      "source3HealthInterpretation",
    ],
    supportStatus: "supported",
  },
  {
    jobId: "health.timing_sensitive_weakness",
    canonicalBucket: "health",
    underlyingJob:
      "Ask when a body weakness or caution period is activated",
    keepSeparateFrom: [
      "health.constitution_baseline",
      "relationship.timing_window",
    ],
    faqTaxonomy: FAQ_TAXONOMY.health,
    userAsk:
      "When is a body weakness or caution period more activated?",
    mustAnswer:
      "Identify the vulnerable timing window, what kind of strain becomes more relevant there, and keep the answer at caution level.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "seasonalInteraction",
      "source3HealthInterpretation",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    forbiddenNoise: [
      "diagnosis",
      "emergency claims",
      "non-health domain commentary",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "seasonalInteraction",
      "source3HealthInterpretation",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    supportStatus: "supported",
    supportNotes:
      "Source 3 now provides a deterministic timing-sensitivity lane so health caution windows can stay evidence-backed without diagnosis drift.",
  },
  {
    jobId: "health.recovery_caution",
    canonicalBucket: "health",
    underlyingJob:
      "Ask whether a recovery, body-goal, or health plan is safe to pursue",
    keepSeparateFrom: [
      "health.constitution_baseline",
      "foundation.general_caution",
    ],
    faqTaxonomy: FAQ_TAXONOMY.health,
    userAsk:
      "Is this recovery plan, body goal, or health effort safe to pursue now?",
    mustAnswer:
      "State whether the chart supports cautious pursuit, what kind of strain to watch, and where the answer must stop short of treatment advice.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "seasonalInteraction",
      "source3HealthInterpretation",
      "timing sections when the plan is near-term",
    ],
    forbiddenNoise: [
      "medical treatment instructions",
      "certainty about outcomes",
      "unrelated work or relationship content",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "seasonalInteraction",
      "source3HealthInterpretation",
      "activeTimingWindow if the user asks now or soon",
    ],
    supportStatus: "supported",
    supportNotes:
      "Source 3 now provides deterministic caution framing and timing sensitivity, while keeping recovery answers bounded away from diagnosis or treatment claims.",
  },
] as const);