import { NEAR_BOUNDARY_WINDOW_HOURS } from "@/lib/bazi/symbolic-engine.constants";
import { normalizeCorpusBranchSymbol } from "@/lib/bazi/symbolic-engine.matrix";
import type {
  BranchInteractionResolution,
  SixtyJiaziPersonaRecord,
  SolarTermBoundaryContext,
  SolarTermBoundaryRecord,
} from "@/lib/bazi/symbolic-engine.types";

export function buildSixtyJiaziSemanticNotes(persona: SixtyJiaziPersonaRecord | null) {
  if (!persona) {
    return [];
  }

  const notes: string[] = [];

  if (persona.elementTone) {
    notes.push(`โทนธาตุของ 60 กะจื่อวันนี้คือ ${persona.elementTone}`);
  }

  if (persona.twelveQiLabel) {
    notes.push(
      `ชั้น 12 เชี่ยงแซของกะจื่อวันอยู่ที่ ${normalizeCorpusBranchSymbol(persona.twelveQiLabel)}`,
    );
  }

  return notes;
}

function hoursBetween(left: string, right: string) {
  const leftDate = new Date(left.replace(" ", "T") + "+08:00");
  const rightDate = new Date(right.replace(" ", "T") + "+08:00");

  return Math.abs(leftDate.getTime() - rightDate.getTime()) / (1000 * 60 * 60);
}

export function buildPrecedenceNotes(
  birthAtHongKong: string,
  solarTerms: SolarTermBoundaryContext,
  persona: SixtyJiaziPersonaRecord | null,
  interactionResolution: BranchInteractionResolution,
) {
  const notes = [
    "60 Jiazi narrative supports interpretation but does not override clash-resolution logic.",
    ...interactionResolution.precedenceNotes,
  ];

  if (persona?.twelveQiLabel) {
    notes.push(`Canonical persona source labels this chart with twelve-qi tone ${persona.twelveQiLabel}.`);
  }

  const candidates = [solarTerms.previous, solarTerms.next]
    .filter((entry): entry is SolarTermBoundaryRecord => Boolean(entry?.boundaryAt))
    .map((entry) => ({ entry, hours: hoursBetween(birthAtHongKong, entry.boundaryAt ?? birthAtHongKong) }))
    .filter(({ hours }) => hours <= NEAR_BOUNDARY_WINDOW_HOURS)
    .sort((left, right) => left.hours - right.hours);

  const nearest = candidates[0];

  if (nearest?.entry.boundaryAt) {
    notes.push(
      `Birth occurs ${nearest.hours.toFixed(2)} hours from solar-term boundary ${nearest.entry.solarTermName ?? nearest.entry.label} (${nearest.entry.boundaryAt} HKT); review edge-case interpretations manually when needed.`,
    );
  }

  return notes;
}