import { FAQ_TAXONOMY } from "../faq-taxonomy";

import { defineAtomicQuestionEntries } from "./helpers";

export const relationshipAtomicQuestionEntries = defineAtomicQuestionEntries([
  {
    jobId: "relationship.partner_profile",
    canonicalBucket: "relationship",
    underlyingJob: "Describe the likely partner or relationship type",
    keepSeparateFrom: [
      "relationship.timing_window",
      "relationship.current_person_feelings",
    ],
    faqTaxonomy: FAQ_TAXONOMY.relationship,
    userAsk: "What kind of partner or relationship type is likely for me?",
    mustAnswer:
      "Describe the partner pattern, the relational tone, and what kind of person or bond shape is more natural than forced.",
    mandatoryEvidence: [
      "chartIdentity",
      "spousePalace",
      "relationshipTenGodHighlights",
      "dayMasterStrengthProfile",
      "loveCompatibilityProfile if present",
    ],
    forbiddenNoise: [
      "timing guesses",
      "mind-reading a specific person",
      "mixing in work or money commentary without need",
    ],
    readingOrder: [
      "chartIdentity",
      "spousePalace",
      "relationshipTenGodHighlights",
      "dayMasterStrengthProfile",
      "loveCompatibilityProfile if present",
    ],
    supportStatus: "supported",
  },
  {
    jobId: "relationship.timing_window",
    canonicalBucket: "relationship",
    underlyingJob:
      "Ask when a relationship, marriage, or new person enters",
    keepSeparateFrom: [
      "relationship.partner_profile",
      "relationship.reconciliation",
    ],
    faqTaxonomy: FAQ_TAXONOMY.relationship,
    userAsk:
      "When is a relationship, marriage, or new person likely to enter?",
    mustAnswer:
      "Identify the relationship window, the kind of opening it suggests, and what makes the window stronger or weaker.",
    mandatoryEvidence: [
      "chartIdentity",
      "spousePalace",
      "relationshipTenGodHighlights",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    forbiddenNoise: [
      "facial or personality profile detail when the question is only timing",
      "certainty about one named person",
    ],
    readingOrder: [
      "chartIdentity",
      "spousePalace",
      "relationshipTenGodHighlights",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
    ],
    supportStatus: "supported",
  },
  {
    jobId: "relationship.current_person_feelings",
    canonicalBucket: "relationship",
    underlyingJob: "Ask what a specific person feels now",
    keepSeparateFrom: [
      "relationship.partner_profile",
      "relationship.relationship_viability",
    ],
    faqTaxonomy: FAQ_TAXONOMY.relationship,
    userAsk: "What does this specific person feel right now?",
    mustAnswer:
      "Only answer to the extent the chart supports discussing relational tendency or compatibility; do not present the other person's inner state as known fact.",
    mandatoryEvidence: [
      "loveCompatibilityProfile if a real counterpart profile exists",
      "self-chart relationship tendency as background only",
    ],
    forbiddenNoise: [
      "mind-reading certainty",
      "invented messages from the other person",
      "treating natal chart signals as real-time emotional surveillance",
    ],
    readingOrder: [
      "loveCompatibilityProfile if present",
      "self-chart relationship anchors only as background",
    ],
    supportStatus: "insufficient",
    supportNotes:
      "Current engine truth is chart-first, not a direct read of one specific person's current feelings.",
  },
  {
    jobId: "relationship.reconciliation",
    canonicalBucket: "relationship",
    underlyingJob:
      "Ask whether an ex or previous connection returns",
    keepSeparateFrom: [
      "relationship.timing_window",
      "relationship.current_person_feelings",
    ],
    faqTaxonomy: FAQ_TAXONOMY.relationship,
    userAsk: "Is there a real chance an ex or past connection returns?",
    mustAnswer:
      "Distinguish between a general reopening window and a claim about one specific person coming back.",
    mandatoryEvidence: [
      "chartIdentity",
      "spousePalace",
      "relationshipTenGodHighlights",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
      "loveCompatibilityProfile if present",
    ],
    forbiddenNoise: [
      "certainty that the ex is thinking about the user",
      "revenge narrative",
      "blanket soulmate claims",
    ],
    readingOrder: [
      "chartIdentity",
      "spousePalace",
      "relationshipTenGodHighlights",
      "activeTimingWindow",
      "nextTimingWindows",
      "liuNian",
      "loveCompatibilityProfile if present",
    ],
    supportStatus: "partial",
    supportNotes:
      "The engine can support timing and relationship reopening tendency, but not a hard claim about one ex's current intention.",
  },
  {
    jobId: "relationship.relationship_viability",
    canonicalBucket: "relationship",
    underlyingJob:
      "Judge whether a bond should continue or will go further",
    keepSeparateFrom: [
      "relationship.current_person_feelings",
      "relationship.reconciliation",
    ],
    faqTaxonomy: FAQ_TAXONOMY.relationship,
    userAsk: "Should this bond continue, and does it have room to go further?",
    mustAnswer:
      "Say whether the bond has structural support, what the main strain is, and what condition determines whether it can stabilize.",
    mandatoryEvidence: [
      "chartIdentity",
      "spousePalace",
      "relationshipTenGodHighlights",
      "dayMasterStrengthProfile",
      "loveCompatibilityProfile if a counterpart exists",
      "timing sections when the decision is immediate",
    ],
    forbiddenNoise: [
      "marriage timing if it was not asked",
      "work commentary",
      "certainty about the other person's motives",
    ],
    readingOrder: [
      "chartIdentity",
      "spousePalace",
      "relationshipTenGodHighlights",
      "dayMasterStrengthProfile",
      "loveCompatibilityProfile if present",
      "timing only when the user asks should or now",
    ],
    supportStatus: "partial",
    supportNotes:
      "The engine can speak to relational fit and strain, but the answer is stronger when a counterpart profile exists.",
  },
  {
    jobId: "relationship.third_party_risk",
    canonicalBucket: "relationship",
    underlyingJob:
      "Check infidelity, triangles, or extra-person interference",
    keepSeparateFrom: [
      "relationship.current_person_feelings",
      "relationship.relationship_viability",
    ],
    faqTaxonomy: FAQ_TAXONOMY.relationship,
    userAsk:
      "Is there third-party interference, infidelity risk, or triangle pressure here?",
    mustAnswer:
      "Only answer if the chart exposes a safe interference pattern; otherwise fall back to uncertainty plainly.",
    mandatoryEvidence: [
      "relationshipTenGodHighlights",
      "loveCompatibilityProfile if counterpart data exists",
      "timing sections for near-term caution",
    ],
    forbiddenNoise: [
      "accusation language",
      "certainty of cheating",
      "surveillance-style claims about unnamed third parties",
    ],
    readingOrder: [
      "relationshipTenGodHighlights",
      "loveCompatibilityProfile if present",
      "activeTimingWindow when caution is time-bound",
    ],
    supportStatus: "insufficient",
    supportNotes:
      "Current engine truth does not expose a dedicated third-party or infidelity-risk surface.",
  },
  {
    jobId: "relationship.marriage_readiness",
    canonicalBucket: "relationship",
    underlyingJob:
      "Ask whether the chart is ready for serious commitment or marriage",
    keepSeparateFrom: [
      "relationship.timing_window",
      "relationship.partner_profile",
    ],
    faqTaxonomy: FAQ_TAXONOMY.relationship,
    userAsk: "Is this chart ready for serious commitment or marriage?",
    mustAnswer:
      "State whether commitment readiness is structurally present, what kind of partnership maturity is visible, and which timing window matters most.",
    mandatoryEvidence: [
      "chartIdentity",
      "spousePalace",
      "relationshipTenGodHighlights",
      "dayMasterStrengthProfile",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
    ],
    forbiddenNoise: [
      "naming a spouse profile when the ask is readiness only",
      "certainty about a wedding date",
    ],
    readingOrder: [
      "chartIdentity",
      "spousePalace",
      "relationshipTenGodHighlights",
      "dayMasterStrengthProfile",
      "currentDaYun",
      "activeTimingWindow",
      "nextTimingWindows",
    ],
    supportStatus: "supported",
  },
] as const);