// ปีชง 2570 — the Sinse's way of reading a year against a chart (ciel-os mumate-taisui-2570-001,
// plan revision 0.9, design/SINSE-REACTIONS.md). The year's pillar reacts with each of the chart's
// eight characters. A reaction is told by what it is, where it lands (which pillar, top or bottom
// character) and, for the whole year, what the year's element is to the day master. No score.
//
// Consumer-only over the frozen engine: the tables are the engine's constants, plus the Sinse's
// twelve เฮ้ง pairs in ./sinse-tables. The target pillar is any stem and branch, so a month or a
// day can be read the same way later.
import {
  CLASH_PAIRS,
  CONTROLS,
  GENERATES,
  HARM_PAIRS,
  SIX_COMBINATION_PAIRS,
  STEM_BRANCH_DESTRUCTION_PAIRS,
  STEM_CLASH_PAIRS,
  SAN_HE_GROUPS,
  STEM_COMBINATION_TRANSFORMS,
  STEM_TO_ELEMENT,
  normalizeBranchPairKey,
} from "@/lib/bazi/symbolic-engine.constants";
import { resolveCanonicalTwelveQiStage } from "@/lib/bazi/pillar-display";

import { SAMHENG_GROUPS, SINSE_HENG_PAIRS, phuaGroupOf, type PhuaGroup, type SamhengGroup } from "./sinse-tables";

export type PillarKey = "hour" | "day" | "month" | "year";
export type ChartPillar = { key: PillarKey; stem: string; branch: string };

/** Hard reactions first, in the order the page names them. */
export const REACTION_KINDS = ["chong", "samheng", "heng", "hai", "phua", "stemClash", "same", "six", "half3", "stemCombine"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];
export const HARD_REACTIONS: ReadonlySet<ReactionKind> = new Set(["chong", "samheng", "heng", "hai", "phua", "stemClash"]);

export type Reaction = {
  kind: ReactionKind;
  /** Classical name: 冲 三刑 刑 害 破 天干冲 伏吟 六合 半三合 天干合. */
  name: string;
  pillar: PillarKey;
  /** Which character of that pillar the year touches: the stem on top or the branch below. */
  at: "top" | "bottom";
  /** The chart's character that is touched, and the year's character that touches it. */
  mine: string;
  year: string;
  /** ผั่ว: the pillar it forms and the Sinse's group. ซำเฮ้ง: the three branches and the group. */
  pair?: string;
  group?: PhuaGroup | SamhengGroup;
  /** ฮะ only: the element the pair makes and how far it gets, by the engine's own rules. */
  into?: Combine;
};

/**
 * A ฮะ's outcome, read the way symbolic-engine.interactions reads one inside a chart:
 * - stem combine: `transformed` when the day master stands strong (长生 冠带 临官 帝旺) on either
 *   branch under the pair, else `supported` (resolveStemCombinationOutcomes);
 * - half triad: `blocked` when the chart and the year complete the whole triad, `supported` when the
 *   day master stands strong on either branch, else `detected` (resolveBranchCombinationOutcomes);
 * - six combination: the engine records it as `detected` with no element. 午未 making fire is the
 *   Sinse's own statement (2026-11-20), marked `source: "sinse"`.
 */
export type Combine = { element: string; status: "transformed" | "supported" | "detected" | "blocked"; source: "engine" | "sinse" };

/** The engine's strong stages, as isSupportiveTwelveQiStage in symbolic-engine.interactions (not exported there). */
const STRONG_STAGES = new Set(["长生", "临官", "帝旺", "冠带"]);
const HAN_ELEMENT: Record<string, string> = { 木: "wood", 火: "fire", 土: "earth", 金: "metal", 水: "water" };
const SINSE_SIX: Record<string, string> = { [normalizeBranchPairKey("午", "未")]: "fire" };

/** The year element's role to the day master (ดิถี), in the Sinse's five words. */
export type ElementRole = "companion" | "output" | "wealth" | "power" | "resource";
export const ROLE_TH: Record<ElementRole, string> = {
  companion: "คู่ธาตุดิถี",
  output: "ดิถีถ่ายเท",
  wealth: "โชคลาภ",
  power: "พิฆาตดิถี",
  resource: "ส่งเสริมดิถี",
};

const pairHas = (set: ReadonlySet<string>, a: string, b: string) => set.has(`${a}|${b}`) || set.has(`${b}|${a}`);
const branchPair = (set: ReadonlySet<string>, a: string, b: string) => set.has(normalizeBranchPairKey(a, b));
const element = (stem: string) => (STEM_TO_ELEMENT as Record<string, string>)[stem] ?? "";

export function elementRole(dayMasterStem: string, yearStem: string): ElementRole {
  const dm = element(dayMasterStem), yr = element(yearStem);
  if (dm === yr) return "companion";
  if ((GENERATES as Record<string, string>)[dm] === yr) return "output";
  if ((CONTROLS as Record<string, string>)[dm] === yr) return "wealth";
  if ((CONTROLS as Record<string, string>)[yr] === dm) return "power";
  return "resource";
}

