import { z } from "zod";

import { getHybridDictionarySpec } from "@/lib/bazi/dictionaries";
import { getHybridRetrievalRegistryEntry } from "@/lib/bazi/hybrid-retrieval-registry";
import { getBaziTopicDefinition } from "@/lib/bazi/knowledge/topic-registry";
import {
  buildSource4KnowledgeOwnership,
} from "@/lib/bazi/source4-knowledge-ownership";
import {
  Source4WealthInvestmentOverlaySchema,
  type Source4WealthInvestmentOverlay,
} from "@/lib/bazi/source4-wealth-investment-overlay";
import type { Source4WealthInvestmentStepResult } from "@/lib/bazi/source4-wealth-investment-rules";

const Source4SourceRefSchema = z.object({
  directoryLabel: z.string().trim().min(1),
  primarySource: z.string().trim().min(1),
  supportingSources: z.array(z.string().trim().min(1)),
  reasoningFocus: z.string().trim().min(1),
});

const Source4CapacityBandSchema = z.enum(["constrained", "limited", "stable", "productive", "competitive"]);
const Source4SourceModeSchema = z.enum(["vault-anchored", "cashflow-primary"]);
const Source4StorageStatusSchema = z.enum([
  "vault-not-manifest",
  "stored-and-guarded",
  "vault-opened-for-use",
  "leakage-prone",
]);
const Source4LeakageSeveritySchema = z.enum(["low", "watch", "elevated", "high"]);
const Source4BehaviorProfileSchema = z.enum([
  "growth-led",
  "indulgent",
  "knowledge-led",
  "authority-led",
  "aggressive",
  "slow-cycle",
  "high-burn",
  "capital-preserving",
  "asset-accumulating",
  "loss-prone",
  "incremental",
  "service-passive",
]);
const Source4SupportSignalSchema = z.enum(["supported", "mixed", "unsupported"]);
const Source4TimingNeedSchema = z.enum(["reinforce-capacity", "maintain-circulation", "release-into-wealth"]);
const Source4TimingWindowSchema = z.enum(["favorable-window", "selective-window", "capital-preservation-window"]);
const Source4RiskBoundarySchema = z.enum(["bounded-opportunity", "selective-risk", "capital-preservation"]);
const Source4StageSignalSchema = z.enum(["supportive", "mixed", "resistant"]);

