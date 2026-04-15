export const TRACE_RULE_NAMES = {
  mingGong: "MingGong_ZhongQi_Adjustment",
  strengthScore: "StrengthScore_WeightedSeasonalSupport",
} as const;

export const TRACE_STEP_KEYS = {
  mingGong: {
    readBranches: "ming_gong.read_branches",
    resolveBoundary: "ming_gong.resolve_boundary",
    finalize: "ming_gong.finalize",
  },
  strengthScore: {
    weightStages: "strength_score.weight_stages",
    addRelations: "strength_score.add_relations",
    applyPenalties: "strength_score.apply_penalties",
  },
} as const;