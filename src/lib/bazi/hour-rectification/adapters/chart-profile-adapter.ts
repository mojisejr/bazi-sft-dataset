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
import { HOUR_BRANCHES, HOUR_BRANCH_MID_TIME, type HourBranch } from "../domain/types";

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
