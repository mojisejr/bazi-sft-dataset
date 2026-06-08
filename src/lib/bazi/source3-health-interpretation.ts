import { z } from "zod";

import { getHybridDictionarySpec } from "@/lib/bazi/dictionaries";
import { getHybridRetrievalRegistryEntry } from "@/lib/bazi/hybrid-retrieval-registry";
import { getBaziTopicDefinition } from "@/lib/bazi/knowledge/topic-registry";
import {
  buildSource3KnowledgeOwnership,
} from "@/lib/bazi/source3-knowledge-ownership";
import {
  Source3HealthOverlaySchema,
  type Source3HealthOverlay,
} from "@/lib/bazi/source3-health-overlay";

const Source3SourceRefSchema = z.object({
  directoryLabel: z.string().trim().min(1),
  primarySource: z.string().trim().min(1),
  supportingSources: z.array(z.string().trim().min(1)),
  reasoningFocus: z.string().trim().min(1),
});

const Source3InterpretationDeliveryContextSchema = z.object({
  topic: z.object({
    id: z.literal("health_risks"),
    thaiLabel: z.string().trim().min(1),
    annotationDimension: z.literal("health_overview"),
    sourceRefs: z.array(Source3SourceRefSchema).min(1),
  }),
  dictionary: z.object({
    specKey: z.literal("healthOverviewDictionary"),
    dimensionName: z.literal("health_overview"),
    sourceRelativePaths: z.array(z.string().trim().min(1)).min(1),
  }),
  retrieval: z.object({
    dimensionName: z.literal("health_overview"),
    strategy: z.enum(["dictionary-first", "folder-merge", "ai-fallback"]),
    coverage: z.enum(["direct", "merge", "missing"]),
    sourceRelativePaths: z.array(z.string().trim().min(1)).min(1),
    fallbackRequired: z.boolean(),
  }),
  contract: z.object({
    verdict: z.literal("source-reference-and-delivery-context-only"),
    allowedContextSteps: z.array(z.string().trim().min(1)).min(1),
    rejectedAssumptions: z.array(z.string().trim().min(1)).min(1),
    note: z.string().trim().min(1),
  }),
});

const Source3ReadingIntentSchema = z.object({
  summary: z.string().trim().min(1),
  detail: z.string().trim().min(1),
  guardrails: z.array(z.string().trim().min(1)).min(1),
});

const Source3ConstitutionBaselineInterpretationSchema = z.object({
  sourceStepIds: z.tuple([
    z.literal("step-1-weak-element-routing"),
    z.literal("step-2-organ-risk-mapping"),
  ]),
  facts: z.object({
    primaryWeakElement: z.string().trim().min(1),
    primaryWeakElementLabel: z.string().trim().min(1),
    weakElementLabels: z.array(z.string().trim().min(1)).min(1),
    organs: z.array(z.string().trim().min(1)).min(1),
    bodySystems: z.array(z.string().trim().min(1)).min(1),
    watchBand: z.string().trim().min(1),
    careBoundary: z.literal("caution-only"),
  }),
  readingIntent: Source3ReadingIntentSchema,
});

const Source3TimingSensitiveWeaknessInterpretationSchema = z.object({
  sourceStepIds: z.tuple([
    z.literal("step-3-conflict-injury-markers"),
    z.literal("step-4-bounded-caution-framing"),
  ]),
  facts: z.object({
    sensitivityLevel: z.string().trim().min(1),
    triggerWindow: z.string().trim().min(1),
    cautionTone: z.string().trim().min(1),
    activeConflictKinds: z.array(z.string().trim().min(1)),
    highlightedAreas: z.array(z.string().trim().min(1)).min(1),
    currentDaYunStageSignal: z.string().trim().min(1).nullable(),
    currentLiuNianStageSignal: z.string().trim().min(1).nullable(),
  }),
  readingIntent: z.object({
    timingFrame: z.string().trim().min(1),
    cautionFrame: z.string().trim().min(1),
    guardrails: z.array(z.string().trim().min(1)).min(1),
  }),
});

const Source3RecoverySupportVerdictSchema = z.enum([
  "cautious-pursuit-only",
  "rest-first-and-monitor",
]);

const Source3RecoveryCautionInterpretationSchema = z.object({
  sourceStepIds: z.tuple([
    z.literal("step-2-organ-risk-mapping"),
    z.literal("step-3-conflict-injury-markers"),
    z.literal("step-4-bounded-caution-framing"),
  ]),
  facts: z.object({
    supportVerdict: Source3RecoverySupportVerdictSchema,
    primaryOrgans: z.array(z.string().trim().min(1)).min(1),
    watchAreas: z.array(z.string().trim().min(1)).min(1),
    sensitivityLevel: z.string().trim().min(1),
    triggerWindow: z.string().trim().min(1),
    cautionTone: z.string().trim().min(1),
    careBoundary: z.literal("caution-only"),
    requiresTreatmentBoundary: z.literal(true),
  }),
  readingIntent: z.object({
    supportFrame: z.string().trim().min(1),
    boundaryFrame: z.string().trim().min(1),
    guardrails: z.array(z.string().trim().min(1)).min(1),
  }),
});

