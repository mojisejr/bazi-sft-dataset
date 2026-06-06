import { NEAR_BOUNDARY_WINDOW_HOURS } from "@/lib/bazi/symbolic-engine.constants";
import {
  buildContextRuleNote,
  renderContextRuleNoteEnglish,
  uniqueContextRuleNotes,
} from "@/lib/bazi/symbolic-engine.context-notes";
import { normalizeCorpusBranchSymbol } from "@/lib/bazi/symbolic-engine.matrix";
import {
  SOURCE1_GOLDEN_REFERENCE_CASE,
  type Source1ContractFieldId,
} from "@/lib/bazi/source1-operating-system-contract";
import type {
  BranchInteractionResolution,
  SolarTermBoundaryContext,
  SolarTermBoundaryRecord,
  SixtyJiaziPersonaRecord,
} from "@/lib/bazi/symbolic-engine.types";

export const SOURCE2_PERSONALITY_DOCTRINE_LAYER_SEQUENCE = [
  "routing",
  "refinement",
  "evidence",
] as const;

export type Source2PersonalityDoctrineLayerId =
  (typeof SOURCE2_PERSONALITY_DOCTRINE_LAYER_SEQUENCE)[number];

export type Source2PersonalityOwnerModule =
  | "symbolic-engine.persona"
  | "symbolic-engine.repository"
  | "source1-operating-system-contract";

export type Source2PersonalityOwnerSurface = {
  module: Source2PersonalityOwnerModule;
  ownerKey: string;
};

export type Source2PersonalityManualSectionId =
  | "1.1-day-master-strength"
  | "1.2-day-pillar-60-jiazi"
  | "1.2-twelve-qi-tone-advice";

export type Source2PersonalityDoctrineSection = {
  sectionId: Source2PersonalityManualSectionId;
  manualHeading: string;
  layerId: Source2PersonalityDoctrineLayerId;
  contractOutputKey: "dayMasterStrengthProfile" | "sixtyJiaziCorePersona" | "twelveQi";
  ownerSurfaces: readonly Source2PersonalityOwnerSurface[];
  requiredSource1FieldIds: readonly Source1ContractFieldId[];
  description: string;
};

const SOURCE2_PERSONALITY_DOCTRINE_SECTIONS: readonly Source2PersonalityDoctrineSection[] = [
  {
    sectionId: "1.1-day-master-strength",
    manualHeading: "1.1 Day Master x Strength",
    layerId: "routing",
    contractOutputKey: "dayMasterStrengthProfile",
    ownerSurfaces: [
      { module: "symbolic-engine.persona", ownerKey: "buildSource2PersonalityDoctrineContract" },
      { module: "symbolic-engine.repository", ownerKey: "findDayMasterStrengthProfile" },
      { module: "source1-operating-system-contract", ownerKey: "buildSource1StrengthContract" },
    ],
    requiredSource1FieldIds: ["day-master", "weighted-strength"],
    description: "Primary Source 2 routing must start from Source 1 day master plus Source 1 strength output and never from 60 Jiazi prose.",
  },
  {
    sectionId: "1.2-day-pillar-60-jiazi",
    manualHeading: "1.2 Day Pillar / 60 Jiazi",
    layerId: "refinement",
    contractOutputKey: "sixtyJiaziCorePersona",
    ownerSurfaces: [
      { module: "symbolic-engine.persona", ownerKey: "buildSixtyJiaziSemanticNotes" },
      { module: "symbolic-engine.repository", ownerKey: "findSixtyJiaziPersona" },
      { module: "source1-operating-system-contract", ownerKey: "SOURCE1_GOLDEN_REFERENCE_CASE" },
    ],
    requiredSource1FieldIds: ["four-pillars", "day-master"],
    description: "Day pillar and 60 Jiazi only refine the temperament texture after the Source 1 routing axis is already fixed.",
  },
  {
    sectionId: "1.2-twelve-qi-tone-advice",
    manualHeading: "1.2 12 Qi / tone / advice modifier",
    layerId: "evidence",
    contractOutputKey: "twelveQi",
    ownerSurfaces: [
      { module: "symbolic-engine.persona", ownerKey: "buildPrecedenceNoteSignals" },
      { module: "source1-operating-system-contract", ownerKey: "SOURCE1_CONTRACT_FIELDS" },
    ],
    requiredSource1FieldIds: ["twelve-qi-texture", "day-master", "four-pillars"],
    description: "12 Qi stays in the evidence lane and can modulate tone or advice, but it cannot replace the primary Source 2 personality axis.",
  },
] as const;

function cloneOwnerSurfaces(ownerSurfaces: readonly Source2PersonalityOwnerSurface[]) {
  return ownerSurfaces.map((surface) => ({ ...surface }));
}

function cloneSource1FieldIds(fieldIds: readonly Source1ContractFieldId[]) {
  return [...fieldIds];
}

export function buildSource2PersonalityDoctrineContract() {
  const dayPillar = SOURCE1_GOLDEN_REFERENCE_CASE.structuralAnchors.fourPillars.day;

  return {
    sourceId: "source-2" as const,
    doctrineVersion: "phase-1" as const,
    preserveSource1Authority: true as const,
    recomputeStrength: false as const,
    layerSequence: [...SOURCE2_PERSONALITY_DOCTRINE_LAYER_SEQUENCE],
    sections: SOURCE2_PERSONALITY_DOCTRINE_SECTIONS.map((section) => ({
      ...section,
      ownerSurfaces: cloneOwnerSurfaces(section.ownerSurfaces),
      requiredSource1FieldIds: cloneSource1FieldIds(section.requiredSource1FieldIds),
    })),
    goldenCase: {
      label: SOURCE1_GOLDEN_REFERENCE_CASE.label,
      input: { ...SOURCE1_GOLDEN_REFERENCE_CASE.input },
      source1StructuralAnchors: {
        dayMaster: SOURCE1_GOLDEN_REFERENCE_CASE.structuralAnchors.dayMaster,
        fourPillars: {
          year: { ...SOURCE1_GOLDEN_REFERENCE_CASE.structuralAnchors.fourPillars.year },
          month: { ...SOURCE1_GOLDEN_REFERENCE_CASE.structuralAnchors.fourPillars.month },
          day: { ...SOURCE1_GOLDEN_REFERENCE_CASE.structuralAnchors.fourPillars.day },
          hour: { ...SOURCE1_GOLDEN_REFERENCE_CASE.structuralAnchors.fourPillars.hour },
        },
      },
      expectation: {
        routeFrom: "dayMasterStrengthProfile" as const,
        routeBy: {
          dayMaster: SOURCE1_GOLDEN_REFERENCE_CASE.structuralAnchors.dayMaster,
          strengthFieldId: "weighted-strength" as const,
        },
        refineWith: {
          dayPillarCode: `${dayPillar.stem}${dayPillar.branch}`,
          outputKey: "sixtyJiaziCorePersona" as const,
        },
        evidenceWith: {
          fieldId: "twelve-qi-texture" as const,
          role: "tone-advice-modifier" as const,
        },
        requiredSource1FieldIds: [
          "day-master",
          "weighted-strength",
          "four-pillars",
          "twelve-qi-texture",
        ] as const,
      },
    },
  };
}

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