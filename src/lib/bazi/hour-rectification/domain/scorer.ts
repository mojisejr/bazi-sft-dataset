// Hour Rectification v2 — scorer (#hour-rectification-engine, event-based lane). Runs the rule table
// over every (hour × event) and ranks the 12 ยาม. Pure + 100% deterministic — no randomness, no
// Date, no LLM. Same inputs → same ranking, always.

import { HOUR_BRANCHES, HOUR_BRANCH_LABELS_TH, type HourBranch } from "./types";
import type { LifeEvent, EventType } from "./events";
import { buildYearSignal, type HourChartFacts } from "./signals";
import { rulesForEvent, type RuleContext } from "./rules";

export type FiredRule = {
  ruleId: string;
  event: EventType;
  year: number;
  weight: number;
  because: string;
  weak: boolean;
};

export type RankedYam = {
  hourBranch: HourBranch;
  label: string;
  score: number;
  firedRules: FiredRule[];
  eventsMatched: number; // distinct events that gave this hour any POSITIVE support
  confidence: "beta";
};

export interface HourScorer {
  score(
    facts12: readonly HourChartFacts[],
    events: readonly LifeEvent[],
    ctx: RuleContext,
    birthYear: number,
  ): RankedYam[];
}

const branchOrder = new Map<HourBranch, number>(
  HOUR_BRANCHES.map((branch, index) => [branch, index]),
);

export const ruleScorer: HourScorer = {
  score(facts12, events, ctx, birthYear) {
    const ranked: RankedYam[] = facts12.map((facts) => {
      const firedRules: FiredRule[] = [];
      const positiveEventKeys = new Set<string>();
      let score = 0;

      for (const event of events) {
        const signal = buildYearSignal(facts, event.year, birthYear);
        for (const rule of rulesForEvent(event.type)) {
          if (!rule.when(signal, ctx)) continue;
          const label = HOUR_BRANCH_LABELS_TH[facts.hourBranch];
          firedRules.push({
            ruleId: rule.id,
            event: event.type,
            year: event.year,
            weight: rule.weight,
            because: rule.because(signal, label),
            weak: Boolean(rule.weak),
          });
          score += rule.weight;
          if (rule.weight > 0) positiveEventKeys.add(`${event.type}:${event.year}`);
        }
      }

      return {
        hourBranch: facts.hourBranch,
        label: HOUR_BRANCH_LABELS_TH[facts.hourBranch],
        score,
        firedRules,
        eventsMatched: positiveEventKeys.size,
        confidence: "beta" as const,
      };
    });

    // Tie-break (all deterministic): total score → number of rules fired → number of distinct
    // events matched → canonical ยาม order. Matches the spec's locked ordering.
    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.firedRules.length !== a.firedRules.length) {
        return b.firedRules.length - a.firedRules.length;
      }
      if (b.eventsMatched !== a.eventsMatched) return b.eventsMatched - a.eventsMatched;
      return (branchOrder.get(a.hourBranch) ?? 0) - (branchOrder.get(b.hourBranch) ?? 0);
    });

    return ranked;
  },
};