export const Source3HealthInterpretationSchema = z.object({
  sourceId: z.literal("source-3"),
  routeFrom: z.literal("source3-health-overlay"),
  status: z.literal("ready-for-reading"),
  deliveryContext: Source3InterpretationDeliveryContextSchema,
  constitutionBaseline: Source3ConstitutionBaselineInterpretationSchema,
  timingSensitiveWeakness: Source3TimingSensitiveWeaknessInterpretationSchema,
  recoveryCaution: Source3RecoveryCautionInterpretationSchema,
});

export type Source3HealthInterpretation = z.infer<typeof Source3HealthInterpretationSchema>;

function getStepResult<TKind extends Source3HealthOverlay["steps"][number]["result"]["kind"]>(
  overlay: Source3HealthOverlay,
  stepId: Source3HealthOverlay["steps"][number]["stepId"],
  kind: TKind,
) {
  const step = overlay.steps.find((candidate) => candidate.stepId === stepId);

  if (!step) {
    throw new Error(`Missing Source 3 overlay step: ${stepId}`);
  }

  if (step.result.kind !== kind) {
    throw new Error(`Unexpected Source 3 step result kind for ${stepId}: ${step.result.kind}`);
  }

  return step.result as Extract<
    Source3HealthOverlay["steps"][number]["result"],
    { kind: TKind }
  >;
}

function buildDeliveryContext() {
  const ownership = buildSource3KnowledgeOwnership();
  const contract = ownership.deliverySurfaceContract;
  const topic = getBaziTopicDefinition(contract.topicId);
  const dictionarySpec = getHybridDictionarySpec(contract.annotationDimension);
  const retrievalEntry = getHybridRetrievalRegistryEntry(contract.retrievalRegistryDimension);

  if (!topic) {
    throw new Error(`Missing Source 3 delivery topic: ${contract.topicId}`);
  }

  if (!dictionarySpec) {
    throw new Error(`Missing Source 3 dictionary spec: ${contract.annotationDimension}`);
  }

  if (topic.annotationDimension !== contract.annotationDimension) {
    throw new Error("Source 3 topic contract drifted away from the health_overview dimension.");
  }

  return {
    topic: {
      id: topic.id,
      thaiLabel: topic.thaiLabel,
      annotationDimension: topic.annotationDimension,
      sourceRefs: topic.sourceRefs,
    },
    dictionary: {
      specKey: contract.dictionarySpec,
      dimensionName: dictionarySpec.dimensionName,
      sourceRelativePaths: [...dictionarySpec.sourceRelativePaths],
    },
    retrieval: {
      dimensionName: retrievalEntry.dimensionName,
      strategy: retrievalEntry.strategy,
      coverage: retrievalEntry.coverage,
      sourceRelativePaths: [...retrievalEntry.sourceRelativePaths],
      fallbackRequired: retrievalEntry.fallbackRequired,
    },
    contract: {
      verdict: contract.contractVerdict,
      allowedContextSteps: [...contract.allowedContextSteps],
      rejectedAssumptions: [...contract.rejectedAssumptions],
      note: contract.note,
    },
  };
}

