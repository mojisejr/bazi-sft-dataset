import { describe, expect, test } from "vitest";

import { buildCanonicalKnowledgeDataset } from "@/lib/bazi/canonical-knowledge";
import { buildBaziCallerContractFromRawInput } from "@/lib/bazi/symbolic-engine.caller-contract";
import { calculateBaziFactState } from "@/lib/bazi/symbolic-engine.os-core";
import {
  Source6CareerBusinessOverlaySchema,
  buildSource6CareerBusinessOverlay,
} from "@/lib/bazi/source6-career-business-overlay";
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

describe("buildSource6CareerBusinessOverlay", () => {
  test("turns all 8 Source 6 steps green with deterministic career, official-star, and timing facts", () => {
    const contract = createGoldenCaseContract();
    const overlay = buildSource6CareerBusinessOverlay(contract);
    const step1 = overlay.steps.find((step) => step.stepId === "step-1-career-element-routing");
    const step2 = overlay.steps.find((step) => step.stepId === "step-2-official-star-lookup");
    const step3 = overlay.steps.find((step) => step.stepId === "step-3-career-status-by-official-star-phase");
    const step4 = overlay.steps.find((step) => step.stepId === "step-4-job-transition-weighted-timing");
    const step5 = overlay.steps.find((step) => step.stepId === "step-5-career-growth-grouping");

    expect(Source6CareerBusinessOverlaySchema.parse(overlay)).toMatchObject({
      sourceId: "source-6",
      status: "all-steps-green",
    });
    expect(overlay.packetContract.allowedPacketFamilies).toEqual([
      "strength",
      "role-of-element",
      "conflict-context",
      "timing",
    ]);
    expect(overlay.packetContract.supportingPackets.map((packet) => packet.family)).toEqual([
      "strength",
      "role-of-element",
      "conflict-context",
      "timing",
    ]);
    expect(overlay.steps).toHaveLength(8);
    expect(
      overlay.steps.every((step) => (
        step.provenance.routeFrom === "caller-contract"
        && step.provenance.sourceFieldIds.length > 0
        && step.provenance.source1OwnerKeys.length > 0
        && step.provenance.knowledgeOwnership.primaryOwnerKeys.length > 0
        && step.status === "green"
      )),
    ).toBe(true);
    expect(step1?.result).toMatchObject({
      kind: "career-element-routing",
      strengthBandId: "balanced",
      primaryLane: {
        role: "output",
        element: "wood",
      },
    });
    expect(step2?.runtimeOwner).toMatchObject({
      ownerKey: "resolveOfficialStarLane",
      phase2RuntimeOwnerKey: "resolveOfficialStarLane",
    });
    expect(step2?.result).toMatchObject({
      kind: "official-star-lookup",
      officialElement: "earth",
      presenceMode: "direct-present",
      directMatches: {
        stems: [{ symbol: "戊" }],
      },
    });
    expect(step3?.result).toMatchObject({
      kind: "career-status-by-official-star-phase",
      selectedLane: "direct-official-branch",
      statusKey: "authority-rising",
    });
    expect(step4?.result).toMatchObject({
      kind: "job-transition-weighting",
      weighting: {
        daYun: 0.6,
        liuNian: 0.4,
      },
      dayMasterPerspective: {
        signal: "mixed",
      },
      monthBasePerspective: {
        signal: "resistant",
      },
      combinedSignal: "resistant",
    });
    expect(step5?.result).toMatchObject({
      kind: "career-growth-group",
      growthGroup: "bad",
    });
  });

  test("keeps Source 6 official-star status independent from the Source 1 twelve-qi texture packet", () => {
    const contract = createGoldenCaseContract();
    const mutatedContract = structuredClone(contract);
    const texturePacket = mutatedContract.sharedPacketSpine.packets.find((packet) => packet.family === "twelve-qi-texture");

    if (!texturePacket || texturePacket.family !== "twelve-qi-texture") {
      throw new Error("Golden case is missing the twelve-qi-texture packet.");
    }

    texturePacket.sections.texture.value.display.dayBranch = "เจ๊าะ-ปลอม";
    texturePacket.sections.texture.value.display.yearBranch = "ซี่-ปลอม";
    texturePacket.sections.texture.value.raw.dayBranch = "fake-day-branch";
    texturePacket.sections.texture.value.raw.yearBranch = "fake-year-branch";

    const originalStep3 = buildSource6CareerBusinessOverlay(contract).steps.find(
      (step) => step.stepId === "step-3-career-status-by-official-star-phase",
    );
    const mutatedStep3 = buildSource6CareerBusinessOverlay(mutatedContract).steps.find(
      (step) => step.stepId === "step-3-career-status-by-official-star-phase",
    );

    expect(mutatedStep3?.result).toEqual(originalStep3?.result);
  });
});