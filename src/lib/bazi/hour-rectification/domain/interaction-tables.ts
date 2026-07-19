// Hour Rectification v2 — interaction-tables (#hour-rectification-engine, event-based lane).
//
// Pure query helpers over the CLASSICAL branch/stem relation tables. These re-export the engine's
// own constant Sets (symbolic-engine.constants.ts) rather than copying them — deliberately: they are
// fixed classical data that must stay in lock-step with the rest of the engine's interaction logic,
// so a single source of truth beats a hand-transcribed copy that could silently drift. Only static
// CONSTANT tables are imported here (no engine functions, no state, no side effects), so this stays
// a pure, deterministic module. This file only runs server-side (via the events API), never in the
// client bundle.
import {
  CLASH_PAIRS,
  HARM_PAIRS,
  PUNISHMENT_PAIR_KEYS,
  SAN_HE_GROUPS,
  SELF_PUNISHMENT_BRANCHES,
  SIX_COMBINATION_PAIRS,
  STEM_CLASH_PAIRS,
  STEM_COMBINATION_TRANSFORMS,
  normalizeBranchPairKey,
} from "@/lib/bazi/symbolic-engine.constants";

// The 旺 (cardinal / 沐浴-peak) branch of each 三合 trio. A TRUE 半三合 needs this branch present
// (生+旺 or 旺+墓); a bare 生+墓 pair (e.g. 申辰, 寅戌) is only a weak 拱局, not counted here.
const SAN_HE_PEAK_BRANCHES = new Set(["子", "午", "卯", "酉"]);

// The classically-correct 刑 trios (無恩之刑 寅巳申, 恃勢之刑 丑戌未). Defined locally on purpose:
// the engine's PUNISHMENT_TRIOS model the cardinal group as rotating trios ([子卯午] etc.), which
// over-fires 刑 for non-classical pairs (卯午, 午酉, 子酉). v2 scores on the classical definition.
const CLASSICAL_PUNISHMENT_TRIOS: readonly (readonly string[])[] = [
  ["寅", "巳", "申"],
  ["丑", "戌", "未"],
];

function pairHas(set: Set<string>, a: string, b: string): boolean {
  return set.has(normalizeBranchPairKey(a, b));
}

// The engine constants type their branch groups as narrow readonly tuples of specific chars, so a
// plain .includes(someString) is rejected — widen to readonly string[] for the membership check.
function has(list: readonly string[], value: string): boolean {
  return list.includes(value);
}

// 六合 (six-combination): 子丑 寅亥 卯戌 辰酉 巳申 午未.
export function branchSixHe(a: string, b: string): boolean {
  return pairHas(SIX_COMBINATION_PAIRS, a, b);
}

// 半三合 for a PAIR: two of a 三合 trio present (a full 三合 needs all three, which a 流年-vs-hour
// pair can never be on its own). a≠b and both share a trio.
export function branchHalfSanHe(a: string, b: string): boolean {
  if (a === b) return false;
  return SAN_HE_GROUPS.some((group) => {
    if (!has(group.branches, a) || !has(group.branches, b)) return false;
    // A real 半三合 must include the trio's 旺 branch (生+旺 or 旺+墓). A bare 生+墓 pair is excluded.
    return SAN_HE_PEAK_BRANCHES.has(a) || SAN_HE_PEAK_BRANCHES.has(b);
  });
}

// 冲 (clash): 子午 丑未 寅申 卯酉 辰戌 巳亥.
export function branchClash(a: string, b: string): boolean {
  return pairHas(CLASH_PAIRS, a, b);
}

// 害 (harm): 子未 丑午 寅巳 卯辰 申亥 酉戌.
export function branchHarm(a: string, b: string): boolean {
  return pairHas(HARM_PAIRS, a, b);
}

// 刑 (punishment): the 子卯 pair, the 寅巳申 / 丑戌未 trios (any two present), and self-punishment
// (辰午酉亥 with itself — reachable when a 流年 branch equals the hour branch).
export function branchPunishment(a: string, b: string): boolean {
  if (a === b) return SELF_PUNISHMENT_BRANCHES.has(a);
  if (PUNISHMENT_PAIR_KEYS.has(normalizeBranchPairKey(a, b))) return true;
  return CLASSICAL_PUNISHMENT_TRIOS.some((trio) => has(trio, a) && has(trio, b));
}

// 天干五合 (stem combination): 甲己 乙庚 丙辛 丁壬 戊癸.
export function stemCombine(a: string, b: string): boolean {
  return STEM_COMBINATION_TRANSFORMS.has(normalizeBranchPairKey(a, b));
}

// Stem clash (七殺-line stem opposition): 甲庚 乙辛 丙壬 丁癸 …
export function stemClash(a: string, b: string): boolean {
  return pairHas(STEM_CLASH_PAIRS, a, b);
}

// 桃花 (peach-blossom / 咸池) branch for a natal anchor branch (usually the day branch): the 沐浴
// branch of that branch's 三合 trio. 申子辰→酉, 寅午戌→卯, 巳酉丑→午, 亥卯未→子.
const PEACH_BLOSSOM_BY_GROUP: Record<string, string> = {
  申子辰: "酉",
  寅午戌: "卯",
  巳酉丑: "午",
  亥卯未: "子",
};

export function peachBlossomBranch(anchorBranch: string): string | null {
  for (const group of SAN_HE_GROUPS) {
    if (has(group.branches, anchorBranch)) {
      const key = group.branches.join("");
      if (PEACH_BLOSSOM_BY_GROUP[key]) return PEACH_BLOSSOM_BY_GROUP[key];
    }
  }
  return null;
}
