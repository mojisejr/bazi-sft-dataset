// Hour Rectification v2 — rule-table tests (#hour-rectification-engine, event-based lane, TIER 1).
// rules.ts is THE artifact ซินแส refines, so every rule gets a fire case (a YearSignal that
// satisfies its `when`) AND a no-fire case, plus its weight + weak flag pinned. Pure & deterministic:
// rules read only a YearSignal + { gender }, so we hand-build minimal signals instead of computing
// charts — every branch/star toggle is set explicitly, nothing inferred.
import { describe, expect, test } from "vitest";

import { RULES, rulesForEvent, type Rule } from "@/lib/bazi/hour-rectification/domain/rules";
import type { YearSignal } from "@/lib/bazi/hour-rectification/domain/signals";

type BranchRel = YearSignal["lnBranchVsHour"];
type StemRel = YearSignal["lnStemVsHour"];
type Stars = YearSignal["hourStars"];

const NO_BRANCH_REL: BranchRel = {
  sixHe: false,
  halfSanHe: false,
  clash: false,
  harm: false,
  punishment: false,
};
const NO_STEM_REL: StemRel = { combine: false, clash: false };
const NO_STARS: Stars = {
  wealth: false,
  authority: false,
  output: false,
  resource: false,
  peer: false,
};

const branchRel = (o: Partial<BranchRel>): BranchRel => ({ ...NO_BRANCH_REL, ...o });
const stemRel = (o: Partial<StemRel>): StemRel => ({ ...NO_STEM_REL, ...o });
const stars = (o: Partial<Stars>): Stars => ({ ...NO_STARS, ...o });

// A fully-inert baseline YearSignal: no relations, no stars. Each case overrides only what it needs.
function makeSignal(o: Partial<YearSignal> = {}): YearSignal {
  return {
    year: 2000,
    liuNian: { stem: "甲", branch: "子" },
    daYun: null,
    lnBranchVsHour: NO_BRANCH_REL,
    lnStemVsHour: NO_STEM_REL,
    dyBranchVsHour: null,
    dyStemVsHour: null,
    hourStars: NO_STARS,
    hourStemTenGod: "",
    hourHiddenTenGods: [],
    hourIsPeachBlossom: false,
    liuNianTenGod: "",
    ...o,
  };
}

function ruleById(id: string): Rule {
  const rule = RULES.find((r) => r.id === id);
  if (!rule) throw new Error(`rule ${id} not found`);
  return rule;
}

const MALE = { gender: "male" };
const FEMALE = { gender: "female" };

// One row per rule: the signal that MUST fire it, one that must NOT, plus the ctx (gender matters
// for MAR-1/CHI-2), and the expected weight + weak flag as declared in rules.ts.
type Case = {
  id: string;
  fire: YearSignal;
  fireCtx: { gender: string };
  noFire: YearSignal;
  noFireCtx: { gender: string };
  weight: number;
  weak: boolean;
};

