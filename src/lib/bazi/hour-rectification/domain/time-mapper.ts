// Hour Rectification v2 — time-mapper (#hour-rectification-engine, event-based lane). Turns a ranked
// ยาม into a human time estimate. Pure — no engine/LLM/file access.
//
// HONEST CONSTRAINT (spec §"ความจริงเชิงศาสตร์"): a ยาม is a 2-HOUR window and the chart is
// identical for every minute inside it — so we must NOT invent a single minute like 08:23 (that
// would fake a precision the astrology can't have). We show the MIDPOINT as a readable point
// ("~08:00") plus the true 2-hour range ("07:00–09:00"). The midpoint is canonical: it sits 1 hour
// from each boundary, so a solar-time correction (~20 min) can never push it out of the ยาม.
//
// When the top two ยาม are ADJACENT and score CLOSE, we widen the range across the boundary rather
// than pretend one won cleanly ("late 卯 into 辰, ~06:00–09:00").

import { HOUR_BRANCHES, HOUR_BRANCH_MID_TIME, type HourBranch } from "./types";

// Minimal structural input — decoupled from the full RankedYam so this file depends on nothing but
// a branch and its score. Callers pass the scorer's ranked list (already sorted best-first).
export type RankedForTime = { hourBranch: HourBranch; score: number };

export type TimeEstimate = {
  hourBranch: HourBranch; // the canonical winning ยาม
  point: string; // "HH:MM" — the midpoint, the value fed into a full-chart calculator
  rangeStart: string; // "HH:MM"
  rangeEnd: string; // "HH:MM"
  spansAdjacent: boolean; // true = the range deliberately crosses into an adjacent ยาม
};

const MINUTES_PER_DAY = 24 * 60;

function midMinutes(branch: HourBranch): number {
  const [h, m] = HOUR_BRANCH_MID_TIME[branch].split(":").map(Number);
  return (h * 60 + m) % MINUTES_PER_DAY;
}

function formatMinutes(min: number): string {
  const norm = ((min % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function branchIndex(branch: HourBranch): number {
  return HOUR_BRANCHES.indexOf(branch);
}

// Cyclic neighbour relation over the 12 ยาม (…亥→子… wraps). Returns "earlier" if `other` is the
// ยาม right before `branch` in the day cycle, "later" if right after, else null.
function neighbourOf(branch: HourBranch, other: HourBranch): "earlier" | "later" | null {
  const a = branchIndex(branch);
  const b = branchIndex(other);
  if ((a - 1 + 12) % 12 === b) return "earlier";
  if ((a + 1) % 12 === b) return "later";
  return null;
}

// Are two ยาม neighbours in the day cycle? (used to decide a spannable near-tie vs a genuinely
// ambiguous two-candidate result).
export function areAdjacent(a: HourBranch, b: HourBranch): boolean {
  return neighbourOf(a, b) !== null;
}

// A ยาม's own 2-hour window = midpoint ± 60 min.
export function yamWindow(branch: HourBranch): { start: string; end: string; mid: string } {
  const mid = midMinutes(branch);
  return {
    start: formatMinutes(mid - 60),
    end: formatMinutes(mid + 60),
    mid: formatMinutes(mid),
  };
}

// Build the time estimate from the ranked ยาม. `adjacentMargin` = how close the runner-up's score
// must be (within this many points of the winner) to trigger the widened cross-boundary range.
export function buildTimeEstimate(
  ranked: readonly RankedForTime[],
  adjacentMargin = 1,
): TimeEstimate | null {
  if (ranked.length === 0) return null;
  const winner = ranked[0];
  const winWindow = yamWindow(winner.hourBranch);
  const point = winWindow.mid;

  const runner = ranked[1];
  if (runner) {
    const rel = neighbourOf(winner.hourBranch, runner.hourBranch);
    const close = winner.score - runner.score <= adjacentMargin;
    if (rel && close) {
      const runnerWindow = yamWindow(runner.hourBranch);
      // Widen TOWARD the runner: if the runner is the earlier ยาม, the plausible span is "late
      // runner → end of winner" (runner.mid … winner.end); mirror for a later runner. This is the
      // 3-hour honest band the spec shows ("late 卯 → 辰"), not the full 4-hour union.
      const rangeStart = rel === "earlier" ? runnerWindow.mid : winWindow.start;
      const rangeEnd = rel === "earlier" ? winWindow.end : runnerWindow.mid;
      return { hourBranch: winner.hourBranch, point, rangeStart, rangeEnd, spansAdjacent: true };
    }
  }

  return {
    hourBranch: winner.hourBranch,
    point,
    rangeStart: winWindow.start,
    rangeEnd: winWindow.end,
    spansAdjacent: false,
  };
}
