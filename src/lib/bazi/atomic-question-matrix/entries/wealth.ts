import { FAQ_TAXONOMY } from "../faq-taxonomy";

import { defineAtomicQuestionEntries } from "./helpers";

export const wealthAtomicQuestionEntries = defineAtomicQuestionEntries([
  {
    jobId: "wealth.accumulation_capacity",
    canonicalBucket: "wealth",
    underlyingJob: "Judge ability to build and retain money over time",
    keepSeparateFrom: [
      "wealth.timing_window",
      "wealth.windfall_luck",
    ],
    faqTaxonomy: FAQ_TAXONOMY.wealth,
    userAsk: "Can I build and keep money well over time?",
    mustAnswer:
      "State the chart's money-building capacity, how stable it is, and what pattern helps retention rather than leakage.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "financeTenGodHighlights",
      "source4WealthInvestmentInterpretation",
    ],
    forbiddenNoise: [
      "exact timing promises",
      "lottery-style fortune claims",
      "work or romance narrative that is not needed for the money question",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "elementAnalysis",
      "financeTenGodHighlights",
    ],
    supportStatus: "supported",
  },
  {
    jobId: "wealth.timing_window",
    canonicalBucket: "wealth",
    underlyingJob:
      "Ask when money movement, improvement, or target income will appear",
    keepSeparateFrom: [
      "wealth.accumulation_capacity",
      "work.job_switch_timing",
    ],
    faqTaxonomy: FAQ_TAXONOMY.wealth,
    userAsk: "When is money likely to improve or move more clearly?",
    mustAnswer:
      "Identify the relevant money window, what kind of money movement it favors, and what caution keeps the timing answer honest.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "financeTenGodHighlights",
      "source4WealthInvestmentInterpretation",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    forbiddenNoise: [
      "guaranteed income numbers",
      "unrelated romance commentary",
      "vague soon language with no timing anchor",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "financeTenGodHighlights",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    supportStatus: "supported",
  },
  {
    jobId: "wealth.income_source_fit",
    canonicalBucket: "wealth",
    underlyingJob: "Identify where the main money channel should come from",
    keepSeparateFrom: [
      "wealth.accumulation_capacity",
      "work.career_fit",
    ],
    faqTaxonomy: FAQ_TAXONOMY.wealth,
    userAsk: "What money channel or earning route fits me best?",
    mustAnswer:
      "Point to the most natural earning mode, explain why it fits, and say what kind of route should stay secondary.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "financeTenGodHighlights",
      "elementAnalysis",
      "careerTenGodHighlights when the income route depends on work style",
    ],
    forbiddenNoise: [
      "one-channel absolutism",
      "switch timing advice without being asked",
      "relationship commentary unless the ask is explicitly partner-linked",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "financeTenGodHighlights",
      "elementAnalysis",
      "careerTenGodHighlights if route and role are intertwined",
    ],
    supportStatus: "partial",
    supportNotes:
      "The engine has money anchors, but it does not yet expose a dedicated income-channel resolver.",
  },
  {
    jobId: "wealth.windfall_luck",
    canonicalBucket: "wealth",
    underlyingJob: "Ask about luck-driven gains instead of earned accumulation",
    keepSeparateFrom: [
      "wealth.accumulation_capacity",
      "wealth.timing_window",
    ],
    faqTaxonomy: FAQ_TAXONOMY.wealth,
    userAsk: "Is there luck-driven money or a sudden gain pattern here?",
    mustAnswer:
      "Only answer whether the chart safely supports speaking about windfall tendency at all, and keep the answer narrower than a guarantee.",
    mandatoryEvidence: [
      "chartIdentity",
      "financeTenGodHighlights",
      "timing sections if a window is asked explicitly",
    ],
    forbiddenNoise: [
      "jackpot promises",
      "invented omen language",
      "confusing earned accumulation with luck-based gain",
    ],
    readingOrder: [
      "chartIdentity",
      "financeTenGodHighlights",
      "activeTimingWindow if the user asks when",
    ],
    supportStatus: "insufficient",
    supportNotes:
      "Current engine truth does not expose a dedicated luck-or-windfall surface, so this job needs a future support contract or a stricter fallback.",
  },
  {
    jobId: "wealth.risk_investment",
    canonicalBucket: "wealth",
    underlyingJob:
      "Evaluate business, investment, or money-risk exposure",
    keepSeparateFrom: [
      "wealth.accumulation_capacity",
      "relationship.partner_money_dynamic",
    ],
    faqTaxonomy: {
      primaryIntents: ["wealth", "work"],
      rawTypeLabels: ["Wealth", "Work"],
      notes:
        "Operational venture risk can surface here, but the atomic job remains a money-risk decision instead of a work-fit read.",
    },
    userAsk:
      "Is this investment, business, or money-risk move safe enough to pursue?",
    mustAnswer:
      "State whether the chart supports taking risk now, what kind of risk is most exposed, and what boundary should not be crossed.",
    mandatoryEvidence: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "financeTenGodHighlights",
      "elementAnalysis",
      "source4WealthInvestmentInterpretation",
      "activeTimingWindow",
      "nextTimingWindows",
      "work anchors only if the investment is operational",
    ],
    forbiddenNoise: [
      "moral judgment",
      "guaranteed profit",
      "partner commentary unless the ask is explicitly joint",
    ],
    readingOrder: [
      "chartIdentity",
      "dayMasterStrengthProfile",
      "financeTenGodHighlights",
      "elementAnalysis",
      "activeTimingWindow",
      "nextTimingWindows",
      "work anchors only if the investment is operational",
    ],
    supportStatus: "supported",
    supportNotes:
      "Source 4 now provides a deterministic risk boundary, timing window, and investment posture; operational business context still stays downstream of Source 6 when explicitly needed.",
  },
  {
    jobId: "wealth.partner_money_dynamic",
    canonicalBucket: "wealth",
    underlyingJob:
      "Assess how relationship dynamics affect money decisions",
    keepSeparateFrom: [
      "relationship.relationship_viability",
      "wealth.risk_investment",
    ],
    faqTaxonomy: {
      primaryIntents: ["wealth", "love"],
      rawTypeLabels: ["Wealth", "Love"],
      notes:
        "This job exists only when a prompt explicitly ties partner dynamics to money decisions; it does not replace either base taxonomy lane.",
    },
    userAsk:
      "How does this partner or relationship dynamic affect money decisions?",
    mustAnswer:
      "Only speak to the money-pattern interaction if the chart truth can separate it from general romance narrative.",
    mandatoryEvidence: [
      "financeTenGodHighlights",
      "relationshipTenGodHighlights",
      "loveCompatibilityProfile when a counterpart is actually present",
      "timing sections if the decision is near-term",
    ],
    forbiddenNoise: [
      "blanket judgments about the partner",
      "marriage advice not asked for",
      "generic wealth promises",
    ],
    readingOrder: [
      "chartIdentity",
      "financeTenGodHighlights",
      "relationshipTenGodHighlights",
      "loveCompatibilityProfile if present",
      "activeTimingWindow when timing matters",
    ],
    supportStatus: "insufficient",
    supportNotes:
      "Current engine truth does not yet expose a safe cross-domain wealth-plus-relationship contract by default.",
  },
] as const);