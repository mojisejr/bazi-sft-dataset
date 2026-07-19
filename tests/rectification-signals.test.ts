// Hour Rectification v2 — signals + interaction-tables unit tests (#hour-rectification-engine,
// event-based lane, TIER 1 "โครงสร้าง"). 100% deterministic: no LLM, no Date, no DB, no network —
// every expected value is a CLASSICAL constant (六合/三合/冲/害/刑/桃花/天干五合) hand-verified
// against the tables, so an assertion failing here means a real regression in signals.ts or
// interaction-tables.ts, never flakiness.
//
// The chart FACTS below are hand-built (not engine-computed) so the maths is fully pinned: hour
// pillar 丙辰 with 藏干 戊/乙/癸, day master 癸, day branch 亥. Against a 癸 day master the hour's
// stems resolve to KNOWN ten-gods: 丙=正财 (wealth), 戊=正官 (authority), 乙=食神 (output),
// 癸=比肩 (peer) — the star set every discriminating rule keys off.
import { describe, expect, test } from "vitest";

import { buildYearSignal, type HourChartFacts } from "@/lib/bazi/hour-rectification/domain/signals";
import {
  branchClash,
  branchHalfSanHe,
  branchHarm,
  branchPunishment,
  branchSixHe,
  peachBlossomBranch,
  stemClash,
  stemCombine,
} from "@/lib/bazi/hour-rectification/domain/interaction-tables";

// ── interaction-tables — direct classical-table queries ───────────────────────────────────────────
describe("interaction-tables — classical branch/stem relations", () => {
  test("六合 (six-combination): 子丑 / 辰酉, and non-pairs are false", () => {
    expect(branchSixHe("子", "丑")).toBe(true);
    expect(branchSixHe("辰", "酉")).toBe(true);
    // order-independent (normalizeBranchPairKey sorts by branch order)
    expect(branchSixHe("酉", "辰")).toBe(true);
    expect(branchSixHe("子", "午")).toBe(false); // that's a 冲, not a 合
  });

  test("冲 (clash): 子午 / 辰戌, order-independent, non-pairs false", () => {
    expect(branchClash("子", "午")).toBe(true);
    expect(branchClash("辰", "戌")).toBe(true);
    expect(branchClash("戌", "辰")).toBe(true);
    expect(branchClash("子", "丑")).toBe(false);
  });

  test("半三合: two of a 三合 trio present (申子辰 → 申子 true); same branch is not a half-合", () => {
    expect(branchHalfSanHe("申", "子")).toBe(true); // 申子辰 water trio
    expect(branchHalfSanHe("子", "辰")).toBe(true);
    expect(branchHalfSanHe("寅", "午")).toBe(true); // 寅午戌 fire trio
    expect(branchHalfSanHe("子", "午")).toBe(false); // different trios
    expect(branchHalfSanHe("申", "申")).toBe(false); // a === b guard
  });

  test("害 (harm): 子未 / 酉戌 true; a clash pair is not a harm", () => {
    expect(branchHarm("子", "未")).toBe(true);
    expect(branchHarm("酉", "戌")).toBe(true);
    expect(branchHarm("子", "午")).toBe(false);
  });

  test("刑 (punishment): 子卯 pair, 寅巳申 & 丑戌未 trios (any two), 辰 self-punishment; benign pairs false", () => {
    expect(branchPunishment("子", "卯")).toBe(true); // 子卯 pair key
    expect(branchPunishment("寅", "巳")).toBe(true); // 寅巳申 trio, any two
    expect(branchPunishment("丑", "戌")).toBe(true); // 丑戌未 trio, any two
    expect(branchPunishment("丑", "辰")).toBe(false); // 辰 is NOT in any classical 刑 trio
    expect(branchPunishment("辰", "辰")).toBe(true); // 辰 ∈ self-punishment set
    expect(branchPunishment("子", "子")).toBe(false); // 子 ∉ self-punishment set
    expect(branchPunishment("子", "丑")).toBe(false);
  });

  test("天干五合 (stem combine): 甲己 / 戊癸 / 丙辛 true; non-combine false", () => {
    expect(stemCombine("甲", "己")).toBe(true);
    expect(stemCombine("戊", "癸")).toBe(true);
    expect(stemCombine("丙", "辛")).toBe(true);
    expect(stemCombine("甲", "庚")).toBe(false); // that's a stem clash, not a combine
  });

  test("天干相冲 (stem clash): 甲庚 / 丙壬 true, order-independent; a combine pair is not a clash", () => {
    expect(stemClash("甲", "庚")).toBe(true);
    expect(stemClash("庚", "甲")).toBe(true);
    expect(stemClash("丙", "壬")).toBe(true);
    expect(stemClash("戊", "癸")).toBe(false);
  });

  test("桃花 (peach-blossom) branch of a natal anchor's 三合 trio (沐浴 branch)", () => {
    expect(peachBlossomBranch("子")).toBe("酉"); // 申子辰 → 酉
    expect(peachBlossomBranch("寅")).toBe("卯"); // 寅午戌 → 卯
    expect(peachBlossomBranch("巳")).toBe("午"); // 巳酉丑 → 午
    expect(peachBlossomBranch("亥")).toBe("子"); // 亥卯未 → 子
    expect(peachBlossomBranch("辰")).toBe("酉"); // 辰 ∈ 申子辰 → 酉
  });
});

