import { FAQ_TAXONOMY } from "../faq-taxonomy";

import { defineAtomicQuestionEntries } from "./helpers";

export const foundationAtomicQuestionEntries = defineAtomicQuestionEntries([
  {
    jobId: "foundation.base_chart_persona",
    canonicalBucket: "foundation",
    underlyingJob:
      "Read the chart's core temperament and structural baseline",
    keepSeparateFrom: [
      "work.career_fit",
      "relationship.partner_profile",
    ],
    faqTaxonomy: FAQ_TAXONOMY.foundation,
    userAsk: "Who is this person at the base-chart level?",
    mustAnswer:
      "Describe core temperament, structural baseline, and the main pattern that other domains should inherit from.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "sixtyJiaziCorePersona",
      "elementAnalysis",
      "seasonalInteraction",
      "readingOrderSteps when available",
    ],
    forbiddenNoise: [
      "domain-specific forecasting",
      "romance profile detail",
      "timing claims unless the user explicitly shifts into a timing question",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "sixtyJiaziCorePersona",
      "elementAnalysis",
      "seasonalInteraction",
      "readingOrderSteps",
    ],
    supportStatus: "supported",
  },
  {
    jobId: "foundation.life_direction_check",
    canonicalBucket: "foundation",
    underlyingJob: "Ask whether the current path is broadly right",
    keepSeparateFrom: ["work.project_risk", "study.study_fit"],
    faqTaxonomy: FAQ_TAXONOMY.foundation,
    userAsk: "Is the path I am on broadly aligned or off-track?",
    mustAnswer:
      "State whether the direction is broadly aligned, what makes it aligned or strained, and which adjustment matters more than brute force.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "sixtyJiaziCorePersona",
      "elementAnalysis",
      "seasonalInteraction",
      "timing sections when the question is about the current season of life",
    ],
    forbiddenNoise: [
      "substituting a narrow work or love answer for a broad path question",
      "certainty about one future event",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "sixtyJiaziCorePersona",
      "elementAnalysis",
      "seasonalInteraction",
      "activeTimingWindow if the user asks about the current phase",
    ],
    supportStatus: "supported",
  },
  {
    jobId: "foundation.general_timing_focus",
    canonicalBucket: "foundation",
    underlyingJob:
      "Ask for broad year or decade focus without one narrow domain",
    keepSeparateFrom: [
      "wealth.timing_window",
      "relationship.timing_window",
    ],
    faqTaxonomy: {
      primaryIntents: ["other"],
      rawTypeLabels: ["Others"],
      notes:
        "Broad timing focus stays in foundation until the prompt explicitly names a narrower domain lane.",
    },
    userAsk: "What broad life phase or timing focus matters most right now?",
    mustAnswer:
      "Identify the main active period, what it emphasizes, and what should remain background rather than foreground.",
    mandatoryEvidence: [
      "chartIdentity",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
      "foundation anchors for interpretation",
    ],
    forbiddenNoise: [
      "domain-specific money or romance detail unless the user asks for that split explicitly",
    ],
    readingOrder: [
      "chartIdentity",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
      "foundation anchors for interpretation",
    ],
    supportStatus: "supported",
  },
  {
    jobId: "foundation.general_caution",
    canonicalBucket: "foundation",
    underlyingJob:
      "Ask what should be watched overall, without one main domain",
    keepSeparateFrom: ["domain-specific caution jobs"],
    faqTaxonomy: FAQ_TAXONOMY.foundation,
    userAsk:
      "What should I watch overall when there is no single main domain?",
    mustAnswer:
      "Name the top caution theme, explain why it matters now, and keep the answer broad rather than sneaking in a domain-specific forecast.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "seasonalInteraction",
      "activeTimingWindow",
      "liuNian",
    ],
    forbiddenNoise: [
      "diagnosis",
      "relationship accusation",
      "investment advice",
      "any narrow domain forecast that has not been requested",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "seasonalInteraction",
      "activeTimingWindow",
      "liuNian",
    ],
    supportStatus: "supported",
  },
] as const);