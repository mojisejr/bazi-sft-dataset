// Hour Rectification v2 — run-events use-case (#hour-rectification-engine, event-based lane,
// RUNTIME, no LLM). Orchestrates: birth data + events → 12 hour-charts (timeline-adapter) →
// RuleScorer → time-mapper → result. Stateless & fully deterministic.
import {
  buildHourChartFacts,
  type EventsChartContext,
} from "./adapters/timeline-adapter";
import type { ChartProfileBaseInput } from "./adapters/chart-profile-adapter";
import { MIN_EVENTS, type LifeEvent } from "./domain/events";
import type { RuleContext } from "./domain/rules";
import { ruleScorer, type RankedYam } from "./domain/scorer";
import {
  areAdjacent,
  buildTimeEstimate,
  type TimeEstimate,
} from "./domain/time-mapper";

export type RunEventsInput = ChartProfileBaseInput & {
  events: LifeEvent[];
};

export type EventsTrace = {
  ruleName: string;
  steps: string[];
  rawVariables: Record<string, unknown>;
};

export type RunEventsResult =
  | {
      status: "result";
      timeEstimate: TimeEstimate;
      rankedYams: RankedYam[]; // top 3 (expert view)
      trace: EventsTrace;
      confidence: "beta";
    }
  | { status: "need_events"; reason: string }
  | { status: "inconclusive"; rankedYams: RankedYam[]; reason: string };

export const RECTIFICATION_EVENTS_RULE_NAME = "hour-rectification-event-scorer";

function buildTrace(winner: RankedYam): EventsTrace {
  const steps = winner.firedRules
    .filter((rule) => rule.weight > 0)
    .map((rule) => `${rule.ruleId} (+${rule.weight}): ${rule.because}`);
  const negatives = winner.firedRules.filter((rule) => rule.weight < 0);
  for (const neg of negatives) {
    steps.push(`${neg.ruleId} (${neg.weight}): ${neg.because}`);
  }
  steps.push(
    `สรุป: ยาม${winner.hourBranch} (${winner.label}) คะแนนรวม ${winner.score} จาก ${winner.firedRules.length} กฎ`,
  );
  return {
    ruleName: RECTIFICATION_EVENTS_RULE_NAME,
    steps,
    rawVariables: {
      hourBranch: winner.hourBranch,
      score: winner.score,
      eventsMatched: winner.eventsMatched,
      firedRules: winner.firedRules,
    },
  };
}

export async function runRectificationByEvents(
  input: RunEventsInput,
  precomputed?: EventsChartContext,
): Promise<RunEventsResult> {
  const { events, ...base } = input;

  if (events.length < MIN_EVENTS) {
    return {
      status: "need_events",
      reason: `ต้องการเหตุการณ์อย่างน้อย ${MIN_EVENTS} อย่าง (พร้อมปีเกิดเหตุ) เพื่อสอบยาม`,
    };
  }

  // Allow the caller/tests to inject a precomputed 12-chart context; otherwise compute it.
  const { facts12, birthYear } = precomputed ?? (await buildHourChartFacts(base));
  const ctx: RuleContext = { gender: base.gender };
  const ranked = ruleScorer.score(facts12, events, ctx, birthYear);

  const winner = ranked[0];
  const runner = ranked[1];
  const top3 = ranked.slice(0, 3);

  // Inconclusive: no positive signal at all.
  if (!winner || winner.score <= 0) {
    return {
      status: "inconclusive",
      rankedYams: top3,
      reason: "สัญญาณจากเหตุการณ์ยังไม่พอชี้ยาม — ลองเพิ่มเหตุการณ์ หรือใช้แบบตอบคำถาม (quiz)",
    };
  }

  // Count how many ยาม share the winning score. 1 = clear winner. 2 adjacent = spannable range.
  // 2 non-adjacent, or ≥3 tied, = genuinely ambiguous → inconclusive (don't fake a confident time
  // just because the canonical sort happened to place two neighbours at the top).
  const tiedAtTop = ranked.filter((r) => r.score === winner.score);
  if (tiedAtTop.length >= 3) {
    return {
      status: "inconclusive",
      rankedYams: top3,
      reason: "มีหลายยามที่เป็นไปได้พอ ๆ กัน — เพิ่มเหตุการณ์เพื่อให้ชี้ชัดขึ้น",
    };
  }
  if (
    tiedAtTop.length === 2 &&
    runner &&
    !areAdjacent(winner.hourBranch, runner.hourBranch)
  ) {
    return {
      status: "inconclusive",
      rankedYams: top3,
      reason: "มี 2 ยามที่เป็นไปได้พอ ๆ กันและไม่ติดกัน — เพิ่มเหตุการณ์เพื่อให้ชี้ชัดขึ้น",
    };
  }

  const timeEstimate = buildTimeEstimate(ranked);
  if (!timeEstimate) {
    return {
      status: "inconclusive",
      rankedYams: top3,
      reason: "ไม่สามารถประเมินเวลาได้",
    };
  }

  return {
    status: "result",
    timeEstimate,
    rankedYams: top3,
    trace: buildTrace(winner),
    confidence: "beta",
  };
}
