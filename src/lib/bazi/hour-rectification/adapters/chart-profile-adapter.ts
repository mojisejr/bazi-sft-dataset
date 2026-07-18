// Hour Rectification — chart-profile-adapter (#hour-rectification-engine). The only file that
// talks to the main calc engine. Computes a real chart for all 12 candidate hour branches so the
// LLM (and the repair loop) has real distinguishing data to write questions from — not guesses.
//
// calculateBaziChart has no "give me hour branch X directly" parameter — it takes a birthTime
// string and derives the hour pillar from it. We feed it the MID-point time of each double-hour
// (00:00, 02:00, ... 22:00 — see HOUR_BRANCH_MID_TIME), never an odd hour like 01:00/03:00, which
// sits exactly on a branch boundary and would make which branch we actually landed in ambiguous.
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { createNoOpKnowledgeRepository } from "@/lib/bazi/no-op-knowledge-repository";
import {
  BRANCH_TO_ELEMENT,
  computeElementRole,
  HOUR_BRANCHES,
  HOUR_BRANCH_MID_TIME,
  STEM_TO_ELEMENT,
  type Element,
  type HourBranch,
  type HourSignature,
  type StrengthBucket,
  type StructuralSignature,
} from "../domain/types";

export type ChartProfileBaseInput = {
  birthDate: string;
  gender: string;
  province: string;
  calendarSystem?: "solar" | "lunar";
  timezone?: string;
};

export type CalculatedChart = Awaited<ReturnType<typeof calculateBaziChart>>;

export type HourChartProfile = {
  hourBranch: HourBranch;
  chart: CalculatedChart;
};

// DB-free by construction (createNoOpKnowledgeRepository) — this module must never touch the DB,
// same discipline as public-calc/route.ts's no-op repository injection.
export async function buildHourChartProfiles(
  baseInput: ChartProfileBaseInput,
): Promise<HourChartProfile[]> {
  const repository = createNoOpKnowledgeRepository();

  const profiles = await Promise.all(
    HOUR_BRANCHES.map(async (hourBranch) => {
      const chart = await calculateBaziChart(
        { ...baseInput, birthTime: HOUR_BRANCH_MID_TIME[hourBranch] },
        repository,
      );
      return { hourBranch, chart };
    }),
  );

  return profiles;
}

// === v1 signature extraction ===
// Pull the structural fields the match.ts scorer needs out of a computed chart. Everything here is
// pure element math over values the engine already produced — no second engine call, no LLM. The
// field paths (fourPillars.hour.stem, dayMaster, strengthScore) are the ones verified present and
// varying-across-the-12-hours against a real dump before this was written.
function readChartFacts(
  chart: CalculatedChart,
  hourBranch: HourBranch,
): {
  hourStem: string;
  dayMasterStem: string;
  strengthScore: number;
} {
  const c = chart as {
    fourPillars?: { hour?: { stem?: string } };
    dayMaster?: string;
    strengthScore?: number;
  };
  const hourStem = c.fourPillars?.hour?.stem;
  const dayMasterStem = c.dayMaster;
  const strengthScore = c.strengthScore;
  // Fail loud rather than silently synthesise a plausible-but-wrong signature: if the engine ever
  // returns a chart without these, defaulting them would corrupt every role/element for the person
  // with no error. These are engine invariants — their absence is a bug worth surfacing.
  if (!hourStem) {
    throw new Error(`hour-rectification: engine returned no hour stem for ยาม${hourBranch}`);
  }
  if (!dayMasterStem) {
    throw new Error(`hour-rectification: engine returned no dayMaster for ยาม${hourBranch}`);
  }
  if (typeof strengthScore !== "number") {
    throw new Error(`hour-rectification: engine returned no strengthScore for ยาม${hourBranch}`);
  }
  return { hourStem, dayMasterStem, strengthScore };
}

// strengthBucket is RELATIVE to the person's own 12 hours (scores are chart-specific — an absolute
// threshold would label whole charts uniformly strong or weak). Split the observed [min,max] range
// into thirds. If all 12 are identical (degenerate), everything is "balanced".
function bucketByRelativeStrength(score: number, min: number, max: number): StrengthBucket {
  if (max <= min) return "balanced";
  const lowCut = min + (max - min) / 3;
  const highCut = max - (max - min) / 3;
  if (score >= highCut) return "strong";
  if (score <= lowCut) return "weak";
  return "balanced";
}

// Turn the 12 computed charts into 12 signatures. Day master is the same across all 12 (only the
// hour differs), so we read it once from the first chart.
export function extractHourSignatures(profiles: readonly HourChartProfile[]): HourSignature[] {
  const facts = profiles.map((profile) => ({
    hourBranch: profile.hourBranch,
    ...readChartFacts(profile.chart, profile.hourBranch),
  }));
  const scores = facts.map((f) => f.strengthScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const dayMasterElement = STEM_TO_ELEMENT[facts[0].dayMasterStem];
  if (!dayMasterElement) {
    throw new Error(
      `hour-rectification: unrecognised day-master stem "${facts[0].dayMasterStem}"`,
    );
  }

  return facts.map((fact) => {
    const stemElement = STEM_TO_ELEMENT[fact.hourStem];
    if (!stemElement) {
      throw new Error(`hour-rectification: unrecognised hour stem "${fact.hourStem}"`);
    }
    const branchElement: Element = BRANCH_TO_ELEMENT[fact.hourBranch];
    const signature: StructuralSignature = {
      stemElement,
      stemRole: computeElementRole(dayMasterElement, stemElement),
      branchRole: computeElementRole(dayMasterElement, branchElement),
      strengthBucket: bucketByRelativeStrength(fact.strengthScore, min, max),
    };
    return { hourBranch: fact.hourBranch, signature, strengthScore: fact.strengthScore };
  });
}

// Runtime convenience: compute the user's 12 real hour signatures straight from their birth data.
// Still DB-free, still no LLM — pure calc engine + element math.
export async function computeHourSignatures(
  baseInput: ChartProfileBaseInput,
): Promise<HourSignature[]> {
  const profiles = await buildHourChartProfiles(baseInput);
  return extractHourSignatures(profiles);
}