export function buildSource3HealthInterpretation(
  overlayInput: Source3HealthOverlay,
): Source3HealthInterpretation {
  const overlay = Source3HealthOverlaySchema.parse(overlayInput);
  const step1 = getStepResult(overlay, "step-1-weak-element-routing", "health-weak-element-routing");
  const step2 = getStepResult(overlay, "step-2-organ-risk-mapping", "health-organ-risk-mapping");
  const step3 = getStepResult(overlay, "step-3-conflict-injury-markers", "health-conflict-injury-markers");
  const step4 = getStepResult(overlay, "step-4-bounded-caution-framing", "bounded-health-caution");
  const deliveryContext = buildDeliveryContext();
  const primaryRiskLane = step2.riskLanes[0];
  const highlightedAreas = [
    ...new Set([
      ...primaryRiskLane.organs,
      ...primaryRiskLane.bodySystems,
      ...step3.markers.flatMap((marker) => marker.targetedAreas),
    ]),
  ];
  const supportVerdict = step4.cautionTone === "extra-rest-and-monitor"
    ? "rest-first-and-monitor"
    : "cautious-pursuit-only";

  return Source3HealthInterpretationSchema.parse({
    sourceId: overlay.sourceId,
    routeFrom: "source3-health-overlay",
    status: "ready-for-reading",
    deliveryContext,
    constitutionBaseline: {
      sourceStepIds: [
        "step-1-weak-element-routing",
        "step-2-organ-risk-mapping",
      ],
      facts: {
        primaryWeakElement: step1.primaryWeakElement,
        primaryWeakElementLabel: primaryRiskLane.elementLabel,
        weakElementLabels: step1.weakElements.map((lane) => lane.elementLabel),
        organs: primaryRiskLane.organs,
        bodySystems: primaryRiskLane.bodySystems,
        watchBand: primaryRiskLane.cautionBand,
        careBoundary: step2.careBoundary,
      },
      readingIntent: {
        summary: `${primaryRiskLane.elementLabel} เป็น baseline weakness หลักของสุขภาพ จึงควรเริ่มอ่านที่ ${primaryRiskLane.organs.join(" / ")}.`,
        detail: `${primaryRiskLane.cautionNote} ระบบที่ควรเฝ้าดูเพิ่มคือ ${primaryRiskLane.bodySystems.join(" / ")} และทุกอย่างต้องคงไว้ที่การอ่านเชิงแนวโน้มเท่านั้น.`,
        guardrails: [
          "พูดได้แค่จุดอ่อนเชิงโครงสร้างและอวัยวะที่ควรเฝ้าดู ไม่ใช่การวินิจฉัยโรค",
          "ห้ามข้ามจาก baseline weakness ไปเป็นคำรักษาหรือคำแนะนำเชิงคลินิก",
        ],
      },
    },
    timingSensitiveWeakness: {
      sourceStepIds: [
        "step-3-conflict-injury-markers",
        "step-4-bounded-caution-framing",
      ],
      facts: {
        sensitivityLevel: step4.timingSensitivity.sensitivityLevel,
        triggerWindow: step4.timingSensitivity.triggerWindow,
        cautionTone: step4.cautionTone,
        activeConflictKinds: step3.activeConflictKinds,
        highlightedAreas,
        currentDaYunStageSignal: step4.timingSensitivity.currentDaYunStage?.signal ?? null,
        currentLiuNianStageSignal: step4.timingSensitivity.currentLiuNianStage?.signal ?? null,
      },
      readingIntent: {
        timingFrame: step4.timingSensitivity.note,
        cautionFrame: step3.markers.length > 0
          ? `มีแรง ${step3.activeConflictKinds.join(", ")} แตะ ${highlightedAreas.join(" / ")} จึงต้องอ่านช่วงนี้แบบ watchfulness เพิ่มขึ้น.`
          : "ยังไม่มี conflict marker เพิ่มเติม จึงคงคำเตือนเรื่องจังหวะไว้ที่การสังเกตสัญญาณร่างกายตาม baseline.",
        guardrails: [
          "จังหวะเวลามีหน้าที่บอกว่าเมื่อไรต้องระวังมากขึ้น ไม่ใช่ยืนยันว่าจะเจ็บป่วยแน่นอน",
          "ถ้าไม่มี source-3 timing sensitivity ห้ามสร้างหน้าต่างเสี่ยงจาก prose หรือ domain อื่นแทน",
        ],
      },
    },
    recoveryCaution: {
      sourceStepIds: [
        "step-2-organ-risk-mapping",
        "step-3-conflict-injury-markers",
        "step-4-bounded-caution-framing",
      ],
      facts: {
        supportVerdict,
        primaryOrgans: primaryRiskLane.organs,
        watchAreas: highlightedAreas,
        sensitivityLevel: step4.timingSensitivity.sensitivityLevel,
        triggerWindow: step4.timingSensitivity.triggerWindow,
        cautionTone: step4.cautionTone,
        careBoundary: step2.careBoundary,
        requiresTreatmentBoundary: true,
      },
      readingIntent: {
        supportFrame: supportVerdict === "rest-first-and-monitor"
          ? `แผนฟื้นตัวควรเดินแบบพักแรงและติดตามอาการ โดยจับตา ${highlightedAreas.join(" / ")} เป็นพิเศษ.`
          : `แผนฟื้นตัวพอเดินได้แบบค่อยเป็นค่อยไป ถ้ายังเฝ้าระวัง ${highlightedAreas.join(" / ")} และไม่เร่งเป้าร่างกายเกินไป.`,
        boundaryFrame: "Source 3 อนุญาตได้แค่กรอบ cautious pursuit และ self-care เชิงทั่วไปเท่านั้น ไม่ใช่คำรักษา คำวินิจฉัย หรือ remedy lane.",
        guardrails: [
          "ห้ามแปล recovery caution เป็น medical treatment instruction",
          "ห้ามใช้ health lane นี้ไปยืนยันผลลัพธ์แน่นอนของแผนฟื้นตัว",
        ],
      },
    },
  });
}