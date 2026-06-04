import { FAQ_TAXONOMY } from "../faq-taxonomy";

import { defineAtomicQuestionEntries } from "./helpers";

export const workAtomicQuestionEntries = defineAtomicQuestionEntries([
  {
    jobId: "work.career_fit",
    canonicalBucket: "work",
    underlyingJob: "Identify suitable role, path, or work style",
    keepSeparateFrom: ["work.job_switch_timing", "work.offer_result"],
    faqTaxonomy: {
      primaryIntents: ["work", "study"],
      rawTypeLabels: ["Work", "Study"],
      notes:
        "Study rows only bind here when the real question is role fit or job entry, not exam outcome.",
    },
    userAsk: "Which role, path, or work style fits me best?",
    mustAnswer:
      "Name the fit pattern, explain why it fits, and say what kind of work context amplifies or drains it.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "elementAnalysis",
      "workCompatibilityProfile if present",
    ],
    forbiddenNoise: [
      "exact switch timing",
      "romance commentary",
      "wealth promises that are not grounded in work evidence",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "elementAnalysis",
      "workCompatibilityProfile if present",
      "timing only if the user also asks when",
    ],
    supportStatus: "supported",
  },
  {
    jobId: "work.job_switch_timing",
    canonicalBucket: "work",
    underlyingJob: "Decide when a work move should happen",
    keepSeparateFrom: ["work.career_fit", "work.offer_result"],
    faqTaxonomy: FAQ_TAXONOMY.work,
    userAsk: "Should I change jobs, and when is the safer window?",
    mustAnswer:
      "State whether a move window is opening, what kind of move it favors, and what caution condition would make the move premature.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    forbiddenNoise: [
      "naming a specific employer",
      "promising an offer",
      "romance and lifestyle commentary",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    supportStatus: "partial",
    supportNotes:
      "Current truth exposes timing context, but it does not yet have a dedicated move-readiness layer for switch risk versus fit.",
  },
  {
    jobId: "work.offer_result",
    canonicalBucket: "work",
    underlyingJob:
      "Ask whether a job, internship, casting, or interview result will land",
    keepSeparateFrom: ["work.job_switch_timing", "study.exam_result"],
    faqTaxonomy: FAQ_TAXONOMY.work,
    userAsk: "Will I get this job, internship, casting, or interview result?",
    mustAnswer:
      "Give a cautious probability read on outcome direction, plus the strongest reason for support or drag from the chart.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    forbiddenNoise: [
      "absolute guarantees",
      "invented recruiter intent",
      "unrelated romance or family narrative",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    supportStatus: "partial",
    supportNotes:
      "The current engine can show work pressure and timing windows, but it does not have an event-outcome resolver for one specific offer result.",
  },
  {
    jobId: "work.role_change_quality",
    canonicalBucket: "work",
    underlyingJob:
      "Judge whether a new role or position is better than the current one",
    keepSeparateFrom: ["work.offer_result", "work.career_fit"],
    faqTaxonomy: FAQ_TAXONOMY.work,
    userAsk: "Is the new role or position better than the current one?",
    mustAnswer:
      "Compare direction of gain versus drag, and say what dimension improves most: growth, stability, authority, or strain.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "elementAnalysis",
      "workCompatibilityProfile if present",
      "timing sections when the change is imminent",
    ],
    forbiddenNoise: [
      "treating every move as automatically better",
      "promising salary outcomes without wealth evidence",
      "relationship advice",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "elementAnalysis",
      "workCompatibilityProfile if present",
      "activeTimingWindow when the move is near-term",
    ],
    supportStatus: "partial",
    supportNotes:
      "Current truth can frame work suitability, but it lacks a dedicated compare-old-vs-new role contract.",
  },
  {
    jobId: "work.venture_viability",
    canonicalBucket: "work",
    underlyingJob: "Evaluate business or side-project viability",
    keepSeparateFrom: [
      "wealth.accumulation_capacity",
      "work.project_risk",
    ],
    faqTaxonomy: {
      primaryIntents: ["work", "wealth"],
      rawTypeLabels: ["Work", "Wealth"],
      notes:
        "Business and side-project prompts stay work-led here, but money-risk evidence may still be required.",
    },
    userAsk:
      "Should I pursue this business, side project, or public-facing venture?",
    mustAnswer:
      "State whether the venture direction is structurally aligned, what operating style it needs, and where the main fragility sits.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "elementAnalysis",
      "financeTenGodHighlights when wealth risk is central",
      "timing sections for launch windows",
    ],
    forbiddenNoise: [
      "lottery-style money promises",
      "romance narrative",
      "pretending a side project equals guaranteed fame",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "elementAnalysis",
      "financeTenGodHighlights if money risk is part of the ask",
      "activeTimingWindow",
      "nextTimingWindows",
    ],
    supportStatus: "partial",
    supportNotes:
      "The engine exposes work and wealth anchors, but it does not yet have a dedicated venture viability matrix.",
  },
  {
    jobId: "work.project_risk",
    canonicalBucket: "work",
    underlyingJob:
      "Identify work friction, project blockers, or authority pressure",
    keepSeparateFrom: ["work.offer_result", "foundation.general_caution"],
    faqTaxonomy: FAQ_TAXONOMY.work,
    userAsk:
      "What friction, blocker, or pressure should I watch in this work or project?",
    mustAnswer:
      "Name the likely friction type, where it comes from, and what kind of caution matters most now.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "elementAnalysis",
      "activeTimingWindow",
      "liuNian",
    ],
    forbiddenNoise: [
      "generic fear language",
      "diagnosis-style claims",
      "unrelated love or wealth storytelling",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "elementAnalysis",
      "activeTimingWindow",
      "liuNian",
    ],
    supportStatus: "partial",
    supportNotes:
      "The current truth can surface work pressure, but it does not yet expose project-specific blocker classifications.",
  },
  {
    jobId: "work.recognition_path",
    canonicalBucket: "work",
    underlyingJob:
      "Ask whether a public-facing or status path is likely to open",
    keepSeparateFrom: ["work.career_fit", "work.offer_result"],
    faqTaxonomy: FAQ_TAXONOMY.work,
    userAsk:
      "Does this chart support public recognition, status, or a visible title path?",
    mustAnswer:
      "Say whether visibility or status is plausible, what form it is more likely to take, and what condition makes it sustainable.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "elementAnalysis",
      "activeTimingWindow",
      "nextTimingWindows",
    ],
    forbiddenNoise: [
      "celebrity promises",
      "exam-result certainty without separate proof",
      "romance or wealth hype",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "careerTenGodHighlights",
      "elementAnalysis",
      "activeTimingWindow",
      "nextTimingWindows",
    ],
    supportStatus: "partial",
    supportNotes:
      "The engine has general career anchors, but no dedicated public-recognition or status-path truth layer.",
  },
] as const);