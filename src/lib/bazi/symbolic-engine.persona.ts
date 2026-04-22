import { NEAR_BOUNDARY_WINDOW_HOURS } from "@/lib/bazi/symbolic-engine.constants";
import {
  buildContextRuleNote,
  renderContextRuleNoteEnglish,
  uniqueContextRuleNotes,
} from "@/lib/bazi/symbolic-engine.context-notes";
import { normalizeCorpusBranchSymbol } from "@/lib/bazi/symbolic-engine.matrix";
import type {
  BranchInteractionResolution,
  SolarTermBoundaryContext,
  SolarTermBoundaryRecord,
  SixtyJiaziPersonaRecord,
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

export function buildPrecedenceNoteSignals(
  birthAtHongKong: string,
  solarTerms: SolarTermBoundaryContext,
  persona: SixtyJiaziPersonaRecord | null,
  interactionResolution: BranchInteractionResolution,
) {
  const signals = [
    buildContextRuleNote("NARRATIVE_SUPPORTS_BUT_NOT_OVERRIDE"),
    ...interactionResolution.precedenceSignals,
  ];

  if (persona?.twelveQiLabel) {
    signals.push(
      buildContextRuleNote("PERSONA_TWELVE_QI_TONE", {
        twelveQiLabel: persona.twelveQiLabel,
      }),
    );
  }

  const candidates = [solarTerms.previous, solarTerms.next]
    .filter((entry): entry is SolarTermBoundaryRecord => Boolean(entry?.boundaryAt))
    .map((entry) => ({ entry, hours: hoursBetween(birthAtHongKong, entry.boundaryAt ?? birthAtHongKong) }))
    .filter(({ hours }) => hours <= NEAR_BOUNDARY_WINDOW_HOURS)
    .sort((left, right) => left.hours - right.hours);

  const nearest = candidates[0];

  if (nearest?.entry.boundaryAt) {
    signals.push(
      buildContextRuleNote("SOLAR_TERM_BOUNDARY_NEAR", {
        hours: nearest.hours.toFixed(2),
        solarTermName: nearest.entry.solarTermName ?? nearest.entry.label,
        label: nearest.entry.label,
        boundaryAt: nearest.entry.boundaryAt,
      }),
    );
  }

  return uniqueContextRuleNotes(signals);
}

export function buildPrecedenceNotes(
  birthAtHongKong: string,
  solarTerms: SolarTermBoundaryContext,
  persona: SixtyJiaziPersonaRecord | null,
  interactionResolution: BranchInteractionResolution,
) {
  return buildPrecedenceNoteSignals(
    birthAtHongKong,
    solarTerms,
    persona,
    interactionResolution,
  ).map((signal) => renderContextRuleNoteEnglish(signal));
}