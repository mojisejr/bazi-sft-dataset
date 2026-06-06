import { describe, expect, test } from "vitest";

import { buildCanonicalKnowledgeDataset } from "@/lib/bazi/canonical-knowledge";
import {
  buildBaziCallerContractFromRawInput,
} from "@/lib/bazi/symbolic-engine.caller-contract";
import { calculateBaziFactState } from "@/lib/bazi/symbolic-engine.os-core";
import {
  SOURCE2_DOWNSTREAM_READINESS,
  buildSource2PersonalityOverlay,
  type Source2PersonalityOverlayRepository,
} from "@/lib/bazi/source2-personality-overlay";
import {
  CalculatedStateSchema,
} from "@/lib/bazi/schema-types";
import { SOURCE1_GOLDEN_REFERENCE_CASE } from "@/lib/bazi/source1-operating-system-contract";
import {
  buildDayMasterStrengthVocabulary,
} from "@/lib/bazi/strength-state-vocabulary";
import {
  buildSixtyJiaziSemanticNotes,
} from "@/lib/bazi/symbolic-engine.persona";
import {
  buildSource2DayPillarAdviceInput,
  buildSource2RoutingNarrativeInput,
  buildSource2TwelveQiAdviceInput,
} from "@/lib/bazi/source2-knowledge-ownership";

const dataset = buildCanonicalKnowledgeDataset();

function createGoldenCaseContract() {
  const factState = calculateBaziFactState(SOURCE1_GOLDEN_REFERENCE_CASE.input);
  const strengthVocabulary = buildDayMasterStrengthVocabulary(factState.strengthScore);
  const personaRow = dataset.sixtyJiaziNarratives.find((row) => (
    row.dayMasterChinese === factState.dayMaster && row.branchChinese === factState.structuralState.fourPillars.day.branch
  ));
  const routingNarrative = "ดิถีน้ำกุ่ยสมดุล รับอารมณ์และบริบทได้ไว แต่จะเลือกไหลอย่างเงียบและมีชั้นเชิงมากกว่าปะทะตรง ๆ";

  if (!personaRow) {
    throw new Error("Golden case 癸亥 refinement row is missing from the canonical dataset.");
  }

  const calculatedState = CalculatedStateSchema.parse({
    fourPillars: factState.fourPillars,
    ageSnapshot: factState.ageSnapshot,
    mingGong: factState.mingGong,
    daYun: factState.daYun,
    liuNian: factState.liuNian,
    shenSha: [],
    dayMaster: factState.dayMaster,
    strengthScore: factState.strengthScore,
    tenGods: factState.roleOfElementFacts.tenGods,
    twelveQi: factState.twelveQi.display,
    elementMetaphors: [],
    elementAnalysis: factState.elementAnalysis,
    seasonalInteraction: factState.roleOfElementFacts.seasonalInteraction,
    dayMasterStrengthProfile: {
      dayMaster: factState.dayMaster,
      bandId: strengthVocabulary.bandId,
      semanticId: strengthVocabulary.semanticId,
      strengthState: strengthVocabulary.lookupState,
      sourceState: strengthVocabulary.sourceState,
      lookupState: strengthVocabulary.lookupState,
      repositoryLookupState: strengthVocabulary.repositoryLookupState,
      displayBand: strengthVocabulary.displayBand,
      displayLabel: strengthVocabulary.displayLabel,
      narrative: routingNarrative,
      qiLabel: factState.twelveQi.display.dayBranch,
      scoreText: String(factState.strengthScore),
    },
    sixtyJiaziCorePersona: {
      code: `${factState.structuralState.fourPillars.day.stem}${factState.structuralState.fourPillars.day.branch}`,
      narrative: personaRow.combinedNarrative ?? personaRow.dayMasterNarrative ?? personaRow.branchNarrative ?? "",
      heavenNarrative: personaRow.dayMasterNarrative ?? undefined,
      earthNarrative: personaRow.branchNarrative ?? undefined,
      elementTone: personaRow.elementTone ?? undefined,
      twelveQiLabel: personaRow.twelveQiLabel ?? undefined,
      semanticNotes: buildSixtyJiaziSemanticNotes({
        dayMasterChinese: personaRow.dayMasterChinese,
        branchChinese: personaRow.branchChinese,
        elementTone: personaRow.elementTone,
        twelveQiLabel: personaRow.twelveQiLabel,
        dayMasterNarrative: personaRow.dayMasterNarrative,
        branchNarrative: personaRow.branchNarrative,
        combinedNarrative: personaRow.combinedNarrative,
        dayPillarAdvice: buildSource2DayPillarAdviceInput({
          sourcePath: personaRow.sourcePath,
          rowGroup: personaRow.rowGroup,
          combinedNarrative: personaRow.combinedNarrative,
          metadata: personaRow.metadata,
        }),
        twelveQiAdvice: buildSource2TwelveQiAdviceInput({
          sourcePath: personaRow.sourcePath,
          rowGroup: personaRow.rowGroup,
          combinedNarrative: personaRow.combinedNarrative,
          metadata: personaRow.metadata,
        }),
      }),
      precedenceNotes: ["Routing stays on Day Master x Strength before 60 Jiazi refinement."],
      precedenceNoteSignals: [],
    },
    interactionState: factState.interactionState,
    isForwardDirection: factState.isForwardDirection,
    explainable: factState.explainable,
  });

  return {
    contract: buildBaziCallerContractFromRawInput(
      SOURCE1_GOLDEN_REFERENCE_CASE.input,
      calculatedState,
    ),
    personaRow,
    routingNarrative,
    strengthVocabulary,
  };
}

