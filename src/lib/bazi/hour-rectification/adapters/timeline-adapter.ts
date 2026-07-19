// Hour Rectification v2 — timeline-adapter (#hour-rectification-engine, event-based lane). The only
// v2 file that talks to the calc engine. Computes the real chart for all 12 candidate hours (reusing
// v1's buildHourChartProfiles) and extracts the per-hour facts the pure signal/scorer layer needs.
// READ-ONLY against the engine; no mutation, no LLM, no DB (buildHourChartProfiles injects a no-op
// knowledge repository).
import {
  buildHourChartProfiles,
  type ChartProfileBaseInput,
} from "./chart-profile-adapter";
import type { DaYunStage, HourChartFacts } from "../domain/signals";
import type { HourBranch } from "../domain/types";

export type EventsChartContext = {
  facts12: HourChartFacts[];
  birthYear: number;
};

type RawPillar = { stem?: string; branch?: string; hiddenStems?: string[] };
type RawDaYun = { startAge?: number; endAge?: number; stem?: string; branch?: string };
type RawChart = {
  fourPillars?: { hour?: RawPillar; day?: RawPillar };
  dayMaster?: string;
  daYun?: RawDaYun[];
};

function toDaYunStages(raw: RawDaYun[]): DaYunStage[] {
  return raw
    .filter((d): d is Required<Pick<RawDaYun, "stem" | "branch">> & RawDaYun =>
      Boolean(d.stem && d.branch && typeof d.startAge === "number"),
    )
    .map((d, index, arr) => ({
      startAge: d.startAge as number,
      // EXCLUSIVE endAge = the next stage's start (or +10 for the last). We deliberately do NOT use
      // the engine's own `endAge`, which is INCLUSIVE (startAge+9) — mixing it with signals.ts's
      // `age < endAge` check silently dropped the whole 大運 at every boundary age (9,19,29…). A
      // contiguous exclusive convention makes activeDaYun's `>= start && < end` correct everywhere.
      endAge:
        typeof arr[index + 1]?.startAge === "number"
          ? (arr[index + 1].startAge as number)
          : (d.startAge as number) + 10,
      stem: d.stem as string,
      branch: d.branch as string,
    }));
}

export async function buildHourChartFacts(
  baseInput: ChartProfileBaseInput,
): Promise<EventsChartContext> {
  const profiles = await buildHourChartProfiles(baseInput);
  const birthYear = Number.parseInt(baseInput.birthDate.split("-")[0] ?? "", 10);
  if (!Number.isFinite(birthYear)) {
    throw new Error(`rectify-events: could not parse birth year from "${baseInput.birthDate}"`);
  }

  const facts12: HourChartFacts[] = profiles.map(({ hourBranch, chart }) => {
    const c = chart as RawChart;
    const hour = c.fourPillars?.hour;
    const dayPillar = c.fourPillars?.day;
    if (!hour?.stem || !hour.branch || !dayPillar?.branch || !c.dayMaster) {
      throw new Error(`rectify-events: engine chart missing pillar data for ยาม${hourBranch}`);
    }
    return {
      hourBranch: hourBranch as HourBranch,
      hourStem: hour.stem,
      hourHiddenStems: hour.hiddenStems ?? [],
      dayMaster: c.dayMaster,
      dayBranch: dayPillar.branch,
      daYun: toDaYunStages(c.daYun ?? []),
    };
  });

  return { facts12, birthYear };
}