const CASES: Case[] = [
  // ── marriage ──
  {
    id: "MAR-1", // male: wealth star + 六合/三合 ; female: authority star instead
    fire: makeSignal({ hourStars: stars({ wealth: true }), lnBranchVsHour: branchRel({ sixHe: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ hourStars: stars({ wealth: true }) }), // star present but no combine
    noFireCtx: MALE,
    weight: 3,
    weak: false,
  },
  {
    id: "MAR-2", // any 六合/三合 with the hour
    fire: makeSignal({ lnBranchVsHour: branchRel({ halfSanHe: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ lnBranchVsHour: branchRel({ clash: true }) }),
    noFireCtx: MALE,
    weight: 2,
    weak: false,
  },
  {
    id: "MAR-3", // hour IS the 桃花 branch
    fire: makeSignal({ hourIsPeachBlossom: true }),
    fireCtx: MALE,
    noFire: makeSignal({ hourIsPeachBlossom: false }),
    noFireCtx: MALE,
    weight: 1,
    weak: false,
  },
  {
    id: "MAR-4", // 冲 the hour → negative flag
    fire: makeSignal({ lnBranchVsHour: branchRel({ clash: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ lnBranchVsHour: branchRel({ sixHe: true }) }),
    noFireCtx: MALE,
    weight: -1,
    weak: false,
  },
  // ── career_change ──
  {
    id: "CAR-1", // (官殺 or 食傷 star) + 流年 stirs the hour (combine/clash/stem)
    fire: makeSignal({ hourStars: stars({ authority: true }), lnStemVsHour: stemRel({ clash: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ hourStars: stars({ authority: true }) }), // star but nothing stirs
    noFireCtx: MALE,
    weight: 3,
    weak: false,
  },
  {
    id: "CAR-2", // 流年 冲 the hour
    fire: makeSignal({ lnBranchVsHour: branchRel({ clash: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ lnBranchVsHour: branchRel({ sixHe: true }) }),
    noFireCtx: MALE,
    weight: 2,
    weak: false,
  },
  {
    id: "CAR-3", // 大運 combines or clashes the hour
    fire: makeSignal({ dyBranchVsHour: branchRel({ sixHe: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ dyBranchVsHour: branchRel({ harm: true }) }), // harm is neither combine nor clash
    noFireCtx: MALE,
    weight: 1,
    weak: false,
  },
  // ── serious_illness ──
  {
    id: "ILL-1", // 流年 冲 the hour
    fire: makeSignal({ lnBranchVsHour: branchRel({ clash: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ lnBranchVsHour: branchRel({ harm: true }) }),
    noFireCtx: MALE,
    weight: 3,
    weak: false,
  },
  {
    id: "ILL-2", // 流年 刑 the hour
    fire: makeSignal({ lnBranchVsHour: branchRel({ punishment: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ lnBranchVsHour: branchRel({ harm: true }) }),
    noFireCtx: MALE,
    weight: 2,
    weak: false,
  },
  {
    id: "ILL-3", // 大運 冲 the hour
    fire: makeSignal({ dyBranchVsHour: branchRel({ clash: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ dyBranchVsHour: branchRel({ sixHe: true }) }),
    noFireCtx: MALE,
    weight: 2,
    weak: false,
  },
  // ── major_loss (weak reframe) ──
  {
    id: "LOSS-1",
    fire: makeSignal({ lnBranchVsHour: branchRel({ clash: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ lnBranchVsHour: branchRel({ sixHe: true }) }),
    noFireCtx: MALE,
    weight: 2,
    weak: true,
  },
  {
    id: "LOSS-2", // 害 OR 刑
    fire: makeSignal({ lnBranchVsHour: branchRel({ harm: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ lnBranchVsHour: branchRel({ clash: true }) }), // clash alone ≠ harm/刑
    noFireCtx: MALE,
    weight: 1,
    weak: true,
  },
  // ── childbirth ──
  {
    id: "CHI-1", // 六合/三合 with the hour (子女宮)
    fire: makeSignal({ lnBranchVsHour: branchRel({ sixHe: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ lnBranchVsHour: branchRel({ clash: true }) }),
    noFireCtx: MALE,
    weight: 3,
    weak: false,
  },
  {
    id: "CHI-2", // male: authority star ; female: output star — both need 流年 to stir the hour
    fire: makeSignal({ hourStars: stars({ authority: true }), lnBranchVsHour: branchRel({ sixHe: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ hourStars: stars({ authority: true }) }), // star but hour not stirred
    noFireCtx: MALE,
    weight: 3,
    weak: false,
  },
  {
    id: "CHI-3", // 大運 combines the hour
    fire: makeSignal({ dyBranchVsHour: branchRel({ halfSanHe: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ dyBranchVsHour: branchRel({ clash: true }) }), // clash is not a combine for CHI-3
    noFireCtx: MALE,
    weight: 2,
    weak: false,
  },
  // ── relocation ──
  {
    id: "REL-1", // 流年 冲 the hour (驿马)
    fire: makeSignal({ lnBranchVsHour: branchRel({ clash: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ lnBranchVsHour: branchRel({ sixHe: true }) }),
    noFireCtx: MALE,
    weight: 3,
    weak: false,
  },
  {
    id: "REL-2", // 六合 the hour
    fire: makeSignal({ lnBranchVsHour: branchRel({ sixHe: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ lnBranchVsHour: branchRel({ halfSanHe: true }) }), // REL-2 wants sixHe specifically
    noFireCtx: MALE,
    weight: 1,
    weak: false,
  },
  {
    id: "REL-3", // 大運 冲 the hour
    fire: makeSignal({ dyBranchVsHour: branchRel({ clash: true }) }),
    fireCtx: MALE,
    noFire: makeSignal({ dyBranchVsHour: branchRel({ sixHe: true }) }),
    noFireCtx: MALE,
    weight: 1,
    weak: false,
  },
];

describe("RULES — every rule fires on its trigger, stays silent otherwise, and carries its declared weight/weak", () => {
  test("the case table covers every rule in RULES exactly once", () => {
    const caseIds = CASES.map((c) => c.id).sort();
    const ruleIds = RULES.map((r) => r.id).sort();
    expect(caseIds).toEqual(ruleIds);
  });

  test.each(CASES)("$id fires on trigger, silent otherwise, weight/weak match", (c) => {
    const rule = ruleById(c.id);
    expect(rule.when(c.fire, c.fireCtx)).toBe(true);
    expect(rule.when(c.noFire, c.noFireCtx)).toBe(false);
    expect(rule.weight).toBe(c.weight);
    expect(Boolean(rule.weak)).toBe(c.weak);
  });
});

// The two rules whose spouse/child star depends on gender get an explicit both-gender check — a
// silent swap of the male/female branch is the most likely refinement regression.
describe("gender-dependent rules — MAR-1 (財 male / 官 female) and CHI-2 (官 male / 食傷 female)", () => {
  test("MAR-1: male keys off WEALTH, female keys off AUTHORITY", () => {
    const mar1 = ruleById("MAR-1");
    const combine = branchRel({ sixHe: true });
    // male: wealth fires, authority-only does NOT
    expect(mar1.when(makeSignal({ hourStars: stars({ wealth: true }), lnBranchVsHour: combine }), MALE)).toBe(true);
    expect(mar1.when(makeSignal({ hourStars: stars({ authority: true }), lnBranchVsHour: combine }), MALE)).toBe(false);
    // female: authority fires, wealth-only does NOT
    expect(mar1.when(makeSignal({ hourStars: stars({ authority: true }), lnBranchVsHour: combine }), FEMALE)).toBe(true);
    expect(mar1.when(makeSignal({ hourStars: stars({ wealth: true }), lnBranchVsHour: combine }), FEMALE)).toBe(false);
  });

  test("CHI-2: male keys off AUTHORITY, female keys off OUTPUT", () => {
    const chi2 = ruleById("CHI-2");
    const stir = branchRel({ sixHe: true }); // any lnStirsHour trigger
    // male: authority fires, output-only does NOT
    expect(chi2.when(makeSignal({ hourStars: stars({ authority: true }), lnBranchVsHour: stir }), MALE)).toBe(true);
    expect(chi2.when(makeSignal({ hourStars: stars({ output: true }), lnBranchVsHour: stir }), MALE)).toBe(false);
    // female: output fires, authority-only does NOT
    expect(chi2.when(makeSignal({ hourStars: stars({ output: true }), lnBranchVsHour: stir }), FEMALE)).toBe(true);
    expect(chi2.when(makeSignal({ hourStars: stars({ authority: true }), lnBranchVsHour: stir }), FEMALE)).toBe(false);
  });
});

describe("rulesForEvent — partitions RULES by event type", () => {
  test("marriage → MAR-*, childbirth → CHI-*, and every returned rule matches the event", () => {
    expect(rulesForEvent("marriage").map((r) => r.id)).toEqual(["MAR-1", "MAR-2", "MAR-3", "MAR-4"]);
    expect(rulesForEvent("childbirth").map((r) => r.id)).toEqual(["CHI-1", "CHI-2", "CHI-3"]);
    for (const event of ["career_change", "serious_illness", "major_loss", "relocation"] as const) {
      expect(rulesForEvent(event).every((r) => r.event === event)).toBe(true);
      expect(rulesForEvent(event).length).toBeGreaterThan(0);
    }
  });
});
