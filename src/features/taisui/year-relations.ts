// ปีชง 2570 (Tai Sui 2027, 丁未) — how a target year touches each of a person's four pillars.
//
// Consumer-only over the frozen engine (MUMATE-GITHUB-FLOW.md §6): this file imports
// already-exported symbols from src/lib/bazi/** and edits nothing there. The relation tables are
// the engine's own constants and classical pair queries, never a copy.
//
// It returns facts only (branches, relation kinds, element flow, month states). Prose lives in
// mootech-fe's content files, which the Sinse approves.
import { annualGanzhi } from "@/lib/bazi/annual-ganzhi";
import {
  branchClash,
  branchHalfSanHe,
  branchHarm,
  branchPunishment,
  branchSixHe,
} from "@/lib/bazi/hour-rectification/domain/interaction-tables";
import { buildGregorianYearSolarTerms } from "@/lib/bazi/solar-terms";
import { calculateBaziStructuralState } from "@/lib/bazi/symbolic-engine";
import {
  CONTROLS,
  DESTRUCTION_PAIRS,
  GENERATES,
  SAN_HE_GROUPS,
  SAN_HUI_GROUPS,
  STEM_TO_ELEMENT,
  normalizeBranchPairKey,
} from "@/lib/bazi/symbolic-engine.constants";

import { HARD_REACTIONS, ROLE_TH, elementRole, reactionsWith, type ElementRole, type Reaction, type ReactionKind } from "./year-reactions";

/** Strongest first: a pillar's `relation` is the first kind in this order that applies. */
export const RELATION_ORDER = ["same", "clash", "punish", "harm", "six", "half3", "season", "none"] as const;
export type Relation = (typeof RELATION_ORDER)[number];

export type Flow = "same" | "feeds" | "controls" | "fed-by" | "controlled-by";
export type PillarKey = "hour" | "day" | "month" | "year";

export type BirthInput = {
  birthDate: string; // YYYY-MM-DD, Gregorian
  birthTime: string | null; // HH:MM local Thai time, or null when unknown
  gender: "male" | "female";
};

export type PillarFacts = {
  key: PillarKey;
  stem: string;
  branch: string;
  element: string; // stem element, english (wood fire earth metal water)
  /** The strongest of the Sinse's reactions on this pillar (top or bottom), `none` when nothing fires. */
  relation: ReactionKind | "none";
  relations: string[]; // every classical name that applies on this pillar, e.g. ["破", "天干冲"]
  flow: Flow;
};

export type MonthFacts = {
  branch: string;
  startsAt: string; // ISO time of the month's opening solar term
  state: "peak" | "care" | "normal";
  because: string[]; // short machine reasons, e.g. ["三合:亥卯未", "冲:年"]
};

export type YearFacts = {
  year: { gregorian: number; stem: string; branch: string; element: string; lichun: string };
  chart: { hasHour: boolean };
  pillars: PillarFacts[];
  /** Every reaction of the year with the chart, by the Sinse's method (plan revision 0.9). */
  reactions: Reaction[];
  /** The year element's role to the day master (ดิถี). */
  role: { dayMaster: string; dayElement: string; role: ElementRole; th: string };
  mine: string[];
  months: MonthFacts[];
};

const PILLAR_ORDER: PillarKey[] = ["hour", "day", "month", "year"];

// The opening 节 of each month of a Chinese year, in order from 寅 (立春) to 丑 (小寒 of next year).
const MONTH_OPENERS: Array<{ branch: string; term: string; nextYear?: true }> = [
  { branch: "寅", term: "立春" },
  { branch: "卯", term: "惊蛰" },
  { branch: "辰", term: "清明" },
  { branch: "巳", term: "立夏" },
  { branch: "午", term: "芒种" },
  { branch: "未", term: "小暑" },
  { branch: "申", term: "立秋" },
  { branch: "酉", term: "白露" },
  { branch: "戌", term: "寒露" },
  { branch: "亥", term: "立冬" },
  { branch: "子", term: "大雪" },
  { branch: "丑", term: "小寒", nextYear: true },
];

function pairIn(set: Set<string>, a: string, b: string): boolean {
  return set.has(normalizeBranchPairKey(a, b));
}

function sameSeason(a: string, b: string): boolean {
  if (a === b) return false;
  return SAN_HUI_GROUPS.some((g) => (g.branches as readonly string[]).includes(a) && (g.branches as readonly string[]).includes(b));
}

/** Every classical relation between two branches, as [kind, name] pairs. */
export function branchRelations(a: string, b: string): Array<[Relation, string]> {
  const out: Array<[Relation, string]> = [];
  if (a === b) out.push(["same", "伏吟"]);
  if (branchClash(a, b)) out.push(["clash", "冲"]);
  if (branchPunishment(a, b)) out.push(["punish", "刑"]);
  if (pairIn(DESTRUCTION_PAIRS, a, b)) out.push(["punish", "破"]);
  if (branchHarm(a, b)) out.push(["harm", "害"]);
  if (branchSixHe(a, b)) out.push(["six", "六合"]);
  if (branchHalfSanHe(a, b)) out.push(["half3", "半三合"]);
  if (sameSeason(a, b)) out.push(["season", "三會"]);
  return out;
}

/** The strongest relation kind between two branches, `none` when nothing applies. */
export function strongestRelation(a: string, b: string): Relation {
  const kinds = new Set(branchRelations(a, b).map(([kind]) => kind));
  return RELATION_ORDER.find((kind) => kinds.has(kind)) ?? "none";
}