function createGoldenCaseRepository(options?: {
  omitCombinedNarrative?: boolean;
}): Source2PersonalityOverlayRepository {
  const {
    personaRow,
    routingNarrative,
    strengthVocabulary,
  } = createGoldenCaseContract();
  const combinedNarrative = options?.omitCombinedNarrative ? null : personaRow.combinedNarrative;

  return {
    async findDayMasterStrengthProfile() {
      return {
        dayMaster: "癸",
        strengthState: strengthVocabulary.lookupState,
        sourceState: strengthVocabulary.sourceState,
        lookupState: strengthVocabulary.lookupState,
        narrative: routingNarrative,
        qiLabel: personaRow.twelveQiLabel,
        scoreText: "4",
        routingNarrative: buildSource2RoutingNarrativeInput({
          sourcePath: "tests/source2-personality-overlay.test.ts",
          rowOrder: 1,
          narrative: routingNarrative,
        }),
      };
    },
    async findSixtyJiaziPersona() {
      return {
        dayMasterChinese: personaRow.dayMasterChinese,
        branchChinese: personaRow.branchChinese,
        elementTone: personaRow.elementTone,
        twelveQiLabel: personaRow.twelveQiLabel,
        dayMasterNarrative: personaRow.dayMasterNarrative,
        branchNarrative: personaRow.branchNarrative,
        combinedNarrative,
        dayPillarAdvice: buildSource2DayPillarAdviceInput({
          sourcePath: personaRow.sourcePath,
          rowGroup: personaRow.rowGroup,
          combinedNarrative,
          metadata: personaRow.metadata,
        }),
        twelveQiAdvice: buildSource2TwelveQiAdviceInput({
          sourcePath: personaRow.sourcePath,
          rowGroup: personaRow.rowGroup,
          combinedNarrative,
          metadata: personaRow.metadata,
        }),
      };
    },
  };
}

describe("buildSource2PersonalityOverlay", () => {
  test("publishes the Source 5 handoff contract explicitly for downstream overlays", () => {
    expect(SOURCE2_DOWNSTREAM_READINESS).toMatchObject({
      nextOverlay: "source-5",
      status: "ready-for-handoff",
      mayRelyOn: {
        routing: expect.stringContaining("primary personality axis"),
        refinement: expect.stringContaining("temperament color"),
        evidence: expect.stringContaining("context modifiers"),
      },
    });
    expect(SOURCE2_DOWNSTREAM_READINESS.source2LocalOnly).toContain("overlay status classification");
    expect(SOURCE2_DOWNSTREAM_READINESS.guardrails).toContain(
      "Do not let refinement or evidence override Source 2 routing.",
    );
  });

  test("builds the golden case from routing first, then 癸亥 refinement, while keeping 12 Qi provenance explicit", async () => {
    const { contract } = createGoldenCaseContract();
    const overlay = await buildSource2PersonalityOverlay(
      contract,
      createGoldenCaseRepository(),
    );

    expect(overlay.status).toBe("ready-with-gaps");
    expect(overlay.routing).toMatchObject({
      routeFrom: "dayMasterStrengthProfile",
      dayMaster: "癸",
      narrative: {
        ownership: {
          lane: "routing",
          ownerTable: "bazi_day_master_strength_states",
          status: "authored",
        },
      },
    });
    expect(overlay.refinement).toMatchObject({
      routeFrom: "sixtyJiaziCorePersona",
      dayPillarCode: "癸亥",
      dayPillarAdvice: {
        ownership: {
          lane: "refinement",
          ownerTable: "bazi_sixty_jiazi_narratives",
          status: "authored",
        },
      },
    });
    expect(overlay.evidence.twelveQi).toMatchObject({
      advice: {
        ownership: {
          lane: "evidence",
          ownerTable: "typed-constant",
          status: "shared-granularity",
          gapCode: "no-standalone-twelve-qi-advice",
        },
      },
    });
    expect(overlay.evidence.supportingPackets.map((packet) => packet.family)).toEqual([
      "role-of-element",
      "twelve-qi-texture",
      "conflict-context",
      "timing",
    ]);
  });

  test("passes classified gaps through the overlay instead of inventing missing 癸亥 advice", async () => {
    const { contract } = createGoldenCaseContract();
    const overlay = await buildSource2PersonalityOverlay(
      contract,
      createGoldenCaseRepository({ omitCombinedNarrative: true }),
    );

    expect(overlay.status).toBe("ready-with-gaps");
    expect(overlay.refinement.dayPillarAdvice).toMatchObject({
      text: null,
      ownership: {
        status: "classified-gap",
        gapCode: "missing-day-pillar-advice",
      },
    });
    expect(overlay.evidence.twelveQi.advice).toMatchObject({
      text: null,
      ownership: {
        status: "classified-gap",
        gapCode: "missing-shared-twelve-qi-advice",
      },
    });
  });
});