const Source4InterpretationDeliveryContextSchema = z.object({
  topic: z.object({
    id: z.literal("wealth_luck"),
    thaiLabel: z.string().trim().min(1),
    annotationDimension: z.literal("wealth_and_investment"),
    sourceRefs: z.array(Source4SourceRefSchema).min(1),
  }),
  dictionary: z.object({
    specKey: z.literal("wealthAndInvestmentDictionary"),
    dimensionName: z.literal("wealth_and_investment"),
    sourceRelativePaths: z.array(z.string().trim().min(1)).min(1),
  }),
  retrieval: z.object({
    dimensionName: z.literal("wealth_and_investment"),
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

const Source4ReadingIntentSchema = z.object({
  summary: z.string().trim().min(1),
  detail: z.string().trim().min(1),
  guardrails: z.array(z.string().trim().min(1)).min(1),
});

const Source4TimingWindowFactSchema = z.object({
  pillarCode: z.string().trim().min(2),
  matchesNeed: z.boolean(),
  stageSignal: Source4StageSignalSchema,
  stageNameThai: z.string().trim().min(1),
});

const Source4AccumulationInterpretationSchema = z.object({
  sourceStepIds: z.tuple([
    z.literal("step-1-wealth-capacity-routing"),
    z.literal("step-3-money-source-storage-and-leakage"),
  ]),
  facts: z.object({
    capacityBand: Source4CapacityBandSchema,
    capacityLabel: z.string().trim().min(1),
    sourceMode: Source4SourceModeSchema,
    storageStatus: Source4StorageStatusSchema,
    leakageSeverity: Source4LeakageSeveritySchema,
    sourceLabels: z.array(z.string().trim().min(1)),
    fallbackSourceLabel: z.string().trim().min(1),
  }),
  readingIntent: Source4ReadingIntentSchema,
});

const Source4TimingInterpretationSchema = z.object({
  sourceStepIds: z.tuple([
    z.literal("step-3-money-source-storage-and-leakage"),
    z.literal("step-6-wealth-timing-and-risk-window"),
  ]),
  facts: z.object({
    windowNeedFamily: Source4TimingNeedSchema,
    timingWindow: Source4TimingWindowSchema,
    riskBoundary: Source4RiskBoundarySchema,
    leakageAdjustmentApplied: z.boolean(),
    daYunWindow: Source4TimingWindowFactSchema,
    liuNianWindow: Source4TimingWindowFactSchema,
  }),
  readingIntent: z.object({
    timingFrame: z.string().trim().min(1),
    cautionFrame: z.string().trim().min(1),
    guardrails: z.array(z.string().trim().min(1)).min(1),
  }),
});

const Source4RiskInterpretationSchema = z.object({
  sourceStepIds: z.tuple([
    z.literal("step-3-money-source-storage-and-leakage"),
    z.literal("step-4-spending-and-investment-behavior"),
    z.literal("step-6-wealth-timing-and-risk-window"),
  ]),
  facts: z.object({
    behaviorProfileId: Source4BehaviorProfileSchema,
    supportSignal: Source4SupportSignalSchema,
    investmentStyle: z.string().trim().min(1),
    riskBoundary: Source4RiskBoundarySchema,
    leakageSeverity: Source4LeakageSeveritySchema,
    source6ContextRequired: z.literal(false),
  }),
  readingIntent: z.object({
    postureFrame: z.string().trim().min(1),
    boundaryFrame: z.string().trim().min(1),
    guardrails: z.array(z.string().trim().min(1)).min(1),
  }),
});

export const Source4WealthInvestmentInterpretationSchema = z.object({
  sourceId: z.literal("source-4"),
  routeFrom: z.literal("source4-wealth-investment-overlay"),
  status: z.literal("ready-for-reading"),
  deliveryContext: Source4InterpretationDeliveryContextSchema,
  accumulationProfile: Source4AccumulationInterpretationSchema,
  timingOutlook: Source4TimingInterpretationSchema,
  investmentRisk: Source4RiskInterpretationSchema,
});

export type Source4WealthInvestmentInterpretation = z.infer<typeof Source4WealthInvestmentInterpretationSchema>;

const CAPACITY_SUMMARY: Record<
  Source4WealthInvestmentInterpretation["accumulationProfile"]["facts"]["capacityBand"],
  string
> = {
  constrained: "ฐานการเงินรับแรงสะสมได้น้อย ต้องตั้งฐานก่อนขยายเงิน",
  limited: "ฐานการเงินพอเดินได้ แต่ต้องคุมจังหวะและแรงรั่วอย่างใกล้",
  stable: "ฐานการเงินสะสมได้ค่อนข้างนิ่ง ถ้ารักษาวินัยจะเก็บผลได้",
  productive: "ฐานการเงินต่อยอดผลตอบแทนได้ดีเมื่อยังคุมโครงสร้างการเก็บเงิน",
  competitive: "ฐานการเงินทำผลได้แรง แต่ต้องกันการเร่งเกมจนแข่งกับเงินตัวเอง",
};

const STORAGE_FRAME: Record<
  Source4WealthInvestmentInterpretation["accumulationProfile"]["facts"]["storageStatus"],
  string
> = {
  "vault-not-manifest": "เงินเด่นเป็นกระแสไหลมากกว่าทรัพย์ก้อน จึงต้องพึ่งวินัยเก็บมากกว่าหวังเก็บเอง",
  "stored-and-guarded": "มีฐานเก็บเงินชัดและยังคุมทรัพย์ได้ค่อนข้างดี",
  "vault-opened-for-use": "มีทรัพย์ให้หมุนใช้ได้ แต่ต้องกันการเปิด vault จนเสียสมดุลการเก็บ",
  "leakage-prone": "มีฐานเงินแต่แรงรั่วหรือแรงกระทบทำให้เก็บยากกว่าปกติ",
};

const LEAKAGE_FRAME: Record<
  Source4WealthInvestmentInterpretation["accumulationProfile"]["facts"]["leakageSeverity"],
  string
> = {
  low: "แรงรั่วต่ำ จึงพออ่านเรื่องสะสมได้ตรงกว่าเรื่องซ่อมฐาน",
  watch: "มีจุดรั่วที่ต้องจับตา ไม่ควรปล่อยให้รายจ่ายหรือจังหวะเสียเปิดนาน",
  elevated: "แรงรั่วเริ่มดึงผลสะสม ต้องคุมการหมุนเงินและดีลเสี่ยงให้แคบลง",
  high: "แรงรั่วกดชัด ต้องกันการเสียก่อนค่อยคิดเรื่องขยายเงินหรือรับความเสี่ยง",
};

const TIMING_FRAME: Record<
  Source4WealthInvestmentInterpretation["timingOutlook"]["facts"]["timingWindow"],
  string
> = {
  "favorable-window": "หน้าต่างเงินเปิดกว่าเดิมและขยับได้เมื่อยังเดินตาม need ของดวง",
  "selective-window": "หน้าต่างเงินยังต้องเลือกจังหวะ ควรคัดเฉพาะ move ที่ตรง lane จริง",
  "capital-preservation-window": "จังหวะนี้ให้ถือการรักษาเงินต้นเป็นโจทย์หลักก่อนขยายผลตอบแทน",
};

const RISK_BOUNDARY_FRAME: Record<Source4WealthInvestmentInterpretation["timingOutlook"]["facts"]["riskBoundary"], string> = {
  "bounded-opportunity": "รับความเสี่ยงได้แบบมีกรอบ โดยยังต้องรู้ขนาดดีลและทางออก",
  "selective-risk": "รับความเสี่ยงได้เฉพาะดีลที่คุมขอบเขต สภาพคล่อง และแรงรั่วได้จริง",
  "capital-preservation": "เส้นแดงคือรักษาเงินต้นก่อนผลตอบแทน ไม่ควรเอาความมั่นใจนำหน้าฐานเงิน",
};

const SUPPORT_POSTURE_FRAME: Record<Source4WealthInvestmentInterpretation["investmentRisk"]["facts"]["supportSignal"], string> = {
  supported: "พฤติกรรมลงทุนมีฐานรองรับจาก output lane และจังหวะพอรับได้",
  mixed: "พฤติกรรมลงทุนทำได้แต่ต้องคัดดีลและแบ่งจังหวะ ไม่ควรวิ่งทุกทาง",
  unsupported: "พฤติกรรมลงทุนฝืนง่าย จึงควรเน้นวินัยและกันการ burn ก่อน",
};

function getStepResult<K extends Source4WealthInvestmentStepResult["kind"]>(
  overlay: Source4WealthInvestmentOverlay,
  stepId: Source4WealthInvestmentOverlay["steps"][number]["stepId"],
  kind: K,
) {
  const step = overlay.steps.find((candidate) => candidate.stepId === stepId);

  if (!step) {
    throw new Error(`Missing Source 4 overlay step: ${stepId}`);
  }

  if (step.result.kind !== kind) {
    throw new Error(`Unexpected Source 4 step result kind for ${stepId}: ${step.result.kind}`);
  }

  return step.result as Extract<Source4WealthInvestmentStepResult, { kind: K }>;
}

function buildDeliveryContext() {
  const ownership = buildSource4KnowledgeOwnership();
  const contract = ownership.deliverySurfaceContract;
  const topic = getBaziTopicDefinition(contract.topicId);
  const dictionarySpec = getHybridDictionarySpec(contract.annotationDimension);
  const retrievalEntry = getHybridRetrievalRegistryEntry(contract.retrievalRegistryDimension);

  if (!topic) {
    throw new Error(`Missing Source 4 delivery topic: ${contract.topicId}`);
  }

  if (!dictionarySpec) {
    throw new Error(`Missing Source 4 dictionary spec: ${contract.annotationDimension}`);
  }

  if (topic.annotationDimension !== contract.annotationDimension) {
    throw new Error("Source 4 topic contract drifted away from the wealth_and_investment dimension.");
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

function mapTimingWindowFact(window: {
  pillarCode: string;
  matchesNeed: boolean;
  wealthStage: {
    signal: "supportive" | "mixed" | "resistant";
    stageNameThai: string;
  };
}) {
  return {
    pillarCode: window.pillarCode,
    matchesNeed: window.matchesNeed,
    stageSignal: window.wealthStage.signal,
    stageNameThai: window.wealthStage.stageNameThai,
  };
}

export function buildSource4WealthInvestmentInterpretation(
  overlayInput: Source4WealthInvestmentOverlay,
): Source4WealthInvestmentInterpretation {
  const overlay = Source4WealthInvestmentOverlaySchema.parse(overlayInput);
  const step1 = getStepResult(overlay, "step-1-wealth-capacity-routing", "wealth-capacity-routing");
  const step3 = getStepResult(overlay, "step-3-money-source-storage-and-leakage", "money-source-storage-and-leakage");
  const step4 = getStepResult(overlay, "step-4-spending-and-investment-behavior", "spending-and-investment-behavior");
  const step6 = getStepResult(overlay, "step-6-wealth-timing-and-risk-window", "wealth-timing-and-risk-window");
  const deliveryContext = buildDeliveryContext();
  const sourceLabels = step3.sourceLanes.map((lane) => lane.label);
  const sourceFrame = sourceLabels.length > 0
    ? `แหล่งเงินที่เห็นในดวงตอนนี้โยงกับ ${sourceLabels.join(" และ ")}`
    : step3.fallbackSourceLabel;

  return Source4WealthInvestmentInterpretationSchema.parse({
    sourceId: overlay.sourceId,
    routeFrom: "source4-wealth-investment-overlay",
    status: "ready-for-reading",
    deliveryContext,
    accumulationProfile: {
      sourceStepIds: [
        "step-1-wealth-capacity-routing",
        "step-3-money-source-storage-and-leakage",
      ],
      facts: {
        capacityBand: step1.capacityBand,
        capacityLabel: step1.capacityLabel,
        sourceMode: step3.sourceMode,
        storageStatus: step3.storageStatus,
        leakageSeverity: step3.leakageSeverity,
        sourceLabels,
        fallbackSourceLabel: step3.fallbackSourceLabel,
      },
      readingIntent: {
        summary: `${CAPACITY_SUMMARY[step1.capacityBand]} ${STORAGE_FRAME[step3.storageStatus]}`,
        detail: `${sourceFrame} ${LEAKAGE_FRAME[step3.leakageSeverity]}`,
        guardrails: [
          "ห้ามตอบเรื่องเก็บเงินโดยกลับไปคำนวณกำลังดิถีหรือ wealth vault ใหม่จาก Source 4 overlay",
          "ห้ามแปลง leakage เป็นคำสัญญาเรื่องลาภลอยหรือเงินจากคู่โดยไม่มี contract รองรับ",
        ],
      },
    },
    timingOutlook: {
      sourceStepIds: [
        "step-3-money-source-storage-and-leakage",
        "step-6-wealth-timing-and-risk-window",
      ],
      facts: {
        windowNeedFamily: step6.windowNeed.family,
        timingWindow: step6.timingWindow,
        riskBoundary: step6.riskBoundary,
        leakageAdjustmentApplied: step6.leakageAdjustmentApplied,
        daYunWindow: mapTimingWindowFact(step6.daYunWindow),
        liuNianWindow: mapTimingWindowFact(step6.liuNianWindow),
      },
      readingIntent: {
        timingFrame: TIMING_FRAME[step6.timingWindow],
        cautionFrame: `${RISK_BOUNDARY_FRAME[step6.riskBoundary]} ${step6.leakageAdjustmentApplied ? "lane นี้ถูกลดความเสี่ยงลงเพราะมี leakage adjustment แล้ว" : "lane นี้ยังไม่ต้องลดคำตอบเพิ่มจาก leakage"}`,
        guardrails: [
          "ห้ามอ่าน timing window เป็นปีรวยแน่หรือผลตอบแทนการันตี",
          "ให้ใช้หน้าต่าง Da Yun 60% และ Liu Nian 40% ตาม overlay เดิมเท่านั้น",
        ],
      },
    },
    investmentRisk: {
      sourceStepIds: [
        "step-3-money-source-storage-and-leakage",
        "step-4-spending-and-investment-behavior",
        "step-6-wealth-timing-and-risk-window",
      ],
      facts: {
        behaviorProfileId: step4.behaviorProfileId,
        supportSignal: step4.supportSignal,
        investmentStyle: step4.investmentStyle,
        riskBoundary: step6.riskBoundary,
        leakageSeverity: step3.leakageSeverity,
        source6ContextRequired: step4.source6ContextRequired,
      },
      readingIntent: {
        postureFrame: `${SUPPORT_POSTURE_FRAME[step4.supportSignal]} แนวลงทุนที่ขึ้นมาใน lane นี้คือ ${step4.investmentStyle}`,
        boundaryFrame: `${RISK_BOUNDARY_FRAME[step6.riskBoundary]} ${LEAKAGE_FRAME[step3.leakageSeverity]}`,
        guardrails: [
          "ห้ามให้ Source 6 business fit กลายเป็น owner ของ money-risk lane ถ้าคำถามยังอยู่ที่ wealth risk",
          "ห้ามข้ามจาก behavior profile ไปสู่คำแนะนำลงทุนเฉพาะตัวเกิน boundary ที่ Source 4 กำหนด",
        ],
      },
    },
  });
}