// ── buildYearSignal — against a KNOWN hand-built chart ─────────────────────────────────────────────
// Hour pillar 丙辰 · 藏干 戊/乙/癸 · day master 癸 · day branch 亥. Two 大運 stages (0–10: 乙丑,
// 10–20: 丙寅). birthYear 1989 (ฟีม's real chart). All expected liuNian come from annualGanzhi
// (base 1984 = 甲子): 1993 = 癸酉, 1994 = 甲戌, 1991 = 辛未.
const FACTS: HourChartFacts = {
  hourBranch: "辰",
  hourStem: "丙",
  hourHiddenStems: ["戊", "乙", "癸"],
  dayMaster: "癸",
  dayBranch: "亥",
  daYun: [
    { startAge: 0, endAge: 10, stem: "乙", branch: "丑" },
    { startAge: 10, endAge: 20, stem: "丙", branch: "寅" },
  ],
};
const BIRTH_YEAR = 1989;

describe("buildYearSignal — hour-anchored relations for a known chart", () => {
  test("1993 (癸酉): 流年酉 六合 hour 辰 (no clash), 大運 乙丑 active at age 4 (丑 has no 刑 with 辰)", () => {
    const s = buildYearSignal(FACTS, 1993, BIRTH_YEAR);
    expect(s.year).toBe(1993);
    expect(s.liuNian).toEqual({ stem: "癸", branch: "酉" });
    // 流年 branch 酉 六合 hour branch 辰 → the marriage/childbirth "combine" trigger.
    expect(s.lnBranchVsHour.sixHe).toBe(true);
    expect(s.lnBranchVsHour.clash).toBe(false);
    // 流年 stem 癸 vs hour stem 丙 — neither 五合 nor 冲.
    expect(s.lnStemVsHour).toEqual({ combine: false, clash: false });
    // age = 1993 − 1989 = 4 → first 大運 stage 乙丑 is active. 丑 vs 辰 is NOT a 刑 (辰 ∉ 丑戌未) —
    // it's no relation at all.
    expect(s.daYun).toEqual({ stem: "乙", branch: "丑" });
    expect(s.dyBranchVsHour?.punishment).toBe(false);
  });

  test("1994 (甲戌): 流年戌 冲 hour 辰 (not a 六合)", () => {
    const s = buildYearSignal(FACTS, 1994, BIRTH_YEAR);
    expect(s.liuNian).toEqual({ stem: "甲", branch: "戌" });
    expect(s.lnBranchVsHour.clash).toBe(true);
    expect(s.lnBranchVsHour.sixHe).toBe(false);
  });

  test("1991 (辛未): 流年 stem 辛 五合 hour stem 丙", () => {
    const s = buildYearSignal(FACTS, 1991, BIRTH_YEAR);
    expect(s.liuNian).toEqual({ stem: "辛", branch: "未" });
    expect(s.lnStemVsHour.combine).toBe(true);
  });

  test("hour stars: 丙=正财→wealth, 戊=正官→authority, 乙=食神→output, 癸=比肩→peer; no resource", () => {
    const s = buildYearSignal(FACTS, 2000, BIRTH_YEAR);
    expect(s.hourStars).toEqual({
      wealth: true,
      authority: true,
      output: true,
      resource: false,
      peer: true,
    });
    expect(s.hourStemTenGod).toBe("正财");
    expect(s.hourHiddenTenGods).toEqual(["正官", "食神", "比肩"]);
  });

  test("hourIsPeachBlossom: false when hour ≠ 桃花 branch, true when it equals it", () => {
    // day branch 亥 → 桃花 = 子. Hour 辰 ≠ 子 → not peach-blossom.
    const notPeach = buildYearSignal(FACTS, 2000, BIRTH_YEAR);
    expect(notPeach.hourIsPeachBlossom).toBe(false);
    // Same chart but the hour branch IS the 桃花 branch (子) → peach-blossom true.
    const peachFacts: HourChartFacts = { ...FACTS, hourBranch: "子" };
    const peach = buildYearSignal(peachFacts, 2000, BIRTH_YEAR);
    expect(peach.hourIsPeachBlossom).toBe(true);
  });

  test("no active 大運 when the event age is outside every stage → daYun/dy relations null", () => {
    // age = 2020 − 1989 = 31, past both stages (last ends at 20).
    const s = buildYearSignal(FACTS, 2020, BIRTH_YEAR);
    expect(s.daYun).toBeNull();
    expect(s.dyBranchVsHour).toBeNull();
    expect(s.dyStemVsHour).toBeNull();
  });

  test("大運 stage boundary age is not dropped (regression: inclusive/exclusive endAge)", () => {
    // The stages are contiguous & exclusive ([0,10), [10,20)) — the convention timeline-adapter now
    // guarantees. The boundary age must land in the NEXT stage, never fall through to null (the
    // earlier bug used the engine's inclusive endAge and lost 大運 at ages 9,19,29…).
    const age9 = buildYearSignal(FACTS, 1998, BIRTH_YEAR); // age 9 → still stage 0
    expect(age9.daYun).toEqual({ stem: "乙", branch: "丑" });
    const age10 = buildYearSignal(FACTS, 1999, BIRTH_YEAR); // age 10 boundary → stage 1
    expect(age10.daYun).toEqual({ stem: "丙", branch: "寅" });
  });
});