/** Every reaction of a target pillar (a year, a month, a day) with a chart's pillars. */
export function reactionsWith(chart: ChartPillar[], target: { stem: string; branch: string }, dayMaster?: string): Reaction[] {
  const out: Reaction[] = [];
  const { stem: ys, branch: yb } = target;
  const strong = (branch: string) => Boolean(dayMaster) && STRONG_STAGES.has(resolveCanonicalTwelveQiStage(dayMaster!, branch));
  for (const p of chart) {
    const bottom = { pillar: p.key, at: "bottom" as const, mine: p.branch, year: yb };
    const top = { pillar: p.key, at: "top" as const, mine: p.stem, year: ys };
    // branches
    if (branchPair(CLASH_PAIRS, p.branch, yb)) out.push({ kind: "chong", name: "冲", ...bottom });
    if (branchPair(SINSE_HENG_PAIRS, p.branch, yb)) out.push({ kind: "heng", name: "刑", ...bottom });
    if (branchPair(HARM_PAIRS, p.branch, yb)) out.push({ kind: "hai", name: "害", ...bottom });
    if (p.branch === yb) out.push({ kind: "same", name: "伏吟", ...bottom });
    if (branchPair(SIX_COMBINATION_PAIRS, p.branch, yb)) {
      const sinse = SINSE_SIX[normalizeBranchPairKey(p.branch, yb)]
      out.push({ kind: "six", name: "六合", ...bottom, ...(sinse ? { into: { element: sinse, status: "detected" as const, source: "sinse" as const } } : {}) });
    }
    // half triad as the engine forms one (buildHalfSanHeInteractions): two different branches of one 三合 group
    const tri = p.branch !== yb ? SAN_HE_GROUPS.find((g) => (g.branches as readonly string[]).includes(p.branch) && (g.branches as readonly string[]).includes(yb)) : undefined;
    if (tri) {
      const third = (tri.branches as readonly string[]).find((b) => b !== p.branch && b !== yb)!;
      const whole = chart.some((q) => q.branch === third);
      const status = whole ? "blocked" : strong(p.branch) || strong(yb) ? "supported" : "detected";
      out.push({ kind: "half3", name: "半三合", ...bottom, into: { element: tri.element, status, source: "engine" } });
    }
    // ผั่ว across the two pillars: the year's stem over this branch, and this stem over the year's branch
    if (STEM_BRANCH_DESTRUCTION_PAIRS.has(`${ys}|${p.branch}`)) {
      // the year's character here is its stem (丁 over this branch), not its branch
      out.push({ kind: "phua", name: "破", ...bottom, year: ys, pair: ys + p.branch, group: phuaGroupOf(ys, p.branch) ?? undefined });
    }
    if (STEM_BRANCH_DESTRUCTION_PAIRS.has(`${p.stem}|${yb}`)) {
      out.push({ kind: "phua", name: "破", ...top, mine: p.stem, year: yb, pair: p.stem + yb, group: phuaGroupOf(p.stem, yb) ?? undefined });
    }
    // stems
    if (pairHas(STEM_CLASH_PAIRS, p.stem, ys)) out.push({ kind: "stemClash", name: "天干冲", ...top });
    const han = STEM_COMBINATION_TRANSFORMS.get(`${p.stem}|${ys}`) ?? STEM_COMBINATION_TRANSFORMS.get(`${ys}|${p.stem}`);
    if (han) out.push({ kind: "stemCombine", name: "天干合", ...top, into: { element: HAN_ELEMENT[han] ?? "", status: strong(p.branch) || strong(yb) ? "transformed" : "supported", source: "engine" } });
  }
  // ซำเฮ้ง: the target's branch plus two other branches of the same group in the chart
  for (const [group, members] of Object.entries(SAMHENG_GROUPS) as Array<[SamhengGroup, readonly string[]]>) {
    if (!members.includes(yb)) continue;
    const hits = chart.filter((p) => p.branch !== yb && members.includes(p.branch));
    const distinct = [...new Set(hits.map((p) => p.branch))];
    if (distinct.length < 2) continue;
    const trio = [yb, ...distinct.slice(0, 2)].sort((a, b) => members.indexOf(a) - members.indexOf(b)).join("");
    for (const p of hits) out.push({ kind: "samheng", name: "三刑", pillar: p.key, at: "bottom", mine: p.branch, year: yb, pair: trio, group });
  }
  return out.sort((a, b) => REACTION_KINDS.indexOf(a.kind) - REACTION_KINDS.indexOf(b.kind));
}

/** The strongest reaction kind on one pillar, or null. */
export function strongestOn(reactions: Reaction[], pillar: PillarKey): ReactionKind | null {
  return reactions.find((r) => r.pillar === pillar)?.kind ?? null;
}
