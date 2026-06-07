import { buildCanonicalKnowledgeDataset } from "@/lib/bazi/canonical-knowledge";
import { CalculatedStateSchema } from "@/lib/bazi/schema-types";
import {
  buildBaziCallerContractFromRawInput,
  type BaziCallerContract,
} from "@/lib/bazi/symbolic-engine.caller-contract";
import { calculateBaziFactState } from "@/lib/bazi/symbolic-engine.os-core";
import { buildSixtyJiaziSemanticNotes } from "@/lib/bazi/symbolic-engine.persona";
import {
  buildSource2DayPillarAdviceInput,
  buildSource2TwelveQiAdviceInput,
} from "@/lib/bazi/source2-knowledge-ownership";
import { SOURCE1_GOLDEN_REFERENCE_CASE } from "@/lib/bazi/source1-operating-system-contract";
import { buildDayMasterStrengthVocabulary } from "@/lib/bazi/strength-state-vocabulary";

const dataset = buildCanonicalKnowledgeDataset();

export function createGoldenCaseCallerContract(): BaziCallerContract {
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

export function getSource4SupportingPackets(contract: BaziCallerContract) {
  return contract.sharedPacketSpine.packets.filter((packet) => (
    packet.family === "strength"
      || packet.family === "role-of-element"
      || packet.family === "timing"
  ));
}
