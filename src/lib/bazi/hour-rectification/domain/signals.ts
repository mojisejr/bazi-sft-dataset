// Hour Rectification v2 — signals (#hour-rectification-engine, event-based lane). Extracts a
// deterministic YearSignal for a (candidate hour-chart, event year) pair. Pure over its inputs —
// it reads only the classical constant tables (interaction-tables) + two pure engine helpers
// (annualGanzhi, resolveTenGodForStem), no engine state / LLM / file / network.
//
// THE DISCRIMINATION PRINCIPLE (verified against ฟีม's real chart 1989-01-03): the 12 hour
// candidates share identical year/month/day pillars AND identical 大運 — they differ ONLY in the
// hour pillar (時柱) and its 藏干 (hidden stems). So a signal can rank the 12 hours ONLY if it
// touches the hour pillar. Every relation below is hour-pillar-anchored on purpose; anything
// compared against a fixed pillar would score all 12 hours identically and rank nothing.
import { resolveTenGodForStem } from "@/lib/bazi/pillar-display";
import { annualGanzhi } from "@/lib/bazi/annual-ganzhi";
import {
  branchClash,
  branchHalfSanHe,
  branchHarm,
  branchPunishment,
  branchSixHe,
  peachBlossomBranch,
  stemClash,
  stemCombine,
} from "./interaction-tables";
import type { HourBranch } from "./types";

// One 大運 luck stage (identical across all 12 hours — derived from month pillar + gender + year).
export type DaYunStage = { startAge: number; endAge: number; stem: string; branch: string };

// The per-hour facts the adapter extracts from a real computed chart. Everything a signal needs.
export type HourChartFacts = {
  hourBranch: HourBranch;
  hourStem: string;
  hourHiddenStems: string[]; // 藏干 — where the 財/官/食傷 stars that discriminate live
  dayMaster: string;
  dayBranch: string; // 桃花 anchor (day branch; fixed across hours)
  daYun: DaYunStage[];
};

type BranchRel = {
  sixHe: boolean;
  halfSanHe: boolean;
  clash: boolean;
  harm: boolean;
  punishment: boolean;
};
type StemRel = { combine: boolean; clash: boolean };

// Which ten-god "star" categories the hour pillar carries (stem + 藏干). These differ per hour and
// are how bong's palace-based events (spouse=財/官, career=官殺/食傷, children=食傷/官殺) regain
// their discriminating power once anchored on the hour instead of a fixed palace.
export type StarSet = {
  wealth: boolean; // 財 正财/偏财 — spouse star (male)
  authority: boolean; // 官殺 正官/七杀 — spouse star (female), career/children (male)
  output: boolean; // 食傷 食神/伤官 — career, children (female)
  resource: boolean; // 印 正印/偏印
  peer: boolean; // 比劫 比肩/劫财
};

export type YearSignal = {
  year: number;
  liuNian: { stem: string; branch: string };
  daYun: { stem: string; branch: string } | null;
  lnBranchVsHour: BranchRel;
  lnStemVsHour: StemRel;
  dyBranchVsHour: BranchRel | null;
  dyStemVsHour: StemRel | null;
  hourStars: StarSet;
  hourStemTenGod: string;
  hourHiddenTenGods: string[];
  hourIsPeachBlossom: boolean;
  liuNianTenGod: string; // context only (same across hours) — for because-templates
};

// resolveTenGodForStem returns simplified CJK: 比肩/劫财/食神/伤官/偏财/正财/偏印/正印/七杀/正官.
const WEALTH = new Set(["正财", "偏财"]);
const AUTHORITY = new Set(["正官", "七杀"]);
const OUTPUT = new Set(["食神", "伤官"]);
const RESOURCE = new Set(["正印", "偏印"]);
const PEER = new Set(["比肩", "劫财"]);

function branchRel(a: string, b: string): BranchRel {
  return {
    sixHe: branchSixHe(a, b),
    halfSanHe: branchHalfSanHe(a, b),
    clash: branchClash(a, b),
    harm: branchHarm(a, b),
    punishment: branchPunishment(a, b),
  };
}

function stemRel(a: string, b: string): StemRel {
  return { combine: stemCombine(a, b), clash: stemClash(a, b) };
}

function starsFor(dayMaster: string, stems: readonly string[]): StarSet {
  const stars: StarSet = {
    wealth: false,
    authority: false,
    output: false,
    resource: false,
    peer: false,
  };
  for (const stem of stems) {
    const tenGod = resolveTenGodForStem(dayMaster, stem);
    if (WEALTH.has(tenGod)) stars.wealth = true;
    else if (AUTHORITY.has(tenGod)) stars.authority = true;
    else if (OUTPUT.has(tenGod)) stars.output = true;
    else if (RESOURCE.has(tenGod)) stars.resource = true;
    else if (PEER.has(tenGod)) stars.peer = true;
  }
  return stars;
}

// daYun stages use 0-based startAge (verified from a real chart: "0:乙丑, 10:丙寅, 20:丁卯 …").
// age at an event = eventYear − birthYear (0-based to match). Outside all stages → no active 大運.
function activeDaYun(daYun: readonly DaYunStage[], age: number): DaYunStage | null {
  return daYun.find((stage) => age >= stage.startAge && age < stage.endAge) ?? null;
}

export function buildYearSignal(
  facts: HourChartFacts,
  year: number,
  birthYear: number,
): YearSignal {
  const liuNian = annualGanzhi(year);
  const age = year - birthYear;
  const dy = activeDaYun(facts.daYun, age);
  const hourStems = [facts.hourStem, ...facts.hourHiddenStems];
  const peach = peachBlossomBranch(facts.dayBranch);

  return {
    year,
    liuNian,
    daYun: dy ? { stem: dy.stem, branch: dy.branch } : null,
    lnBranchVsHour: branchRel(liuNian.branch, facts.hourBranch),
    lnStemVsHour: stemRel(liuNian.stem, facts.hourStem),
    dyBranchVsHour: dy ? branchRel(dy.branch, facts.hourBranch) : null,
    dyStemVsHour: dy ? stemRel(dy.stem, facts.hourStem) : null,
    hourStars: starsFor(facts.dayMaster, hourStems),
    hourStemTenGod: resolveTenGodForStem(facts.dayMaster, facts.hourStem),
    hourHiddenTenGods: facts.hourHiddenStems.map((stem) =>
      resolveTenGodForStem(facts.dayMaster, stem),
    ),
    hourIsPeachBlossom: peach !== null && facts.hourBranch === peach,
    liuNianTenGod: resolveTenGodForStem(facts.dayMaster, liuNian.stem),
  };
}
