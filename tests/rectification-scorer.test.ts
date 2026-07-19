// Hour Rectification v2 — scorer tests (#hour-rectification-engine, event-based lane, TIER 1).
// ruleScorer.score is the deterministic ranker: it walks the rule table over every (hour × event),
// sums weights, and sorts with a locked tie-break (score → #firedRules → #eventsMatched → canonical
// ยาม order). Facts are hand-built HourChartFacts so the exact score of the winner is derivable by
// hand; two deliberately inert ยาม exercise the final HOUR_BRANCHES tie-break; a double run proves
// same-inputs → identical-output.
import { describe, expect, test } from "vitest";

import { ruleScorer } from "@/lib/bazi/hour-rectification/domain/scorer";
import type { HourChartFacts } from "@/lib/bazi/hour-rectification/domain/signals";
import type { LifeEvent } from "@/lib/bazi/hour-rectification/domain/events";

const BIRTH_YEAR = 1989;

// Common natal context shared by all candidate hours (only the hour pillar differs — the
// discrimination principle). Day master 癸, day branch 亥 (→ 桃花 = 子), no 大運 in play.
const DAY = { dayMaster: "癸", dayBranch: "亥", daYun: [] as HourChartFacts["daYun"] };

// WINNER — hour 丙辰 · 藏干 戊/乙/癸. Against 癸 the stem 丙 = 正财 → wealth star present.
const HOUR_CHEN: HourChartFacts = {
  hourBranch: "辰",
  hourStem: "丙",
  hourHiddenStems: ["戊", "乙", "癸"],
  ...DAY,
};
// INERT — neither is the 桃花 branch (子) and neither relates to a 酉 流年, so both score exactly 0.
const HOUR_WU: HourChartFacts = { hourBranch: "午", hourStem: "庚", hourHiddenStems: ["丁", "己"], ...DAY };
const HOUR_WEI: HourChartFacts = { hourBranch: "未", hourStem: "乙", hourHiddenStems: ["己", "丁", "乙"], ...DAY };

// A single marriage event in 1993 = 癸酉. 流年 branch 酉 六合 hour branch 辰 (only 辰 relates), so
// MAR-1 (+3, male wealth star + 六合) and MAR-2 (+2, 六合) both fire on 辰 → score 5, 2 rules,
// 1 event matched. 午 and 未 have no relation to 酉 and are not 桃花 → 0 across the board.
const EVENTS: LifeEvent[] = [{ type: "marriage", year: 1993 }];
const MALE = { gender: "male" };

describe("ruleScorer.score — deterministic ranking + locked tie-break", () => {
  test("clear winner: 辰 scores 5 (MAR-1 +3, MAR-2 +2) from one marriage event", () => {
    const ranked = ruleScorer.score([HOUR_CHEN, HOUR_WU, HOUR_WEI], EVENTS, MALE, BIRTH_YEAR);

    const winner = ranked[0];
    expect(winner.hourBranch).toBe("辰");
    expect(winner.score).toBe(5);
    expect(winner.firedRules).toHaveLength(2);
    expect(winner.firedRules.map((r) => r.ruleId).sort()).toEqual(["MAR-1", "MAR-2"]);
    expect(winner.eventsMatched).toBe(1);
    expect(winner.label).toBe("มะโรง"); // 辰 Thai label
    expect(winner.confidence).toBe("beta");
  });

  test("tie-break: two 0-score inert ยาม fall back to canonical HOUR_BRANCHES order (午 before 未)", () => {
    const ranked = ruleScorer.score([HOUR_CHEN, HOUR_WEI, HOUR_WU], EVENTS, MALE, BIRTH_YEAR);
    // Even though 未 was passed before 午 in the input array, the tie-break (both score 0, 0 rules,
    // 0 events) resolves by ยาม order: 午 (index 6) precedes 未 (index 7).
    expect(ranked.map((r) => r.hourBranch)).toEqual(["辰", "午", "未"]);
    expect(ranked[1].score).toBe(0);
    expect(ranked[2].score).toBe(0);
  });

  test("output is sorted strictly non-increasing by score", () => {
    const ranked = ruleScorer.score([HOUR_WU, HOUR_CHEN, HOUR_WEI], EVENTS, MALE, BIRTH_YEAR);
    for (let i = 1; i < ranked.length; i += 1) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  test("fully deterministic: identical inputs → byte-identical output across two runs", () => {
    const facts = [HOUR_CHEN, HOUR_WU, HOUR_WEI];
    const first = ruleScorer.score(facts, EVENTS, MALE, BIRTH_YEAR);
    const second = ruleScorer.score(facts, EVENTS, MALE, BIRTH_YEAR);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  test("gender flips the spouse star: female (authority) does NOT get MAR-1's wealth support on 辰", () => {
    // 辰's wealth star (丙=正财) supports a MALE marriage; a female keys off authority (官). 戊=正官
    // is also in 辰's 藏干, so MAR-1 still fires for female too — but MAR-1 is gender-sensitive, so we
    // assert the male/female branch is actually exercised by checking an authority-less hour.
    const noAuthorityHour: HourChartFacts = {
      hourBranch: "辰",
      hourStem: "丙", // 正财 (wealth) only
      hourHiddenStems: ["乙"], // 食神 (output) — no authority star
      ...DAY,
    };
    const male = ruleScorer.score([noAuthorityHour], EVENTS, { gender: "male" }, BIRTH_YEAR);
    const female = ruleScorer.score([noAuthorityHour], EVENTS, { gender: "female" }, BIRTH_YEAR);
    // male: wealth present + 六合 → MAR-1 fires (+3) + MAR-2 (+2) = 5
    expect(male[0].firedRules.map((r) => r.ruleId).sort()).toEqual(["MAR-1", "MAR-2"]);
    expect(male[0].score).toBe(5);
    // female: no authority star → MAR-1 silent; only MAR-2 (+2) fires
    expect(female[0].firedRules.map((r) => r.ruleId)).toEqual(["MAR-2"]);
    expect(female[0].score).toBe(2);
  });
});
