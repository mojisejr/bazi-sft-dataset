import type {
  ContextRuleNoteKeyValue,
  ContextRuleNoteValue,
} from "@/lib/bazi/schema-types";

export function buildContextRuleNote(
  key: ContextRuleNoteKeyValue,
  params: Record<string, string> = {},
): ContextRuleNoteValue {
  return {
    key,
    params,
  };
}

export function renderContextRuleNoteEnglish(signal: ContextRuleNoteValue) {
  switch (signal.key) {
    case "NARRATIVE_SUPPORTS_BUT_NOT_OVERRIDE":
      return "60 Jiazi narrative supports interpretation but does not override clash-resolution logic.";
    case "PERSONA_TWELVE_QI_TONE":
      return `Canonical persona source labels this chart with twelve-qi tone ${signal.params.twelveQiLabel ?? "unknown"}.`;
    case "SOLAR_TERM_BOUNDARY_NEAR":
      return `Birth occurs ${signal.params.hours ?? "0.00"} hours from solar-term boundary ${signal.params.solarTermName ?? signal.params.label ?? "unknown"} (${signal.params.boundaryAt ?? "unknown"} HKT); review edge-case interpretations manually when needed.`;
    case "ACTIVE_COMBINATION_PRECEDENCE":
      return `Active combination ${signal.params.label ?? "unknown"} takes precedence over clashes touching the same branches.`;
    case "CLASH_NEUTRALIZED_BY_COMBINATION":
      return `Clash ${signal.params.label ?? "unknown"} is neutralized because one of its branches first enters a combination.`;
    case "ACTIVE_CLASH_OUTRANKS_PUNISHMENT":
      return `Active clash ${signal.params.label ?? "unknown"} remains in force and should outrank punishment-level interpretations.`;
    case "ACTIVE_PUNISHMENT_REMAINS":
      return `Punishment pattern ${signal.params.label ?? "unknown"} remains active after higher-precedence interactions were resolved.`;
    case "HARM_SUPPLEMENTARY_UNDER_HIGHER_PRECEDENCE":
      return `Harm ${signal.params.label ?? "unknown"} is present but treated as a supplementary detail because a higher-precedence interaction exists.`;
    case "HARM_ACTIVE_SECONDARY":
      return `Harm ${signal.params.label ?? "unknown"} is active as a secondary relational signal.`;
    case "DESTRUCTION_SUPPLEMENTARY_UNDER_HIGHER_PRECEDENCE":
      return `Destruction ${signal.params.label ?? "unknown"} is present but remains a supplementary note under higher-precedence interactions.`;
    case "DESTRUCTION_ACTIVE_SECONDARY":
      return `Destruction ${signal.params.label ?? "unknown"} is active as a secondary relational signal.`;
    case "MONTH_BRANCH_CLASH_REDUCES_SEASONAL_SUPPORT":
      return `Month-branch clash reduces seasonal support weighting to ${signal.params.factor ?? "1.00"} until a higher-precedence combination resolves it.`;
  }
}

export function uniqueContextRuleNotes(signals: ContextRuleNoteValue[]) {
  const seen = new Set<string>();

  return signals.filter((signal) => {
    const params = Object.entries(signal.params)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}:${value}`)
      .join("|");
    const fingerprint = `${signal.key}|${params}`;

    if (seen.has(fingerprint)) {
      return false;
    }

    seen.add(fingerprint);
    return true;
  });
}