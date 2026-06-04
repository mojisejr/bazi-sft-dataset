export const RELATIONSHIP_PARTNER_PROFILE_FIXTURE = {
  canonicalBucket: "relationship" as const,
  intentClassification: {
    intent: "love" as const,
    requiresBaziConsult: true,
    confidence: 0.92,
  },
  currentChatEvidence: {
    latestUserMessage: "What kind of partner fits me best for a serious relationship?",
    recentMessages: [],
  },
  expectedSelectionMode: "atomic_job" as const,
  expectedJobId: "relationship.partner_profile" as const,
};

export const RELATIONSHIP_TIMING_WINDOW_FIXTURE = {
  canonicalBucket: "relationship" as const,
  intentClassification: {
    intent: "love" as const,
    requiresBaziConsult: true,
    confidence: 0.92,
  },
  currentChatEvidence: {
    latestUserMessage: "When will I meet partner and what timing window this year is best for a serious relationship?",
    recentMessages: [],
  },
  expectedSelectionMode: "atomic_job" as const,
  expectedJobId: "relationship.timing_window" as const,
};

export const RELATIONSHIP_AMBIGUOUS_FALLBACK_FIXTURE = {
  canonicalBucket: "relationship" as const,
  intentClassification: {
    intent: "love" as const,
    requiresBaziConsult: true,
    confidence: 0.9,
  },
  currentChatEvidence: {
    latestUserMessage: "What kind of partner or spouse fits me best in a relationship, and when will I meet partner?",
    recentMessages: [],
  },
  expectedSelectionMode: "bucket_fallback" as const,
};

export const PHASE_3D_RELATIONSHIP_RESOLVER_FIXTURES = [
  RELATIONSHIP_PARTNER_PROFILE_FIXTURE,
  RELATIONSHIP_TIMING_WINDOW_FIXTURE,
  RELATIONSHIP_AMBIGUOUS_FALLBACK_FIXTURE,
] as const;