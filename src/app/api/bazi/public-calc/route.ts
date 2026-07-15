import { ZodError } from "zod";

import {
  calculateBaziStateFromRawInput,
  type BaziStatePayload,
} from "@/features/bazi-math/bazi-engine-adapter";
import { createNoOpKnowledgeRepository } from "@/lib/bazi/no-op-knowledge-repository";
import { buildDaYunTableRows, resolveDaYunReaction } from "@/lib/bazi/topic-knowledge";
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import {
  BRANCH_TO_ELEMENT,
  CLASH_PAIRS,
  ELEMENT_LABELS_TH,
  HARM_PAIRS,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";

export const runtime = "nodejs";

// 十神 (ten-god) → broad role category, for badge signal detection only (#calculator-badge-mood-
// FROZEN-v1). Same 10-term taxonomy as semantic-chamber-graph.ts's private TEN_GOD_FLOW_MAP —
// re-declared here rather than exported from that file, to keep this route's only dependency on
// src/lib/bazi/** additive (imports of already-exported symbols), never a core-file edit.
type BadgeRole = "same" | "resource" | "output" | "wealth" | "power";
const TEN_GOD_CATEGORY: Record<string, BadgeRole> = {
  比肩: "same",
  劫财: "same",
  食神: "output",
  伤官: "output",
  偏财: "wealth",
  正财: "wealth",
  偏印: "resource",
  正印: "resource",
  七杀: "power",
  正官: "power",
};

// resolveDaYunReaction's Thai reaction labels (topic-knowledge.ts, RELATION_ROLE_REACTION) map
// 1:1 onto the same 5 categories, verified against resolveRelationRole's own branching logic.
const REACTION_TO_ROLE: Record<string, BadgeRole> = {
  คู่ธาตุ: "same",
  ถ่ายเท: "output",
  ส่งเสริม: "resource",
  โชคลาภ: "wealth",
  พิฆาต: "power",
};

// "qi tier สูง" per FROZEN v1's stated threshold ("relation role ตรง + qi tier สูง/clash") — same
// 4-term "rising" tier boundary as topic-knowledge.ts's private RISING_QI/classifyQiTier (not
// exported; re-declared here for the same additive-only reason as TEN_GOD_CATEGORY above).
const RISING_QI = new Set(["เชี่ยงแซ", "กวงตั่ว", "ลิ่มกัว", "ตี้อ๋วง"]);

type Badge = { point: string; role: "wealth" | "power"; element: string; qi: string; clash: boolean };

// Signal-gated: only "notable" roles (wealth/power — 財/官殺, the two categories too+มุน's own
// FRD example used, "ic_love=財/官") ever badge, and only when qi is in its strong ("rising")
// tier OR the point clashes with the day branch. same/resource/output NEVER badge — this is a
// deliberate reading of "relation role ตรง" as "wealth or power specifically", not "any role" —
// flagged for too's review as an interpretation, not a literal spec quote.
function evaluateSignal(role: BadgeRole, qi: string, clash: boolean): "wealth" | "power" | null {
  if (role !== "wealth" && role !== "power") return null;
  if (!RISING_QI.has(qi) && !clash) return null;
  return role;
}

function elementLabelForSymbol(symbol: string): string {
  const stemEn = STEM_TO_ELEMENT[symbol as keyof typeof STEM_TO_ELEMENT];
  if (stemEn) return ELEMENT_LABELS_TH[stemEn];
  const branchEn = BRANCH_TO_ELEMENT[symbol as keyof typeof BRANCH_TO_ELEMENT];
  return branchEn ? ELEMENT_LABELS_TH[branchEn] : "";
}

function pairFlag(pairs: Set<string>, a: string, b: string): boolean {
  return pairs.has(`${a}|${b}`) || pairs.has(`${b}|${a}`);
}

function buildLiuNianRows(calculatedState: BaziStatePayload) {
  const dayBranch = calculatedState.fourPillars.day.branch;
  return calculatedState.liuNianSeries.map((y) => ({
    year: y.year,
    age: y.age,
    stem: y.stem,
    branch: y.branch,
    element: elementLabelForSymbol(y.stem),
    qi: y.twelveQiDisplay ?? "",
    reaction: resolveDaYunReaction(calculatedState, y.stem, "stem"),
    clash: pairFlag(CLASH_PAIRS, y.branch, dayBranch),
    harm: pairFlag(HARM_PAIRS, y.branch, dayBranch),
  }));
}

// ดิถี (day pillar) is NEVER a badge point — invariant carried over unchanged from calculator's
// own hero-primacy rule (#public-bazi-calculator FROZEN v1). Only wealth/power roles ever badge
// (same/resource/output are the "expected" categories and stay quiet — calm is a valid state).
function buildBadges(calculatedState: BaziStatePayload): Badge[] {
  const dayBranch = calculatedState.fourPillars.day.branch;
  const badges: Badge[] = [];

  const pillarCandidates: Array<[string, { tenGod?: string; sittingStage?: string; branch: string; stem: string }]> = [
    ["pillar-ascendant", calculatedState.mingGong ?? { branch: "", stem: "" }],
    ["pillar-hour", calculatedState.fourPillars.hour],
    ["pillar-month", calculatedState.fourPillars.month],
    ["pillar-year", calculatedState.fourPillars.year],
  ];
  for (const [point, pillar] of pillarCandidates) {
    if (!pillar.tenGod || !pillar.branch) continue;
    const role = TEN_GOD_CATEGORY[pillar.tenGod];
    if (!role) continue;
    const qi = pillar.sittingStage ?? "";
    const clash = pairFlag(CLASH_PAIRS, pillar.branch, dayBranch);
    const signal = evaluateSignal(role, qi, clash);
    if (!signal) continue;
    badges.push({ point, role: signal, element: elementLabelForSymbol(pillar.stem), qi, clash });
  }

  // daYun: 18 phase rows = 9 decades x {upper, lower}; badge at decade granularity (one badge max
  // per decade, matching the frontend decade-strip's per-block display) — either phase signaling
  // is enough to badge that decade.
  const daYunRows = buildDaYunTableRows(calculatedState);
  for (let i = 0; i < daYunRows.length; i += 2) {
    const phases = [daYunRows[i], daYunRows[i + 1]].filter((r): r is NonNullable<typeof r> => Boolean(r));
    for (const row of phases) {
      const role = REACTION_TO_ROLE[row.reaction];
      if (!role) continue;
      const branch = row.place === "ราศีล่าง" ? row.symbol : null;
      const clash = branch ? pairFlag(CLASH_PAIRS, branch, dayBranch) : false;
      const signal = evaluateSignal(role, row.qi, clash);
      if (!signal) continue;
      badges.push({ point: `decade-${i / 2}`, role: signal, element: elementLabelForSymbol(row.symbol), qi: row.qi, clash });
      break;
    }
  }

  // liuNian: point id keyed by age (not calendar year) — matches mootech-fe's own annual-strip
  // matching key (annual.year is an age counter, not a calendar year — see calc-map-enrichment
  // regression test on the frontend for why liuNian.age, not liuNian.year, is the right key).
  for (const y of calculatedState.liuNianSeries) {
    const reaction = resolveDaYunReaction(calculatedState, y.stem, "stem");
    const role = REACTION_TO_ROLE[reaction];
    if (!role) continue;
    const qi = y.twelveQiDisplay ?? "";
    const clash = pairFlag(CLASH_PAIRS, y.branch, dayBranch);
    const signal = evaluateSignal(role, qi, clash);
    if (!signal) continue;
    badges.push({ point: `annual-${y.age}`, role: signal, element: elementLabelForSymbol(y.stem), qi, clash });
  }

  return badges;
}

type PillarField = {
  stem: string;
  branch: string;
  sittingStage?: string;
  upperStageDisplay?: string;
  lowerStageDisplay?: string;
};

type PillarResponse = {
  stem: string;
  branch: string;
  stemElement: string;
  branchElement: string;
  upperStageDisplay?: string;
  lowerStageDisplay?: string;
  sittingStage?: string;
};

// #calculator-card-reframe-v2 (FROZEN, lamun-oracle) — same-engine data-correctness rule: any
// เชี่ยงแซ/strength/reaction shown next to a glyph must come from THIS engine, never stapled onto
// a mootech-be glyph. This exposes calculatedState.fourPillars + mingGong's own stage fields
// directly (already computed, zero new engine logic) so mootech-fe can source both glyph and
// stage from one call.
//
// Day pillar (ดิถี) deliberately omits upperStageDisplay + sittingStage even though the engine
// computes sittingStage for every pillar including day (verified live: fourPillars.day.
// sittingStage = "เอี้ยง", a real value) — the design freeze doctrine tags day as "ดิถี" with no
// เชี่ยงแซ/ตัวนั่ง shown on it at all, so it's dropped here rather than left for the frontend to
// remember to hide.
function mapPillar(pillar: PillarField, isDay: boolean): PillarResponse {
  return {
    stem: pillar.stem,
    branch: pillar.branch,
    stemElement: elementLabelForSymbol(pillar.stem),
    branchElement: elementLabelForSymbol(pillar.branch),
    ...(isDay ? {} : { upperStageDisplay: pillar.upperStageDisplay, sittingStage: pillar.sittingStage }),
    lowerStageDisplay: pillar.lowerStageDisplay,
  };
}

function buildPillars(calculatedState: BaziStatePayload) {
  return {
    ascendant: calculatedState.mingGong ? mapPillar(calculatedState.mingGong, false) : null,
    hour: mapPillar(calculatedState.fourPillars.hour, false),
    day: mapPillar(calculatedState.fourPillars.day, true),
    month: mapPillar(calculatedState.fourPillars.month, false),
    year: mapPillar(calculatedState.fourPillars.year, false),
  };
}

/**
 * POST /api/bazi/public-calc — วัยจร/ปีจร + ปฏิกิริยาธาตุ ล้วน ๆ (ไม่มีเกรด/ทำนาย)
 * คนละ route จาก mode=consumer เดิม — inject no-op repository เข้า calculateBaziStateFromRawInput
 * ตัวเดียวกับที่ /api/bazi/calculate ใช้จริง (ไม่แตะ src/lib/bazi/** core engine เลย) จึงไม่มี DB
 * round-trip เกิดขึ้นบน route นี้เลย ไม่ใช่แค่มี fallback — ดู #calculator-enrichment-FROZEN-v1
 */
export function createPublicCalcHandler() {
  return async function POST(request: Request) {
    try {
      const payload = await request.json();
      const repository = createNoOpKnowledgeRepository();
      const calculatedState = await calculateBaziStateFromRawInput(payload, { repository });

      const daYun = buildDaYunTableRows(calculatedState).map((row) => ({
        ...row,
        element: elementLabelForSymbol(row.symbol),
      }));

      const band = classifyOperatorStrengthScore(calculatedState.strengthScore);

      return Response.json(
        {
          dayMaster: calculatedState.dayMaster,
          dayMasterElement: elementLabelForSymbol(calculatedState.dayMaster),
          strengthScore: calculatedState.strengthScore,
          strengthBand: { id: band.id, displayLabel: band.displayLabel },
          pillars: buildPillars(calculatedState),
          daYun,
          liuNian: buildLiuNianRows(calculatedState),
          badges: buildBadges(calculatedState),
        },
        { status: 200 },
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return Response.json(
          { error: "Invalid calculate payload.", details: error.issues },
          { status: 400 },
        );
      }

      const message = error instanceof Error ? error.message : "Unknown calculation error.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export const POST = createPublicCalcHandler();
