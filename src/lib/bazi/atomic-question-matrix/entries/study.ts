import { FAQ_TAXONOMY } from "../faq-taxonomy";

import { defineAtomicQuestionEntries } from "./helpers";

export const studyAtomicQuestionEntries = defineAtomicQuestionEntries([
  {
    jobId: "study.exam_result",
    canonicalBucket: "study",
    underlyingJob:
      "Ask whether an exam, admissions, or scholarship result will succeed",
    keepSeparateFrom: ["study.study_fit", "work.offer_result"],
    faqTaxonomy: FAQ_TAXONOMY.study,
    userAsk:
      "Will I pass this exam, get admitted, or receive this scholarship?",
    mustAnswer:
      "Give a cautious outcome-direction read, plus the strongest support and drag factors without pretending certainty.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
      "careerTenGodHighlights only when the exam is directly tied to role-entry",
    ],
    forbiddenNoise: [
      "ranking guarantees",
      "employer-like work commentary",
      "generic destiny language",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
      "careerTenGodHighlights only if role-entry is the real job",
    ],
    supportStatus: "partial",
    supportNotes:
      "Current engine truth can support timing and pressure reading, but there is no dedicated study intent or exam-outcome contract yet.",
  },
  {
    jobId: "study.study_fit",
    canonicalBucket: "study",
    underlyingJob:
      "Identify the right field, degree, or direction of study",
    keepSeparateFrom: ["study.exam_result", "work.career_fit"],
    faqTaxonomy: FAQ_TAXONOMY.study,
    userAsk: "Which field, degree, or learning direction fits me best?",
    mustAnswer:
      "Name the study direction pattern, why it fits, and what style of learning or discipline suits the chart.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "sixtyJiaziCorePersona when helpful",
      "elementAnalysis",
      "careerTenGodHighlights only when study and future role are tightly linked",
    ],
    forbiddenNoise: [
      "immediate job-switch advice",
      "romance narrative",
      "exam timing unless the user asks it",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "sixtyJiaziCorePersona if present",
      "elementAnalysis",
      "careerTenGodHighlights only when study is role-bound",
    ],
    supportStatus: "partial",
    supportNotes:
      "The answer can be approximated from general and work truth, but there is no dedicated study-fit surface.",
  },
  {
    jobId: "study.academic_risk",
    canonicalBucket: "study",
    underlyingJob:
      "Check grade risk, retention risk, or study obstacles",
    keepSeparateFrom: ["study.exam_result", "foundation.general_caution"],
    faqTaxonomy: FAQ_TAXONOMY.study,
    userAsk:
      "What academic obstacle, retention risk, or grade pressure should I watch?",
    mustAnswer:
      "Name the main study-side friction and describe whether it is a timing spike, discipline issue, or baseline mismatch.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    forbiddenNoise: [
      "medical framing",
      "romance commentary",
      "job-offer prediction",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    supportStatus: "partial",
    supportNotes:
      "Current engine truth can surface caution and timing pressure, but not a study-specific academic-risk classifier.",
  },
  {
    jobId: "study.mobility_timing",
    canonicalBucket: "study",
    underlyingJob: "Ask about relocation or timing linked to study",
    keepSeparateFrom: ["study.study_fit", "relationship.timing_window"],
    faqTaxonomy: {
      primaryIntents: ["study"],
      rawTypeLabels: ["Study"],
      notes:
        "Broad movement questions stay foundation-led unless the prompt clearly ties the timing to study or admissions.",
    },
    userAsk:
      "When is movement, relocation, or a study-linked transition likely to happen?",
    mustAnswer:
      "Identify the timing window and say whether the movement is supportive or disruptive for study goals.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
      "foundation evidence only if the move is not strictly study-only",
    ],
    forbiddenNoise: [
      "relationship timing",
      "career switching",
      "certainty about a specific institution or city",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
      "foundation evidence only if the ask is broad life movement",
    ],
    supportStatus: "partial",
    supportNotes:
      "The engine has timing truth, but not a dedicated study-mobility support surface.",
  },
] as const);