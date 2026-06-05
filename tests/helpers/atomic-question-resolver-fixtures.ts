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

export const WEALTH_ACCUMULATION_CAPACITY_FIXTURE = {
  canonicalBucket: "wealth" as const,
  intentClassification: {
    intent: "wealth" as const,
    requiresBaziConsult: true,
    confidence: 0.93,
  },
  currentChatEvidence: {
    latestUserMessage: "Can I build and keep money well over time?",
    recentMessages: [],
  },
  expectedSelectionMode: "atomic_job" as const,
  expectedJobId: "wealth.accumulation_capacity" as const,
  expectedFallbackReason: undefined,
  requiredEvidenceFamilies: [
    "chartIdentity",
    "dayMasterStrengthProfile",
    "elementAnalysis",
    "financeTenGodHighlights",
  ] as const,
  forbiddenEvidenceFamilies: [
    "exact timing promises",
    "lottery-style fortune claims",
  ] as const,
};

export const WEALTH_TIMING_WINDOW_FIXTURE = {
  canonicalBucket: "wealth" as const,
  intentClassification: {
    intent: "wealth" as const,
    requiresBaziConsult: true,
    confidence: 0.94,
  },
  currentChatEvidence: {
    latestUserMessage: "When will my money improve and what timing window looks best this year?",
    recentMessages: [],
  },
  expectedSelectionMode: "atomic_job" as const,
  expectedJobId: "wealth.timing_window" as const,
  expectedFallbackReason: undefined,
  requiredEvidenceFamilies: [
    "chartIdentity",
    "dayMasterStrengthProfile",
    "financeTenGodHighlights",
    "currentDaYun",
    "activeTimingWindow",
    "nextTimingWindows",
    "liuNian",
  ] as const,
  forbiddenEvidenceFamilies: [
    "guaranteed income numbers",
    "unrelated romance commentary",
  ] as const,
};

export const WEALTH_BUCKET_SAFE_INCOME_SOURCE_FIXTURE = {
  canonicalBucket: "wealth" as const,
  intentClassification: {
    intent: "wealth" as const,
    requiresBaziConsult: true,
    confidence: 0.89,
  },
  currentChatEvidence: {
    latestUserMessage: "What money channel or earning route fits me best?",
    recentMessages: [],
  },
  expectedSelectionMode: "bucket_fallback" as const,
  expectedJobId: undefined,
  expectedFallbackReason: "insufficient_signal" as const,
  requiredEvidenceFamilies: [
    "bucket-safe wealth packet",
  ] as const,
  forbiddenEvidenceFamilies: [
    "wealth.accumulation_capacity",
    "work.career_fit",
  ] as const,
};

export const HEALTH_CONSTITUTION_BASELINE_FIXTURE = {
  canonicalBucket: "health" as const,
  intentClassification: {
    intent: "health" as const,
    requiresBaziConsult: true,
    confidence: 0.92,
  },
  currentChatEvidence: {
    latestUserMessage: "What is my baseline body tendency or core weakness?",
    recentMessages: [],
  },
  expectedSelectionMode: "atomic_job" as const,
  expectedJobId: "health.constitution_baseline" as const,
  expectedFallbackReason: undefined,
  requiredEvidenceFamilies: [
    "chartIdentity",
    "dayMasterStrengthProfile",
    "elementAnalysis",
    "seasonalInteraction",
  ] as const,
  forbiddenEvidenceFamilies: [
    "diagnosis",
    "treatment instructions",
  ] as const,
};

export const HEALTH_RECOVERY_CAUTION_FIXTURE = {
  canonicalBucket: "health" as const,
  intentClassification: {
    intent: "health" as const,
    requiresBaziConsult: true,
    confidence: 0.91,
  },
  currentChatEvidence: {
    latestUserMessage: "Is this recovery plan safe to pursue now, and what strain should I watch?",
    recentMessages: [],
  },
  expectedSelectionMode: "atomic_job" as const,
  expectedJobId: "health.recovery_caution" as const,
  expectedFallbackReason: undefined,
  requiredEvidenceFamilies: [
    "chartIdentity",
    "dayMasterStrengthProfile",
    "elementAnalysis",
    "seasonalInteraction",
    "activeTimingWindow",
  ] as const,
  forbiddenEvidenceFamilies: [
    "medical treatment instructions",
    "certainty about outcomes",
  ] as const,
};

export const HEALTH_BUCKET_SAFE_TIMING_SENSITIVE_FIXTURE = {
  canonicalBucket: "health" as const,
  intentClassification: {
    intent: "health" as const,
    requiresBaziConsult: true,
    confidence: 0.87,
  },
  currentChatEvidence: {
    latestUserMessage: "When is my body weakness or caution period more activated?",
    recentMessages: [],
  },
  expectedSelectionMode: "bucket_fallback" as const,
  expectedJobId: undefined,
  expectedFallbackReason: "insufficient_signal" as const,
  requiredEvidenceFamilies: [
    "bucket-safe health packet",
  ] as const,
  forbiddenEvidenceFamilies: [
    "health.constitution_baseline",
    "health.recovery_caution",
  ] as const,
};

export const PHASE_5A_DETERMINISTIC_PROOF_INVENTORY = [
  WEALTH_ACCUMULATION_CAPACITY_FIXTURE,
  WEALTH_TIMING_WINDOW_FIXTURE,
  WEALTH_BUCKET_SAFE_INCOME_SOURCE_FIXTURE,
  HEALTH_CONSTITUTION_BASELINE_FIXTURE,
  HEALTH_RECOVERY_CAUTION_FIXTURE,
  HEALTH_BUCKET_SAFE_TIMING_SENSITIVE_FIXTURE,
] as const;