import { describe, expect, test } from "vitest";

import { buildCanonicalKnowledgeDataset } from "@/lib/bazi/canonical-knowledge";
import {
  Source6CareerBusinessInterpretationSchema,
  buildSource6CareerBusinessInterpretation,
} from "@/lib/bazi/source6-career-business-interpretation";
import { buildSource6CareerBusinessOverlay } from "@/lib/bazi/source6-career-business-overlay";
import { buildBaziCallerContractFromRawInput } from "@/lib/bazi/symbolic-engine.caller-contract";
import { calculateBaziFactState } from "@/lib/bazi/symbolic-engine.os-core";
import { CalculatedStateSchema } from "@/lib/bazi/schema-types";
import { SOURCE1_GOLDEN_REFERENCE_CASE } from "@/lib/bazi/source1-operating-system-contract";
import { buildDayMasterStrengthVocabulary } from "@/lib/bazi/strength-state-vocabulary";
import { buildSixtyJiaziSemanticNotes } from "@/lib/bazi/symbolic-engine.persona";
import {
  buildSource2DayPillarAdviceInput,
  buildSource2TwelveQiAdviceInput,
} from "@/lib/bazi/source2-knowledge-ownership";

const dataset = buildCanonicalKnowledgeDataset();

function createGoldenCaseContract() {
  const factState = calculateBaziFactState(SOURCE1_GOLDEN_REFERENCE_CASE.input);
  const strengthVocabulary = buildDayMasterStrengthVocabulary(factState.strengthScore);
  const personaRow = dataset.sixtyJiaziNarratives.find((row) => (
    row.dayMasterChinese === factState.dayMaster
      && row.branchChinese === factState.structuralState.fourPillars.day.branch
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

  return buildBaziCallerContractFromRawInput(SOURCE1_GOLDEN_REFERENCE_CASE.input, calculatedState);
}

describe("buildSource6CareerBusinessInterpretation", () => {
  test("turns Source 6 overlay facts into reading intent while keeping delivery context on the Source 6 corpus", () => {
    const overlay = buildSource6CareerBusinessOverlay(createGoldenCaseContract());
    const interpretation = buildSource6CareerBusinessInterpretation(overlay);

    expect(Source6CareerBusinessInterpretationSchema.parse(interpretation)).toMatchObject({
      sourceId: "source-6",
      routeFrom: "source6-career-business-overlay",
      status: "ready-for-reading",
    });
    expect(interpretation.careerDirection.facts).toMatchObject({
      strengthBandId: "balanced",
      primaryLane: {
        role: "output",
        element: "wood",
      },
    });
    expect(interpretation.careerStatus.facts).toMatchObject({
      officialElement: "earth",
      presenceMode: "direct-present",
      statusKey: "authority-rising",
      combinedSignal: "resistant",
      growthGroup: "bad",
    });
    expect(interpretation.deliveryContext.topic.sourceRefs[0]).toMatchObject({
      primarySource: "Source6_ การงานและธุรกิจ",
    });
    expect(interpretation.deliveryContext.dictionary.sourceRelativePaths).toContain(
      "Source6_ การงานและธุรกิจ/Source6_ การงานและธุรกิจ.md",
    );
    expect(interpretation.deliveryContext.retrieval).toMatchObject({
      dimensionName: "career_potential",
      strategy: "dictionary-first",
      coverage: "direct",
      fallbackRequired: false,
    });
    expect(interpretation.deliveryContext.contract.rejectedAssumptions).toContain(
      "hybrid retrieval owns official-star lookup or career 12 cheingsae status logic",
    );
  });

  test("derives reading intent from overlay facts instead of re-running chart logic", () => {
    const overlay = buildSource6CareerBusinessOverlay(createGoldenCaseContract());
    const mutatedOverlay = structuredClone(overlay);
    const statusStep = mutatedOverlay.steps.find(
      (step) => step.stepId === "step-3-career-status-by-official-star-phase",
    );

    if (!statusStep || statusStep.result.kind !== "career-status-by-official-star-phase") {
      throw new Error("Missing Source 6 status step in the mutated overlay.");
    }

    statusStep.result.statusKey = "authority-pressured";

    const originalInterpretation = buildSource6CareerBusinessInterpretation(overlay);
    const mutatedInterpretation = buildSource6CareerBusinessInterpretation(mutatedOverlay);

    expect(originalInterpretation.careerStatus.facts.statusKey).toBe("authority-rising");
    expect(mutatedInterpretation.careerStatus.facts.statusKey).toBe("authority-pressured");
    expect(mutatedInterpretation.careerStatus.readingIntent.roleFrame).toContain("แรงกดสูง");
  });
});