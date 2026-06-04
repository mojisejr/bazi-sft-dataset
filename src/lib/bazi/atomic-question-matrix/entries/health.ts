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
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    supportStatus: "partial",
    supportNotes:
      "The engine exposes health baseline plus generic timing, but it does not yet have a dedicated health-temporal overlay.",
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
      "activeTimingWindow if the user asks now or soon",
    ],
    supportStatus: "partial",
    supportNotes:
      "Current truth can support caution framing, but not medical-outcome certainty.",
  },
] as const);