/** How the year's stem element acts on a pillar's stem element. */
export function elementFlow(yearElement: string, pillarElement: string): Flow {
  if (yearElement === pillarElement) return "same";
  if ((GENERATES as Record<string, string>)[yearElement] === pillarElement) return "feeds";
  if ((CONTROLS as Record<string, string>)[yearElement] === pillarElement) return "controls";
  if ((GENERATES as Record<string, string>)[pillarElement] === yearElement) return "fed-by";
  return "controlled-by";
}

function stemElement(stem: string): string {
  return (STEM_TO_ELEMENT as Record<string, string>)[stem] ?? "";
}

/** Solar-term local time (Asia/Hong_Kong, +08:00) to an ISO instant. */
function termInstant(year: number, term: string): string {
  const row = buildGregorianYearSolarTerms(year).find((t) => t.name === term);
  if (!row) throw new Error(`solar term ${term} missing for ${year}`);
  return new Date(row.boundaryAtLocal.replace(" ", "T") + "+08:00").toISOString();
}

/** The four (or three) pillars of a birth, from the engine. */
export function birthPillars(birth: BirthInput): Array<{ key: PillarKey; stem: string; branch: string }> {
  const state = calculateBaziStructuralState({
    birthDate: birth.birthDate,
    // The engine needs a time. With an unknown time the hour pillar is dropped, so noon only keeps
    // the other three stable — the same substitute mootech-fe uses (lib/bazi-bridge/input.ts).
    birthTime: birth.birthTime ?? "12:00",
    gender: birth.gender,
    province: "Thailand",
    timezone: "Asia/Bangkok",
  });
  const keys = birth.birthTime ? PILLAR_ORDER : PILLAR_ORDER.filter((k) => k !== "hour");
  return keys.map((key) => ({ key, stem: state.fourPillars[key].stem, branch: state.fourPillars[key].branch }));
}

/**
 * A month's state for this chart:
 * - care: the month branch clashes the year branch, or the person's year or day branch.
 * - peak: the month completes a full 三合 with the year branch and one of the person's branches,
 *   or six-combines the person's year or day branch.
 * - normal otherwise. Care wins over peak.
 */
function monthState(monthBranch: string, yearBranch: string, pillars: PillarFacts[]): Pick<MonthFacts, "state" | "because"> {
  const because: string[] = [];
  const anchor = pillars.filter((p) => p.key === "year" || p.key === "day");
  if (branchClash(monthBranch, yearBranch)) because.push("冲:流年");
  for (const p of anchor) if (branchClash(monthBranch, p.branch)) because.push(`冲:${p.key}`);
  if (because.length) return { state: "care", because };

  for (const group of SAN_HE_GROUPS) {
    const trio = group.branches as readonly string[];
    if (!trio.includes(monthBranch) || !trio.includes(yearBranch) || monthBranch === yearBranch) continue;
    const third = trio.find((b) => b !== monthBranch && b !== yearBranch);
    if (third && pillars.some((p) => p.branch === third)) because.push(`三合:${trio.join("")}`);
  }
  for (const p of anchor) if (branchSixHe(monthBranch, p.branch)) because.push(`六合:${p.key}`);
  return because.length ? { state: "peak", because: [...new Set(because)] } : { state: "normal", because };
}

export function yearFacts(birth: BirthInput, gregorianYear = 2027): YearFacts {
  const year = annualGanzhi(gregorianYear);
  const yearElement = stemElement(year.stem);
  const chart = birthPillars(birth);
  const reactions = reactionsWith(chart, year);
  const pillars: PillarFacts[] = chart.map((p) => {
    const mineR = reactions.filter((r) => r.pillar === p.key);
    const element = stemElement(p.stem);
    return {
      ...p,
      element,
      relation: mineR[0]?.kind ?? "none",
      relations: [...new Set(mineR.map((r) => r.name))],
      flow: elementFlow(yearElement, element),
    };
  });
  const day = chart.find((p) => p.key === "day")!;
  const role = elementRole(day.stem, year.stem);
  const months: MonthFacts[] = MONTH_OPENERS.map((m) => ({
    branch: m.branch,
    startsAt: termInstant(m.nextYear ? gregorianYear + 1 : gregorianYear, m.term),
    ...monthState(m.branch, year.branch, pillars),
  }));
  return {
    year: { gregorian: gregorianYear, stem: year.stem, branch: year.branch, element: yearElement, lichun: termInstant(gregorianYear, "立春") },
    chart: { hasHour: Boolean(birth.birthTime) },
    pillars,
    reactions,
    role: { dayMaster: day.stem, dayElement: stemElement(day.stem), role, th: ROLE_TH[role] },
    mine: [...new Set(pillars.map((p) => p.branch))],
    months,
  };
}

/** Two people's year animals against each other, for the red packet (receiver, sender), by the Sinse's branch tables. */
export function pairRelation(receiverYearBranch: string, senderYearBranch: string): ReactionKind | "none" {
  const r = reactionsWith([{ key: "year", stem: "", branch: receiverYearBranch }], { stem: "", branch: senderYearBranch })
    .filter((x) => x.at === "bottom" && x.kind !== "phua" && x.kind !== "samheng");
  return r[0]?.kind ?? "none";
}

export { HARD_REACTIONS };
