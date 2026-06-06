import { describe, expect, test } from "vitest";

import { buildCanonicalKnowledgeDataset } from "@/lib/bazi/canonical-knowledge";
import { buildBaziCallerContractFromRawInput } from "@/lib/bazi/symbolic-engine.caller-contract";
import { calculateBaziFactState } from "@/lib/bazi/symbolic-engine.os-core";
import {
  Source5RelationshipOverlaySchema,
  buildSource5RelationshipOverlay,
} from "@/lib/bazi/source5-relationship-overlay";
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

describe("buildSource5RelationshipOverlay", () => {
  test("turns all 7 Source 5 steps green with deterministic structured outputs", () => {
    const contract = createGoldenCaseContract();
    const overlay = buildSource5RelationshipOverlay(contract);
    const step1 = overlay.steps.find((step) => step.stepId === "step-1-relationship-potential");
    const step2 = overlay.steps.find((step) => step.stepId === "step-2-day-stem-vs-spouse-base");
    const step3 = overlay.steps.find((step) => step.stepId === "step-3-spouse-element-lookup");
    const step4 = overlay.steps.find((step) => step.stepId === "step-4-relationship-12-cheingsae");
    const step5 = overlay.steps.find((step) => step.stepId === "step-5-conflict-and-interaction");
    const step6 = overlay.steps.find((step) => step.stepId === "step-6-marriage-timing");
    const step7 = overlay.steps.find((step) => step.stepId === "step-7-special-rules-and-spouse-profile");

    expect(Source5RelationshipOverlaySchema.parse(overlay)).toMatchObject({
      sourceId: "source-5",
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
    expect(
      overlay.steps.every((step) => step.provenance.packetFamilies.every((family) => (
        overlay.packetContract.allowedPacketFamilies.includes(family)
      ))),
    ).toBe(true);
    expect(overlay.steps).toHaveLength(7);
    expect(
      overlay.steps.every((step) => (
        step.provenance.routeFrom === "caller-contract"
        && step.provenance.sourceFieldIds.length > 0
        && step.provenance.source1OwnerKeys.length > 0
        && step.provenance.knowledgeOwnership.primaryOwnerKeys.length > 0
        && step.provenance.knowledgeOwnership.ownerSeparation.length > 0
        && step.status === "green"
      )),
    ).toBe(true);
    expect(step1?.result).toMatchObject({
      kind: "relationship-potential",
      potentialKey: "high",
    });
    expect(step2?.result).toMatchObject({
      kind: "spouse-base-reaction",
      reactionLane: "parallel",
    });
    expect(step3?.runtimeOwner).toMatchObject({
      ownerKey: "resolveSpouseElement",
      phase3RuntimeOwnerKey: "resolveSpouseElement",
    });
    expect(step3?.result).toMatchObject({
      kind: "spouse-element-lookup",
      targetRole: "wealth",
      spouseElement: "fire",
      presenceMode: "direct-present",
    });
    expect(step4?.runtimeOwner).toMatchObject({
      ownerKey: "interpretRelationshipTwelveCheingsae",
      phase3RuntimeOwnerKey: "interpretRelationshipTwelveCheingsae",
    });
    expect(step4?.result).toMatchObject({
      kind: "relationship-12-cheingsae",
      source: "pillar-display.resolveCanonicalTwelveQiStage",
    });
    expect(step5?.result).toMatchObject({
      kind: "relationship-conflict-impact",
    });
    expect(step6?.runtimeOwner).toMatchObject({
      ownerKey: "interpretMarriageTiming",
      phase3RuntimeOwnerKey: "interpretMarriageTiming",
    });
    expect(step6?.result).toMatchObject({
      kind: "marriage-timing",
      targetRoles: [{ role: "wealth", targetElement: "fire", targetElementLabel: "ไฟ" }],
    });
    expect(step7?.runtimeOwner).toMatchObject({
      ownerKey: "evaluateSpecialRelationshipRules",
      phase3RuntimeOwnerKey: "evaluateSpecialRelationshipRules",
    });
    expect(step7?.result).toMatchObject({
      kind: "special-rules-and-spouse-profile",
      spouseProfile: {
        appearance: {
          spouseElement: "fire",
          description: "สูงโปร่ง",
        },
      },
    });
    expect(step4?.provenance.packetFamilies).toEqual([]);
  });

  test("keeps Step 4 relationship cheingsae independent from Source 1 twelve-qi texture packet", () => {
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

    const originalStep4 = buildSource5RelationshipOverlay(contract).steps.find(
      (step) => step.stepId === "step-4-relationship-12-cheingsae",
    );
    const mutatedStep4 = buildSource5RelationshipOverlay(mutatedContract).steps.find(
      (step) => step.stepId === "step-4-relationship-12-cheingsae",
    );

    expect(mutatedStep4?.result).toEqual(originalStep4?.result);
  });
});